/* ═══ AI Money Chat — Client Action Executor (Phase 4A) ═══
 * CLIENT-ONLY. Đây là NƠI DUY NHẤT được phép gọi Zustand action sau khi user confirm.
 * Re-validate state hiện tại trước khi execute (tránh stale request).
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

const VALID_COOLING: CoolingHours[] = [24, 48, 72, 96, 168];
function toCoolingHours(h?: number): CoolingHours {
  return h && (VALID_COOLING as number[]).includes(h) ? (h as CoolingHours) : 48;
}

export type ExecuteActionResult = { ok: true; message: string } | { ok: false; message: string };

function isExpired(request: MoneyActionRequest): boolean {
  const exp = Date.parse(request.expiresAt);
  return Number.isFinite(exp) && Date.now() > exp;
}

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
      return { ok: true, message: `Đã đánh dấu bill ${billName} là đã thanh toán.` };
    }

    case 'CREATE_EXPENSE': {
      const { amount, categoryId, note, wallet } = request.payload;
      if (!(amount > 0)) return { ok: false, message: 'Số tiền chi không hợp lệ.' };
      // KHÔNG bypass BreathGate cho khoản chi lớn.
      if (amount >= BREATH_GATE_THRESHOLD) {
        return {
          ok: false,
          message: 'Khoản chi này vượt ngưỡng BreathGate. Vui lòng nhập qua tab Nhập để xác nhận chậm.',
        };
      }
      finance.addTransaction({
        type: 'expense',
        amount,
        categoryId: categoryId || 'other',
        note: note ?? '',
        wallet: wallet ?? 'main',
      });
      return { ok: true, message: `Đã ghi khoản chi ${formatVND(amount)}.` };
    }

    case 'CREATE_INCOME': {
      const { amount, categoryId, note, wallet } = request.payload;
      if (!(amount > 0)) return { ok: false, message: 'Số tiền thu không hợp lệ.' };
      finance.addTransaction({
        type: 'income',
        amount,
        categoryId: categoryId || 'other',
        note: note ?? '',
        wallet: wallet ?? 'main',
      });
      return { ok: true, message: `Đã ghi thu nhập ${formatVND(amount)}.` };
    }

    // ─── Phase 4B ───────────────────────────────────────────────────────────
    case 'CREATE_FIXED_BILL': {
      const { name, amount, dueDay, icon } = request.payload;
      if (!(amount > 0) || dueDay < 1 || dueDay > 31) return { ok: false, message: 'Dữ liệu hóa đơn không hợp lệ.' };
      finance.addBill({ name, icon: icon ?? '🧾', amount, dueDay });
      return { ok: true, message: `Đã tạo bill ${name} ${formatVND(amount)}, hạn ngày ${dueDay} mỗi tháng.` };
    }

    case 'SET_CATEGORY_BUDGET': {
      const { categoryId, categoryName, monthlyLimit } = request.payload;
      if (!categoryId || !(monthlyLimit >= 0)) return { ok: false, message: 'Dữ liệu ngân sách không hợp lệ.' };
      useBudgetStore.getState().setCategoryBudget(categoryId, monthlyLimit);
      return { ok: true, message: `Đã đặt ngân sách ${categoryName ?? categoryId} là ${formatVND(monthlyLimit)}.` };
    }

    case 'ADD_GOAL_DEPOSIT': {
      const { goalId, goalName, amount, note } = request.payload;
      if (!(amount > 0)) return { ok: false, message: 'Số tiền nạp không hợp lệ.' };
      const goal = useGoalsStore.getState().goals.find((g) => g.id === goalId);
      if (!goal) return { ok: false, message: 'Không tìm thấy mục tiêu để nạp (dữ liệu đã thay đổi).' };
      // Store tự cộng SAVINGS_DEPOSIT XP — KHÔNG nhân đôi ở đây.
      useGoalsStore.getState().addFundsToGoal(goalId, amount, 'manual', note);
      return { ok: true, message: `Đã nạp ${formatVND(amount)} vào mục tiêu ${goalName}.` };
    }

    case 'CREATE_EARNING_TASK': {
      const { name, expectedAmount, startDate, endDate, subTasks } = request.payload;
      if (!name || !(expectedAmount > 0) || !endDate) return { ok: false, message: 'Dữ liệu nhiệm vụ không hợp lệ.' };
      useTaskStore.getState().addTask({
        name,
        expectedAmount,
        startDate: startDate ?? new Date().toISOString().slice(0, 10),
        endDate,
        subTasks: subTasks?.map((s) => ({ name: s.name })),
      });
      return { ok: true, message: `Đã tạo nhiệm vụ “${name}” kỳ vọng ${formatVND(expectedAmount)}.` };
    }

    case 'COMPLETE_EARNING_TASK': {
      const { taskId, taskName, expectedAmount, actualAmount } = request.payload;
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, message: 'Không tìm thấy nhiệm vụ (dữ liệu đã thay đổi).' };
      if (task.completedAt) return { ok: false, message: `Nhiệm vụ ${task.name} đã hoàn thành trước đó rồi.` };
      if (task.deletedAt) return { ok: false, message: 'Nhiệm vụ này đã bị xóa.' };
      // Store tự cộng TASK_COMPLETE XP — KHÔNG nhân đôi ở đây.
      useTaskStore.getState().completeTask(taskId, actualAmount ?? expectedAmount ?? 0);
      return { ok: true, message: `Đã đánh dấu nhiệm vụ ${taskName} là hoàn thành.` };
    }

    case 'ADD_WISHLIST_ITEM': {
      const { name, expectedPrice, reason, cooldownHours } = request.payload;
      if (!name || !name.trim()) return { ok: false, message: 'Thiếu tên món muốn mua.' };
      useWishlistStore.getState().addItem({
        name,
        price: expectedPrice ?? 0,
        reason: reason ?? '',
        coolingHours: toCoolingHours(cooldownHours),
      });
      return { ok: true, message: `Đã đưa ${name} vào wishlist (khóa mua ${toCoolingHours(cooldownHours)} giờ).` };
    }

    case 'FLAG_TRANSACTION': {
      const { transactionId } = request.payload;
      const txn = finance.transactions.find((t) => t.id === transactionId);
      if (!txn) return { ok: false, message: 'Không tìm thấy giao dịch để gắn cờ (dữ liệu đã thay đổi).' };
      useBudgetStore.getState().toggleTransactionFlag(transactionId);
      return { ok: true, message: 'Đã gắn cờ giao dịch để chú ý.' };
    }

    default:
      return { ok: false, message: 'Loại thao tác không được hỗ trợ.' };
  }
}
