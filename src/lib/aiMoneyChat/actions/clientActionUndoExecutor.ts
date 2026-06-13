/* ═══ AI Money Chat — Client Action Undo Executor (Phase 5) ═══
 * CLIENT-ONLY. Hoàn tác an toàn 1 action đã executed + undoable.
 * Validate state hiện tại còn khớp 'after' trước khi rollback; stale -> fail.
 */
'use client';

import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useWishlistStore } from '@/stores/useWishlistStore';
import { useAuthStore, type UserProgressSnapshot } from '@/stores/useAuthStore';
import type { SubTask, XPPenalty } from '@/types/task';
import type { MoneyActionAuditRecord } from './actionAuditTypes';

export type UndoActionResult = { ok: true; message: string } | { ok: false; message: string };

const STALE = 'Dữ liệu đã thay đổi, không thể undo an toàn.';

/** Restore XP/streak chính xác từ snapshot (nếu có). */
function restoreUserProgress(before: Record<string, unknown>): void {
  const up = before.userProgress as UserProgressSnapshot | null | undefined;
  if (up) useAuthStore.getState().restoreProgress(up);
}

export async function undoMoneyActionOnClient(record: MoneyActionAuditRecord): Promise<UndoActionResult> {
  if (record.status !== 'executed') return { ok: false, message: 'Chỉ hoàn tác được thao tác vừa thực hiện.' };
  if (!record.undoable) return { ok: false, message: 'Thao tác này không thể hoàn tác.' };
  const snap = record.undoSnapshot;
  if (!snap) return { ok: false, message: 'Thiếu dữ liệu để hoàn tác.' };

  const after = (snap.after ?? {}) as Record<string, unknown>;
  const before = (snap.before ?? {}) as Record<string, unknown>;
  const finance = useFinanceStore.getState();

  switch (snap.action) {
    case 'MARK_BILL_PAID': {
      const billId = String(after.billId ?? '');
      const bill = finance.fixedBills.find((b) => b.id === billId);
      if (!bill) return { ok: false, message: STALE };
      if (!bill.isPaid) return { ok: false, message: STALE };
      // Phase 6A: restore billFund CHÍNH XÁC từ billFundBefore (không cộng lại amount).
      const billFundBefore = typeof before.billFundBefore === 'number' ? before.billFundBefore : undefined;
      finance.setBillPaidStatus(billId, false, billFundBefore);
      return { ok: true, message: 'Đã hoàn tác: bill trở lại chưa thanh toán.' };
    }

    case 'CREATE_EXPENSE':
    case 'CREATE_INCOME': {
      const id = String(after.transactionId ?? '');
      const ok = finance.removeTransaction(id);
      if (!ok) return { ok: false, message: STALE };
      restoreUserProgress(before); // đảo XP/streak chính xác
      return { ok: true, message: 'Đã hoàn tác: xóa giao dịch vừa ghi.' };
    }

    case 'CREATE_FIXED_BILL': {
      const billId = String(after.billId ?? '');
      if (!finance.fixedBills.some((b) => b.id === billId)) return { ok: false, message: STALE };
      finance.removeBill(billId);
      return { ok: true, message: 'Đã hoàn tác: xóa bill vừa tạo.' };
    }

    case 'SET_CATEGORY_BUDGET': {
      const categoryId = String(before.categoryId ?? '');
      if (!categoryId) return { ok: false, message: STALE };
      const month = typeof before.month === 'string' ? before.month : undefined;
      if (before.existedBefore && typeof before.monthlyLimit === 'number') {
        // Trước có budget -> trả lại limit cũ.
        useBudgetStore.getState().setCategoryBudget(categoryId, before.monthlyLimit);
        return { ok: true, message: 'Đã hoàn tác: khôi phục ngân sách trước đó.' };
      }
      // Trước CHƯA có budget -> xóa budget vừa tạo.
      useBudgetStore.getState().removeCategoryBudget(categoryId, month);
      return { ok: true, message: 'Đã hoàn tác: xóa ngân sách vừa đặt.' };
    }

    case 'ADD_GOAL_DEPOSIT': {
      const goalId = String(after.goalId ?? '');
      const depositId = String(after.depositId ?? '');
      const ok = useGoalsStore.getState().removeGoalDeposit(goalId, depositId);
      if (!ok) return { ok: false, message: STALE };
      restoreUserProgress(before); // đảo XP tiết kiệm chính xác
      return { ok: true, message: 'Đã hoàn tác: rút khoản nạp mục tiêu.' };
    }

    case 'CREATE_EARNING_TASK': {
      const taskId = String(after.taskId ?? '');
      const ok = useTaskStore.getState().removeTask(taskId);
      return ok ? { ok: true, message: 'Đã hoàn tác: xóa nhiệm vụ vừa tạo.' } : { ok: false, message: STALE };
    }

    case 'COMPLETE_EARNING_TASK': {
      const taskId = String(before.taskId ?? '');
      const ok = useTaskStore.getState().undoCompleteTask(taskId, {
        actualAmount: typeof before.actualAmount === 'number' ? before.actualAmount : undefined,
        subTasks: Array.isArray(before.subTasks) ? (before.subTasks as SubTask[]) : undefined,
        xpPenalties: Array.isArray(before.xpPenalties) ? (before.xpPenalties as XPPenalty[]) : undefined,
      });
      if (!ok) return { ok: false, message: STALE };
      restoreUserProgress(before); // đảo XP TASK_COMPLETE chính xác
      return { ok: true, message: 'Đã hoàn tác: nhiệm vụ trở lại chưa hoàn thành.' };
    }

    case 'ADD_WISHLIST_ITEM': {
      const itemId = String(after.itemId ?? '');
      if (!useWishlistStore.getState().items.some((i) => i.id === itemId)) return { ok: false, message: STALE };
      useWishlistStore.getState().removeItem(itemId);
      return { ok: true, message: 'Đã hoàn tác: xóa món khỏi wishlist.' };
    }

    case 'FLAG_TRANSACTION': {
      const transactionId = String(before.transactionId ?? '');
      if (!finance.transactions.some((t) => t.id === transactionId)) return { ok: false, message: STALE };
      const wasFlagged = before.flagged === true;
      const currentlyFlagged = useBudgetStore.getState().flaggedTransactionIds.includes(transactionId);
      // State phải còn ở trạng thái 'after' (đã toggle). Nếu user đổi rồi -> stale.
      if (currentlyFlagged === wasFlagged) return { ok: false, message: STALE };
      useBudgetStore.getState().setTransactionFlags([transactionId], wasFlagged);
      return { ok: true, message: 'Đã hoàn tác: khôi phục trạng thái cờ giao dịch.' };
    }

    default:
      return { ok: false, message: 'Thao tác này không thể hoàn tác.' };
  }
}
