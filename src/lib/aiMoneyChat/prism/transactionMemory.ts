/* ═══ PRISM (Lõi Kim Cương) — Trí nhớ giao dịch lặp lại (P3) ═══
 *
 * Học các giao dịch user ghi đi ghi lại (vd "cà phê 30k" mỗi sáng) để gợi ý
 * GHI NHANH 1 chạm. Khác `useAiMoneyMemoryStore` (chỉ học keyword -> danh mục):
 * ở đây nhớ thêm SỐ TIỀN hay dùng + TẦN SUẤT để dựng chip ghi nhanh.
 *
 * Thuần (pure) — store chỉ là lớp persist mỏng bọc các hàm này. Offline 100%.
 */

import { normalizeMoneyTextForMemory } from '../parser';
import type { TxnType } from '@/stores/useFinanceStore';

export type HabitTxnType = Exclude<TxnType, 'transfer'>;

export interface TransactionHabit {
  /** Khóa dedup: keyword đã chuẩn hóa (ascii fold, bỏ số tiền). */
  keyword: string;
  /** Nhãn hiển thị (giữ dấu, đã bỏ phần số tiền). */
  label: string;
  type: HabitTxnType;
  categoryId: string;
  /** Số tiền hay dùng nhất (mode của recentAmounts). */
  typicalAmount: number;
  /** Vài số tiền gần nhất để tính mode (cap). */
  recentAmounts: number[];
  count: number;
  lastUsedAt: string; // ISO
}

export interface RecordHabitInput {
  /** note hoặc rawText user nhập (có dấu). */
  text: string;
  type: TxnType;
  categoryId: string;
  amount: number;
}

const MAX_HABITS = 60;
const MAX_AMOUNTS = 12;

function stripAmountTokens(text: string): string {
  return text
    // suffix kèm slang VN: "5tr2" (=5.2tr), "5k5" (=5500), "30k5" -> cho phép 0-2 số đuôi.
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:k|nghin|ngan|tr|trieu|m)\d{0,2}\b/gi, ' ')
    .replace(/\b\d{1,3}(?:[.,]\d{3}){1,3}\b/g, ' ')
    .replace(/\b\d{4,12}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bỏ dấu câu lạc (dính lại sau khi cắt số tiền) + gọn khoảng trắng. */
function tidyPunctuation(text: string): string {
  return text
    .replace(/\s+([.,!?;:])/g, '$1') // dán dấu vào từ trước
    .replace(/[.,!?;:]+/g, ' ') // bỏ dấu câu còn sót
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nhãn hiển thị: bỏ số tiền + dấu câu lạc, gọn khoảng trắng, cắt ngắn (giữ dấu tiếng Việt). */
export function habitLabel(text: string): string {
  const cleaned = tidyPunctuation(stripAmountTokens(text));
  if (cleaned.length <= 28) return cleaned;
  return `${cleaned.slice(0, 28).trim()}…`;
}

/** Khóa keyword chuẩn hóa (ascii fold, KHÔNG còn dấu câu) để dedup ổn định. */
export function habitKeyword(text: string): string {
  return normalizeMoneyTextForMemory(stripAmountTokens(text))
    .replace(/[^a-z0-9\s]/g, ' ') // bỏ '.'/',' lạc mà normalizeText giữ lại
    .replace(/\s+/g, ' ')
    .trim();
}

/** Số tiền hay dùng nhất (mode); hòa -> số mới nhất (duyệt từ cuối). */
export function typicalAmount(amounts: number[]): number {
  if (amounts.length === 0) return 0;
  const freq = new Map<number, number>();
  let best = amounts[amounts.length - 1];
  let bestScore = -1;
  for (let i = amounts.length - 1; i >= 0; i--) {
    const a = amounts[i];
    const c = (freq.get(a) ?? 0) + 1;
    freq.set(a, c);
    if (c > bestScore) {
      bestScore = c;
      best = a;
    }
  }
  return best;
}

/** Ghi nhận 1 giao dịch -> trả mảng habits MỚI (upsert, không mutate input). */
export function recordHabit(
  habits: TransactionHabit[],
  input: RecordHabitInput,
  nowIso: string,
): TransactionHabit[] {
  if (input.type === 'transfer') return habits;
  if (!Number.isFinite(input.amount) || input.amount <= 0) return habits;

  const keyword = habitKeyword(input.text);
  if (!keyword) return habits;
  const type = input.type as HabitTxnType;
  const label = habitLabel(input.text) || keyword;

  const idx = habits.findIndex(
    (h) => h.keyword === keyword && h.type === type && h.categoryId === input.categoryId,
  );

  if (idx >= 0) {
    const existing = habits[idx];
    const recentAmounts = [...existing.recentAmounts, input.amount].slice(-MAX_AMOUNTS);
    const updated: TransactionHabit = {
      ...existing,
      label, // cập nhật nhãn theo lần ghi gần nhất
      recentAmounts,
      typicalAmount: typicalAmount(recentAmounts),
      count: existing.count + 1,
      lastUsedAt: nowIso,
    };
    // upsert + đưa lên đầu
    return [updated, ...habits.slice(0, idx), ...habits.slice(idx + 1)].slice(0, MAX_HABITS);
  }

  const fresh: TransactionHabit = {
    keyword,
    label,
    type,
    categoryId: input.categoryId,
    typicalAmount: input.amount,
    recentAmounts: [input.amount],
    count: 1,
    lastUsedAt: nowIso,
  };
  return [fresh, ...habits].slice(0, MAX_HABITS);
}

export interface TopHabitsOptions {
  limit?: number;
  /** Số lần tối thiểu để coi là "thói quen" (tránh nhiễu lần đầu). */
  minCount?: number;
  /** Lọc theo loại (mặc định cả hai). */
  type?: HabitTxnType;
}

/** Top giao dịch lặp lại để gợi ý ghi nhanh. Xếp theo count desc, rồi mới nhất. */
export function topHabits(
  habits: TransactionHabit[],
  opts: TopHabitsOptions = {},
): TransactionHabit[] {
  const { limit = 4, minCount = 2, type } = opts;
  return habits
    .filter((h) => h.count >= minCount && (!type || h.type === type))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    })
    .slice(0, limit);
}
