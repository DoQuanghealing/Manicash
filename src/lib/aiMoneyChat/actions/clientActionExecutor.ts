/* ═══ AI Money Chat — Client Action Executor (Phase 4A/4B + Phase 5 undo metadata) ═══
 * CLIENT-ONLY. Nơi DUY NHẤT gọi Zustand action sau khi user confirm.
 * Re-validate state hiện tại trước khi execute. Trả undo metadata (Phase 5).
 * Expense >= BreathGate threshold KHÔNG được execute trực tiếp.
 */
'use client';

import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useWishlistStore, type CoolingHours } from '@/stores/useWishlistStore';
import { formatVND } from '../response/formatMoney';
import { BREATH_GATE_THRESHOLD, type MoneyActionRequest } from './actionTypes';
import type { MoneyActionUndoSnapshot } from './actionAuditTypes';

export type ExecuteActionResult =
  | {
      ok: true;
      message: string;
      undoable: boolean;
      undoReason?: string;
      undoSnapshot?: MoneyActionUndoSnapshot;
    }
  | {
      ok: false;
      message: string;
      undoable?: false;
      undoReason?: string;
    };

const VALID_COOLING: CoolingHours[] = [24, 48, 72, 96, 168];
function toCoolingHours(h?: number): CoolingHours {
  return h && (VALID_COOLING as number[]).includes(h) ? (h as CoolingHours) : 48;
}

function isExpired(request: MoneyActionRequest): boolean {
  const exp = Date.parse(request.expiresAt);
  return Number.isFinite(exp) && Date.now() > exp;
}

/** Caveat: undo rollback data nhưng KHÔNG đảo XP/streak (chưa có XP-reversal API). */
const XP_CAVEAT_TXN = 'Undo sẽ xóa giao dịch nhưng không đảo streak/XP.';
const XP_CAVEAT_GOAL = 'Undo sẽ rút khoản nạp nhưng không đảo XP tiết kiệm.';
const XP_CAVEAT_TASK = 'Undo bỏ trạng thái hoàn thành nhưng không đảo XP và không khôi phục sub-task.';

