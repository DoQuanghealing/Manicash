/* ═══ AI Money Chat — Action Command Parser (Phase 4A) ═══
 * Deterministic: phát hiện lệnh hành động + bóc payload. KHÔNG dùng LLM.
 * Trả MoneyActionRequest (pending_confirmation) hoặc null (không phải lệnh / mơ hồ).
 */

import type { MoneySnapshotV1 } from '@/lib/moneyBrain';
import { extractSlots } from '../intent/slotExtractor';
import { formatVND } from '../response/formatMoney';
import { parseMoneyAmount } from './amountParser';
import { createActionRequest } from './actionRequestBuilder';
import { BREATH_GATE_THRESHOLD, type MoneyActionRequest, type MoneyActionRiskLevel } from './actionTypes';

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|\\s)${word}(\\s|$)`).test(text);
}

/** Tín hiệu "đã thanh toán" cho MARK_BILL_PAID. */
const PAID_PHRASES = ['da dong', 'dong roi', 'da tra', 'tra roi', 'da thanh toan', 'thanh toan roi', 'dong bill', 'tra bill', 'paid'];
const PAID_WORDS = ['danh dau', 'mark'];

const INCOME_PHRASES = ['ghi thu', 'thu nhap', 'nhan luong', 'nhan duoc', 'them thu', 'duoc tra cong'];
const INCOME_WORDS = ['nhan', 'luong'];

const EXPENSE_PHRASES = ['ghi chi', 'khoan chi', 'them khoan chi'];
const EXPENSE_WORDS = ['chi', 'tieu', 'mua'];

function hasAny(text: string, phrases: string[], words: string[]): boolean {
  if (phrases.some((p) => text.includes(p))) return true;
  return words.some((w) => hasWord(text, w));
}

/** Match đúng 1 bill CHƯA đóng theo tên. Trả null nếu 0 hoặc nhiều bill. */
function matchUnpaidBill(text: string, snapshot: MoneySnapshotV1) {
  const unpaid = snapshot.bills.filter((b) => !b.isPaid);
  const matched = unpaid.filter((b) => {
    const words = fold(b.name)
      .split(/\s+/)
      .filter((w) => w.length >= 3 && w !== 'tien'); // bỏ 'tien' chung chung
    return words.some((w) => text.includes(w));
  });
  return matched.length === 1 ? matched[0] : null;
}

function expenseRisk(amount: number): MoneyActionRiskLevel {
  if (amount >= BREATH_GATE_THRESHOLD) return 'high';
  if (amount >= 500_000) return 'medium';
  return 'low';
}

export function parseActionCommand(
  rawText: string,
  snapshot: MoneySnapshotV1,
): MoneyActionRequest | null {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;
  const t = fold(rawText);
  const note = rawText.trim();

  // 1) MARK_BILL_PAID — cần tín hiệu "đã thanh toán" + match đúng 1 bill chưa đóng.
  const paidSignal = PAID_PHRASES.some((p) => t.includes(p)) || PAID_WORDS.some((w) => t.includes(w));
  if (paidSignal) {
    const bill = matchUnpaidBill(t, snapshot);
    if (bill) {
      return createActionRequest(snapshot, {
        action: 'MARK_BILL_PAID',
        payload: { billId: bill.id, billName: bill.name, amount: bill.amount, dueDay: bill.dueDay },
        preview: `Đánh dấu bill ${bill.name} ${formatVND(bill.amount)} là đã thanh toán?`,
        riskLevel: 'low',
      });
    }
    // có tín hiệu paid nhưng không khớp bill → để các nhánh dưới xử lý (có thể là chi/thu).
  }

  const amount = parseMoneyAmount(rawText);

  // 2) CREATE_INCOME — verb thu nhập + có số tiền.
  if (amount && hasAny(t, INCOME_PHRASES, INCOME_WORDS)) {
    const slots = extractSlots(rawText);
    return createActionRequest(snapshot, {
      action: 'CREATE_INCOME',
      payload: {
        amount,
        categoryId: slots.categoryId,
        categoryName: slots.categoryName,
        note,
        wallet: 'main',
      },
      preview: `Ghi thu nhập ${formatVND(amount)}?`,
      riskLevel: 'medium',
    });
  }

  // 3) CREATE_EXPENSE — verb chi tiêu + có số tiền.
  if (amount && hasAny(t, EXPENSE_PHRASES, EXPENSE_WORDS)) {
    const slots = extractSlots(rawText);
    const categoryId = slots.categoryId ?? 'other';
    const categoryName = slots.categoryName ?? 'Khác';
    return createActionRequest(snapshot, {
      action: 'CREATE_EXPENSE',
      payload: { amount, categoryId, categoryName, note, wallet: 'main' },
      preview: `Ghi khoản chi ${formatVND(amount)} vào danh mục ${categoryName}?`,
      riskLevel: expenseRisk(amount),
    });
  }

  return null;
}
