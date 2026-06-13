/* ═══ AI Money Chat — Action Command Parser (Phase 4A) ═══
 * Deterministic: phát hiện lệnh hành động + bóc payload. KHÔNG dùng LLM.
 * Trả MoneyActionRequest (pending_confirmation) hoặc null (không phải lệnh / mơ hồ).
 */

import type { MoneySnapshotV1, MoneyGoalSnapshot, MoneyTaskSnapshot, MoneyTransactionSnapshot } from '@/lib/moneyBrain';
import { getTodayKey } from '@/lib/moneyBrain';
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Phase 4B helpers ──────────────────────────────────────────────────────

/** Ngày đến hạn bill: "hạn ngày 12" / "ngày 10" / "mùng 5". */
function detectDueDay(text: string): number | null {
  const m = text.match(/(?:han\s*)?(?:ngay|mung)\s*(\d{1,2})/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  return d >= 1 && d <= 31 ? d : null;
}

/** endDate dạng DD/MM hoặc DD-MM (+/năm) -> 'YYYY-MM-DD' theo năm clientNow. */
function detectEndDateISO(text: string, snapshot: MoneySnapshotV1): string | null {
  const m = text.match(/(\d{1,2})\s*[/\-]\s*(\d{1,2})(?:\s*[/\-]\s*(\d{2,4}))?/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const todayKey = getTodayKey(snapshot.clientNow, snapshot.timezone);
  let year = parseInt(todayKey.slice(0, 4), 10);
  if (m[3]) {
    const y = parseInt(m[3], 10);
    year = y < 100 ? 2000 + y : y;
  }
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const BILL_NAMES: Array<{ name: string; kws: string[] }> = [
  { name: 'Internet', kws: ['internet', 'wifi'] },
  { name: 'Tiền nhà', kws: ['tien nha', 'thue nha', 'nha tro'] },
  { name: 'Tiền điện', kws: ['tien dien', 'dien'] },
  { name: 'Tiền nước', kws: ['tien nuoc', 'nuoc'] },
  { name: 'Học phí', kws: ['hoc phi'] },
  { name: 'Trả góp', kws: ['tra gop'] },
];

function detectBillName(text: string): string | null {
  for (const b of BILL_NAMES) {
    if (b.kws.some((kw) => text.includes(kw))) return b.name;
  }
  return null;
}

/** Match đúng 1 goal theo tên (token >= 3). Null nếu 0 hoặc nhiều. */
function matchGoal(text: string, snapshot: MoneySnapshotV1): MoneyGoalSnapshot | null {
  const matched = snapshot.goals.filter((g) => {
    const words = fold(g.name).split(/\s+/).filter((w) => w.length >= 3);
    return words.some((w) => text.includes(w));
  });
  return matched.length === 1 ? matched[0] : null;
}

/** Match đúng 1 task chưa hoàn thành/xóa theo tên. Null nếu 0 hoặc nhiều. */
function matchActiveTask(text: string, snapshot: MoneySnapshotV1): MoneyTaskSnapshot | null {
  const open = snapshot.tasks.filter((t) => !t.completedAt && !t.deletedAt);
  const matched = open.filter((t) => {
    const words = fold(t.name).split(/\s+/).filter((w) => w.length >= 3);
    return words.some((w) => text.includes(w));
  });
  return matched.length === 1 ? matched[0] : null;
}

/** Match đúng 1 giao dịch theo amount / category / hôm nay. Null nếu 0 hoặc nhiều. */
function matchUniqueTransaction(
  text: string,
  snapshot: MoneySnapshotV1,
  amount: number | null,
  categoryId: string | undefined,
): MoneyTransactionSnapshot | null {
  const todayOnly = /\bhom nay\b/.test(text);
  const todayKey = getTodayKey(snapshot.clientNow, snapshot.timezone);
  let pool = snapshot.transactions.filter((t) => t.type === 'expense');
  if (amount) pool = pool.filter((t) => t.amount === amount);
  if (categoryId) pool = pool.filter((t) => t.categoryId === categoryId);
  if (todayOnly) pool = pool.filter((t) => t.dateKey === todayKey);
  // Cần ít nhất 1 tiêu chí để tránh match bừa.
  if (!amount && !categoryId && !todayOnly) return null;
  return pool.length === 1 ? pool[0] : null;
}

/** Dọn tên (giữ nguyên dấu): bỏ verb/keyword/amount/ngày. */
function stripForName(raw: string, removePhrases: string[]): string {
  let s = raw;
  for (const p of removePhrases) {
    s = s.replace(new RegExp(p, 'gi'), ' ');
  }
  // bỏ cụm số tiền
  s = s.replace(/\d+(?:[.,]\d+)?\s*(?:triệu|trieu|tr\d?|nghìn|nghin|ngàn|ngan|k)\b/gi, ' ');
  s = s.replace(/\d{1,3}(?:[.,]\d{3})+/g, ' ');
  // bỏ ngày DD/MM
  s = s.replace(/(?:hạn|han|đến|den)?\s*\d{1,2}\s*[/\-]\s*\d{1,2}(?:\s*[/\-]\s*\d{2,4})?/gi, ' ');
  s = s.replace(/\d{4,}/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const BUDGET_SIGNALS = ['ngan sach', 'budget', 'gioi han', 'han muc'];
const DEPOSIT_PHRASES = ['nap', 'chuyen'];
const COMPLETE_SIGNALS = ['hoan thanh', 'hoan tat', 'xong'];
const TASK_CREATE_WORDS = ['task', 'nhiem vu', 'viec'];
const WISHLIST_SIGNALS = ['wishlist', 'danh sach muon mua', 'muon mua'];
const FLAG_SIGNALS = ['gan co', 'flag'];

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
  const slots = extractSlots(rawText);

  // ─── Phase 4B (chạy TRƯỚC income/expense để verb 'mua'/'them' không nuốt nhầm) ───

  // CREATE_FIXED_BILL — "thêm bill internet 250k hạn ngày 12".
  if ((t.includes('bill') || t.includes('hoa don')) && hasAny(t, [], ['them', 'tao'])) {
    const billName = detectBillName(t);
    const dueDay = detectDueDay(t);
    if (billName && dueDay && amount) {
      return createActionRequest(snapshot, {
        action: 'CREATE_FIXED_BILL',
        payload: { name: billName, amount, dueDay },
        preview: `Tạo bill ${billName} ${formatVND(amount)}, hạn ngày ${dueDay} mỗi tháng?`,
        riskLevel: 'medium',
      });
    }
  }

  // SET_CATEGORY_BUDGET — "đặt ngân sách ăn uống 3 triệu".
  if (BUDGET_SIGNALS.some((s) => t.includes(s)) && amount && slots.categoryId) {
    return createActionRequest(snapshot, {
      action: 'SET_CATEGORY_BUDGET',
      payload: { categoryId: slots.categoryId, categoryName: slots.categoryName, monthlyLimit: amount },
      preview: `Đặt ngân sách ${slots.categoryName ?? slots.categoryId} tháng này là ${formatVND(amount)}?`,
      riskLevel: 'medium',
    });
  }

  // ADD_GOAL_DEPOSIT — "nạp 2 triệu vào quỹ khẩn cấp".
  if (amount && (DEPOSIT_PHRASES.some((p) => t.includes(p)) || (t.includes('them') && t.includes('vao')))) {
    const goal = matchGoal(t, snapshot);
    if (goal) {
      return createActionRequest(snapshot, {
        action: 'ADD_GOAL_DEPOSIT',
        payload: { goalId: goal.id, goalName: goal.name, amount, note },
        preview: `Nạp ${formatVND(amount)} vào mục tiêu ${goal.name}?`,
        riskLevel: 'medium',
      });
    }
  }

  // COMPLETE_EARNING_TASK — "hoàn thành task dạy kèm" (actualAmount optional).
  if (COMPLETE_SIGNALS.some((s) => t.includes(s)) && (t.includes('task') || t.includes('nhiem vu') || t.includes('viec'))) {
    const task = matchActiveTask(t, snapshot);
    if (task) {
      return createActionRequest(snapshot, {
        action: 'COMPLETE_EARNING_TASK',
        payload: { taskId: task.id, taskName: task.name, expectedAmount: task.expectedAmount, actualAmount: amount ?? undefined },
        preview: `Đánh dấu task ${task.name} là hoàn thành?`,
        riskLevel: 'medium',
      });
    }
  }

  // CREATE_EARNING_TASK — "tạo task freelance logo 3 triệu hạn 20/6".
  if (hasAny(t, [], ['tao', 'them']) && TASK_CREATE_WORDS.some((w) => t.includes(w)) && amount) {
    const endDate = detectEndDateISO(t, snapshot);
    if (endDate) {
      const name = stripForName(rawText, ['tạo', 'thêm', 'tao', 'them', 'task', 'nhiệm vụ', 'nhiem vu', 'việc', 'viec', 'kiếm tiền', 'kiem tien', 'kỳ vọng', 'ky vong']);
      if (name) {
        const [y, m, d] = endDate.split('-');
        return createActionRequest(snapshot, {
          action: 'CREATE_EARNING_TASK',
          payload: { name, expectedAmount: amount, endDate, startDate: getTodayKey(snapshot.clientNow, snapshot.timezone) },
          preview: `Tạo nhiệm vụ kiếm tiền “${name}” kỳ vọng ${formatVND(amount)}, hạn ${d}/${m}/${y}?`,
          riskLevel: 'medium',
        });
      }
    }
  }

  // ADD_WISHLIST_ITEM — "thêm iphone vào wishlist 20 triệu".
  if (WISHLIST_SIGNALS.some((s) => t.includes(s))) {
    const name = stripForName(rawText, ['thêm', 'đưa', 'cho', 'them', 'dua', 'vào wishlist', 'vao wishlist', 'wishlist', 'vào danh sách muốn mua', 'vao danh sach muon mua', 'danh sách muốn mua', 'danh sach muon mua', 'muốn mua', 'muon mua', 'vào', 'vao']);
    if (name) {
      return createActionRequest(snapshot, {
        action: 'ADD_WISHLIST_ITEM',
        payload: { name, expectedPrice: amount ?? undefined, cooldownHours: 48 },
        preview: `Đưa ${name} vào wishlist và khóa mua trong 48 giờ?`,
        riskLevel: 'low',
      });
    }
  }

  // FLAG_TRANSACTION — "gắn cờ giao dịch quần áo hôm nay" (không cần amount).
  if (FLAG_SIGNALS.some((s) => t.includes(s)) || (PAID_WORDS.some((w) => t.includes(w)) && (t.includes('chu y') || t.includes('giao dich') || t.includes('khoan')))) {
    const txn = matchUniqueTransaction(t, snapshot, amount, slots.categoryId);
    if (txn) {
      const catName = txn.categoryName ?? slots.categoryName ?? txn.categoryId ?? 'giao dịch';
      return createActionRequest(snapshot, {
        action: 'FLAG_TRANSACTION',
        payload: {
          transactionId: txn.id,
          amount: txn.amount,
          categoryId: txn.categoryId,
          categoryName: txn.categoryName,
          note: txn.note,
          dateKey: txn.dateKey,
        },
        preview: `Gắn cờ giao dịch ${catName} ${formatVND(txn.amount)}?`,
        riskLevel: 'low',
      });
    }
  }

  // 2) CREATE_INCOME — verb thu nhập + có số tiền.
  if (amount && hasAny(t, INCOME_PHRASES, INCOME_WORDS)) {
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
