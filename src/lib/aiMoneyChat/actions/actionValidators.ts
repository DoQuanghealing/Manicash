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

    default:
      return { ok: false, reason: 'Loại thao tác không được hỗ trợ.' };
  }
}