export async function executeMoneyActionOnClient(
  request: MoneyActionRequest,
): Promise<ExecuteActionResult> {
  if (isExpired(request)) {
    return { ok: false, message: 'Thao tác đã hết hạn xác nhận. Ngài thử yêu cầu lại nhé.' };
  }

  const finance = useFinanceStore.getState();

  switch (request.action) {
    case 'MARK_BILL_PAID': {
      const { billId, billName } = request.payload;
      const bill = finance.fixedBills.find((b) => b.id === billId);
      if (!bill) return { ok: false, message: 'Không tìm thấy hóa đơn để cập nhật (dữ liệu đã thay đổi).' };
      if (bill.isPaid) return { ok: false, message: `Hóa đơn ${bill.name} đã được thanh toán trước đó rồi.` };
      finance.payBill(billId);
      return {
        ok: true,
        message: `Đã đánh dấu bill ${billName} là đã thanh toán.`,
        undoable: true,
        undoSnapshot: { action: 'MARK_BILL_PAID', before: { billId, isPaid: false }, after: { billId, isPaid: true } },
      };
    }

    case 'CREATE_EXPENSE': {
      const { amount, categoryId, note, wallet } = request.payload;
      if (!(amount > 0)) return { ok: false, message: 'Số tiền chi không hợp lệ.' };
      if (amount >= BREATH_GATE_THRESHOLD) {
        return {
          ok: false,
          message: 'Khoản chi này vượt ngưỡng BreathGate. Vui lòng nhập qua tab Nhập để xác nhận chậm.',
        };
      }
      const tx = finance.addTransaction({ type: 'expense', amount, categoryId: categoryId || 'other', note: note ?? '', wallet: wallet ?? 'main' });
      return {
        ok: true,
        message: `Đã ghi khoản chi ${formatVND(amount)}.`,
        undoable: true,
        undoReason: XP_CAVEAT_TXN,
        undoSnapshot: { action: 'CREATE_EXPENSE', after: { transactionId: tx.id } },
      };
    }

    case 'CREATE_INCOME': {
      const { amount, categoryId, note, wallet } = request.payload;
      if (!(amount > 0)) return { ok: false, message: 'Số tiền thu không hợp lệ.' };
      const tx = finance.addTransaction({ type: 'income', amount, categoryId: categoryId || 'other', note: note ?? '', wallet: wallet ?? 'main' });
      return {
        ok: true,
        message: `Đã ghi thu nhập ${formatVND(amount)}.`,
        undoable: true,
        undoReason: XP_CAVEAT_TXN,
        undoSnapshot: { action: 'CREATE_INCOME', after: { transactionId: tx.id } },
      };
    }

    case 'CREATE_FIXED_BILL': {
      const { name, amount, dueDay, icon } = request.payload;
      if (!(amount > 0) || dueDay < 1 || dueDay > 31) return { ok: false, message: 'Dữ liệu hóa đơn không hợp lệ.' };
      const bill = finance.addBill({ name, icon: icon ?? '🧾', amount, dueDay });
      return {
        ok: true,
        message: `Đã tạo bill ${name} ${formatVND(amount)}, hạn ngày ${dueDay} mỗi tháng.`,
        undoable: true,
        undoSnapshot: { action: 'CREATE_FIXED_BILL', after: { billId: bill.id } },
      };
    }

    case 'SET_CATEGORY_BUDGET': {
      const { categoryId, categoryName, monthlyLimit } = request.payload;
      if (!categoryId || !(monthlyLimit >= 0)) return { ok: false, message: 'Dữ liệu ngân sách không hợp lệ.' };
      const budget = useBudgetStore.getState();
      const month = budget.currentMonth;
      const existing = budget.categoryBudgets.find((b) => b.categoryId === categoryId && b.month === month);
      const oldLimit = existing ? existing.monthlyLimit : null;
      budget.setCategoryBudget(categoryId, monthlyLimit);
      return {
        ok: true,
        message: `Đã đặt ngân sách ${categoryName ?? categoryId} là ${formatVND(monthlyLimit)}.`,
        undoable: true,
        undoReason: oldLimit === null ? 'Trước đó chưa có ngân sách; undo sẽ đặt về 0.' : undefined,
        undoSnapshot: { action: 'SET_CATEGORY_BUDGET', before: { categoryId, monthlyLimit: oldLimit }, after: { categoryId, monthlyLimit } },
      };
    }

    case 'ADD_GOAL_DEPOSIT': {
      const { goalId, goalName, amount, note } = request.payload;
      if (!(amount > 0)) return { ok: false, message: 'Số tiền nạp không hợp lệ.' };
      const goal = useGoalsStore.getState().goals.find((g) => g.id === goalId);
      if (!goal) return { ok: false, message: 'Không tìm thấy mục tiêu để nạp (dữ liệu đã thay đổi).' };
      const depositId = useGoalsStore.getState().addFundsToGoal(goalId, amount, 'manual', note);
      return {
        ok: true,
        message: `Đã nạp ${formatVND(amount)} vào mục tiêu ${goalName}.`,
        undoable: true,
        undoReason: XP_CAVEAT_GOAL,
        undoSnapshot: { action: 'ADD_GOAL_DEPOSIT', after: { goalId, depositId, amount } },
      };
    }

    case 'CREATE_EARNING_TASK': {
      const { name, expectedAmount, startDate, endDate, subTasks } = request.payload;
      if (!name || !(expectedAmount > 0) || !endDate) return { ok: false, message: 'Dữ liệu nhiệm vụ không hợp lệ.' };
      const task = useTaskStore.getState().addTask({
        name,
        expectedAmount,
        startDate: startDate ?? new Date().toISOString().slice(0, 10),
        endDate,
        subTasks: subTasks?.map((s) => ({ name: s.name })),
      });
      return {
        ok: true,
        message: `Đã tạo nhiệm vụ “${name}” kỳ vọng ${formatVND(expectedAmount)}.`,
        undoable: true,
        undoSnapshot: { action: 'CREATE_EARNING_TASK', after: { taskId: task.id } },
      };
    }

    case 'COMPLETE_EARNING_TASK': {
      const { taskId, taskName, expectedAmount, actualAmount } = request.payload;
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, message: 'Không tìm thấy nhiệm vụ (dữ liệu đã thay đổi).' };
      if (task.completedAt) return { ok: false, message: `Nhiệm vụ ${task.name} đã hoàn thành trước đó rồi.` };
      if (task.deletedAt) return { ok: false, message: 'Nhiệm vụ này đã bị xóa.' };
      useTaskStore.getState().completeTask(taskId, actualAmount ?? expectedAmount ?? 0);
      return {
        ok: true,
        message: `Đã đánh dấu nhiệm vụ ${taskName} là hoàn thành.`,
        undoable: true,
        undoReason: XP_CAVEAT_TASK,
        undoSnapshot: { action: 'COMPLETE_EARNING_TASK', before: { taskId }, after: { taskId } },
      };
    }

    case 'ADD_WISHLIST_ITEM': {
      const { name, expectedPrice, reason, cooldownHours } = request.payload;
      if (!name || !name.trim()) return { ok: false, message: 'Thiếu tên món muốn mua.' };
      const item = useWishlistStore.getState().addItem({
        name,
        price: expectedPrice ?? 0,
        reason: reason ?? '',
        coolingHours: toCoolingHours(cooldownHours),
      });
      return {
        ok: true,
        message: `Đã đưa ${name} vào wishlist (khóa mua ${toCoolingHours(cooldownHours)} giờ).`,
        undoable: true,
        undoSnapshot: { action: 'ADD_WISHLIST_ITEM', after: { itemId: item.id } },
      };
    }

    case 'FLAG_TRANSACTION': {
      const { transactionId } = request.payload;
      const txn = finance.transactions.find((t) => t.id === transactionId);
      if (!txn) return { ok: false, message: 'Không tìm thấy giao dịch để gắn cờ (dữ liệu đã thay đổi).' };
      const wasFlagged = useBudgetStore.getState().flaggedTransactionIds.includes(transactionId);
      useBudgetStore.getState().toggleTransactionFlag(transactionId);
      return {
        ok: true,
        message: wasFlagged ? 'Đã bỏ cờ giao dịch.' : 'Đã gắn cờ giao dịch để chú ý.',
        undoable: true,
        undoSnapshot: { action: 'FLAG_TRANSACTION', before: { transactionId, flagged: wasFlagged }, after: { transactionId, flagged: !wasFlagged } },
      };
    }

    default:
      return { ok: false, message: 'Loại thao tác không được hỗ trợ.' };
  }
}
