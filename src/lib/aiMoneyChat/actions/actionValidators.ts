/* ═══ AI Money Chat — Action Validators (Phase 4A) ═══
 * Đối chiếu actionRequest với snapshot. PURE — không execute, không Zustand.
 */

import type { MoneySnapshotV1 } from '@/lib/moneyBrain';
import type { MoneyActionRequest } from './actionTypes';

export type ActionValidationResult = { ok: true } | { ok: false; reason: string };

const VALID_WALLETS = new Set(['main', 'emergency', 'bill-fund']);

export function validateActionRequestAgainstSnapshot(
  snapshot: MoneySnapshotV1,
  request: MoneyActionRequest,
): ActionValidationResult {
  switch (request.action) {
    case 'MARK_BILL_PAID': {
      const { billId, amount } = request.payload;
      const bill = snapshot.bills.find((b) => b.id === billId);
      if (!bill) return { ok: false, reason: 'Không tìm thấy hóa đơn này trong dữ liệu hiện tại.' };
      if (bill.isPaid) return { ok: false, reason: `Hóa đơn ${bill.name} đã được đánh dấu thanh toán rồi.` };
      if (typeof amount === 'number' && amount !== bill.amount) {
        return { ok: false, reason: 'Số tiền hóa đơn không khớp dữ liệu hiện tại.' };
      }
      return { ok: true };
    }

    case 'CREATE_EXPENSE': {
      const { amount, categoryId, wallet } = request.payload;
      if (!(amount > 0)) return { ok: false, reason: 'Số tiền chi phải lớn hơn 0.' };
      if (!categoryId || !categoryId.trim()) return { ok: false, reason: 'Thiếu danh mục cho khoản chi.' };
      if (wallet && !VALID_WALLETS.has(wallet)) return { ok: false, reason: 'Ví không hợp lệ.' };
      // amount >= ngưỡng BreathGate vẫn cho TẠO request; client executor sẽ chặn execute.
      return { ok: true };
    }

    case 'CREATE_INCOME': {
      const { amount, wallet } = request.payload;
      if (!(amount > 0)) return { ok: false, reason: 'Số tiền thu phải lớn hơn 0.' };
      if (wallet && !VALID_WALLETS.has(wallet)) return { ok: false, reason: 'Ví không hợp lệ.' };
      return { ok: true };
    }

    // ─── Phase 4B ───────────────────────────────────────────────────────────
    case 'CREATE_FIXED_BILL': {
      const { name, amount, dueDay } = request.payload;
      if (!name || !name.trim()) return { ok: false, reason: 'Thiếu tên hóa đơn.' };
      if (!(amount > 0)) return { ok: false, reason: 'Số tiền hóa đơn phải lớn hơn 0.' };
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        return { ok: false, reason: 'Ngày đến hạn phải từ 1 đến 31.' };
      }
      return { ok: true };
    }

    case 'SET_CATEGORY_BUDGET': {
      const { categoryId, monthlyLimit } = request.payload;
      if (!categoryId || !categoryId.trim()) return { ok: false, reason: 'Thiếu danh mục cho ngân sách.' };
      if (!(monthlyLimit >= 0)) return { ok: false, reason: 'Hạn mức ngân sách không hợp lệ.' };
      return { ok: true };
    }

    case 'ADD_GOAL_DEPOSIT': {
      const { goalId, amount } = request.payload;
      const goal = snapshot.goals.find((g) => g.id === goalId);
      if (!goal) return { ok: false, reason: 'Không tìm thấy mục tiêu này.' };
      if (!(amount > 0)) return { ok: false, reason: 'Số tiền nạp phải lớn hơn 0.' };
      return { ok: true };
    }

    case 'CREATE_EARNING_TASK': {
      const { name, expectedAmount, endDate, startDate } = request.payload;
      if (!name || !name.trim()) return { ok: false, reason: 'Thiếu tên nhiệm vụ.' };
      if (!(expectedAmount > 0)) return { ok: false, reason: 'Thu nhập kỳ vọng phải lớn hơn 0.' };
      if (!endDate || Number.isNaN(Date.parse(endDate))) return { ok: false, reason: 'Hạn hoàn thành không hợp lệ.' };
      if (startDate && Number.isNaN(Date.parse(startDate))) return { ok: false, reason: 'Ngày bắt đầu không hợp lệ.' };
      return { ok: true };
    }

    case 'COMPLETE_EARNING_TASK': {
      const { taskId, actualAmount } = request.payload;
      const task = snapshot.tasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, reason: 'Không tìm thấy nhiệm vụ này.' };
      if (task.completedAt) return { ok: false, reason: `Nhiệm vụ ${task.name} đã hoàn thành rồi.` };
      if (task.deletedAt) return { ok: false, reason: 'Nhiệm vụ này đã bị xóa.' };
      if (typeof actualAmount === 'number' && actualAmount < 0) {
        return { ok: false, reason: 'Số tiền thực nhận không hợp lệ.' };
      }
      return { ok: true };
    }

    case 'ADD_WISHLIST_ITEM': {
      const { name, expectedPrice, cooldownHours } = request.payload;
      if (!name || !name.trim()) return { ok: false, reason: 'Thiếu tên món muốn mua.' };
      if (typeof expectedPrice === 'number' && !(expectedPrice > 0)) {
        return { ok: false, reason: 'Giá dự kiến không hợp lệ.' };
      }
      if (typeof cooldownHours === 'number' && !(cooldownHours > 0)) {
        return { ok: false, reason: 'Thời gian khóa mua không hợp lệ.' };
      }
      return { ok: true };
    }

    case 'FLAG_TRANSACTION': {
      const { transactionId } = request.payload;
      const txn = snapshot.transactions.find((t) => t.id === transactionId);
      if (!txn) return { ok: false, reason: 'Không tìm thấy giao dịch này.' };
      return { ok: true };
    }

    default:
      return { ok: false, reason: 'Loại thao tác không được hỗ trợ.' };
  }
}
