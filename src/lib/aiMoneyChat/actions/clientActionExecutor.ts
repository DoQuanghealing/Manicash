/* ═══ AI Money Chat — Client Action Executor (Phase 4A) ═══
 * CLIENT-ONLY. Đây là NƠI DUY NHẤT được phép gọi Zustand action sau khi user confirm.
 * Re-validate state hiện tại trước khi execute (tránh stale request).
 * Expense >= BreathGate threshold KHÔNG được execute trực tiếp.
 */
'use client';

import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatVND } from '../response/formatMoney';
import { BREATH_GATE_THRESHOLD, type MoneyActionRequest } from './actionTypes';

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

    default:
      return { ok: false, message: 'Loại thao tác không được hỗ trợ.' };
  }
}
