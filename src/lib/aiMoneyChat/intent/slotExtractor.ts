/* ═══ AI Money Chat — Slot Extractor V2 (Phase 2) ═══
 * Bóc tách slot từ câu chat thô: period / category / wallet / bill / goal /
 * task status / days. PURE — không gọi store/API, không Date.now().
 *
 * Quy ước: chỉ set field khi PHÁT HIỆN được tín hiệu rõ ràng. Field không
 * phát hiện thì BỎ QUA (undefined) để handler tự áp default theo intent.
 * Nhờ vậy câu như "tôi còn bao nhiêu tiền" trả về slots rỗng (0 key).
 */

import type { MoneyPeriod } from '@/lib/moneyBrain/dateRange';
import { normalizeCategoryId } from '@/lib/moneyBrain/normalize';
import { normalize } from './intentClassifier';
import { EXPENSE_KEYWORD_RULES } from '../categoryKeywords';

export type SlotWallet = 'main' | 'emergency' | 'bill-fund';
export type SlotTaskStatus = 'active' | 'overdue' | 'completed' | 'deleted';

export interface MoneyChatSlots {
  period?: MoneyPeriod;
  categoryId?: string;
  categoryName?: string;
  billName?: string;
  goalName?: string;
  wallet?: SlotWallet;
  days?: number;
  taskStatus?: SlotTaskStatus;
}

/** Khớp keyword theo ranh giới từ trên chuỗi đã normalize (đã fold dấu). */
function hasWord(text: string, kw: string): boolean {
  const re = new RegExp(`(^|\\s)${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  return re.test(text);
}

/** Phát hiện period CHỈ khi câu nêu rõ; không default ở đây. */
function detectExplicitPeriod(text: string): MoneyPeriod | undefined {
  if (/\bhom qua\b/.test(text)) return 'yesterday';
  if (/\bhom nay\b/.test(text)) return 'today';
  if (/\btuan nay\b/.test(text)) return 'this_week';
  if (/\bthang truoc\b/.test(text)) return 'last_month';
  if (/\bthang nay\b/.test(text)) return 'this_month';
  return undefined;
}

/** Phát hiện số ngày cho upcoming bills. "tuần tới" -> 7. */
function detectDays(text: string): number | undefined {
  if (/\btuan toi\b|\btuan sau\b/.test(text)) return 7;
  const m = text.match(/(\d+)\s*ngay/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 366) return n;
  }
  return undefined;
}

/** Ví được nhắc tới. */
function detectWallet(text: string): SlotWallet | undefined {
  if (/\bvi chinh\b|\btai khoan chinh\b/.test(text)) return 'main';
  if (/quy du phong|quy khan cap|\bdu phong\b/.test(text)) return 'emergency';
  if (/quy bill|quy tra bill|\bbill fund\b/.test(text)) return 'bill-fund';
  return undefined;
}

/** Loại bill được nhắc (tên gần đúng). */
const BILL_NAME_KEYWORDS: Array<{ label: string; kws: string[] }> = [
  { label: 'điện', kws: ['dien'] },
  { label: 'nước', kws: ['nuoc'] },
  { label: 'internet', kws: ['internet', 'wifi', 'mang'] },
  { label: 'tiền nhà', kws: ['tien nha', 'thue nha', 'nha tro', 'tien tro'] },
  { label: 'học phí', kws: ['hoc phi', 'tien hoc'] },
  { label: 'trả góp', kws: ['tra gop'] },
  { label: 'điện thoại', kws: ['dien thoai'] },
];

function detectBillName(text: string): string | undefined {
  for (const entry of BILL_NAME_KEYWORDS) {
    if (entry.kws.some((kw) => text.includes(kw))) return entry.label;
  }
  return undefined;
}

/** Tên mục tiêu được nhắc (cụm gần đúng để handler so khớp với snapshot). */
const GOAL_NAME_KEYWORDS: Array<{ label: string; kws: string[] }> = [
  { label: 'mua nhà', kws: ['mua nha'] },
  { label: 'quỹ khẩn cấp', kws: ['quy khan cap', 'khan cap'] },
  { label: 'xe', kws: ['mua xe', 'o to', 'oto', 'xe hoi'] },
  { label: 'vốn đầu tư', kws: ['von dau tu', 'dau tu'] },
];

function detectGoalName(text: string): string | undefined {
  for (const entry of GOAL_NAME_KEYWORDS) {
    if (entry.kws.some((kw) => text.includes(kw))) return entry.label;
  }
  return undefined;
}

function detectTaskStatus(text: string): SlotTaskStatus | undefined {
  if (/tre han|qua han|overdue/.test(text)) return 'overdue';
  if (/dang lam|chua xong|active|dang chay/.test(text)) return 'active';
  if (/hoan thanh|da xong|completed|xong roi/.test(text)) return 'completed';
  return undefined;
}

/**
 * Cụm "ô" danh mục hay dùng trong câu hỏi (không nằm trong keyword giao dịch).
 * Ưu tiên match trước EXPENSE_KEYWORD_RULES.
 */
const CATEGORY_DISPLAY: Array<{ id: string; name: string; kws: string[] }> = [
  { id: 'food', name: 'Ăn uống', kws: ['an uong'] },
  { id: 'coffee', name: 'Cà phê', kws: ['ca phe', 'cafe'] },
  { id: 'transport', name: 'Di chuyển', kws: ['di chuyen'] },
  { id: 'shopping', name: 'Mua sắm', kws: ['mua sam'] },
  { id: 'entertainment', name: 'Giải trí', kws: ['giai tri'] },
  { id: 'health', name: 'Sức khỏe', kws: ['suc khoe'] },
  { id: 'groceries', name: 'Đi chợ/Siêu thị', kws: ['di cho', 'sieu thi'] },
];

/** Map text -> categoryId; ưu tiên cụm "ô" danh mục, rồi EXPENSE_KEYWORD_RULES (keyword DÀI NHẤT). */
function detectCategory(text: string): { categoryId: string; categoryName: string } | undefined {
  // 1) Cụm ô danh mục.
  for (const c of CATEGORY_DISPLAY) {
    if (c.kws.some((kw) => hasWord(text, kw))) {
      return { categoryId: normalizeCategoryId(c.id) ?? c.id, categoryName: c.name };
    }
  }
  // 2) Keyword giao dịch chi tiết.
  let best: { categoryId: string; categoryName: string; len: number } | undefined;
  for (const rule of EXPENSE_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (kw.length < 2) continue;
      if (hasWord(text, kw) && (!best || kw.length > best.len)) {
        best = { categoryId: rule.categoryId, categoryName: rule.categoryName, len: kw.length };
      }
    }
  }
  if (!best) return undefined;
  return {
    categoryId: normalizeCategoryId(best.categoryId) ?? best.categoryId,
    categoryName: best.categoryName,
  };
}

/** Bóc toàn bộ slot từ câu thô. Luôn trả object (có thể rỗng). */
export function extractSlots(rawText: string): MoneyChatSlots {
  const text = normalize(typeof rawText === 'string' ? rawText : '');
  const slots: MoneyChatSlots = {};
  if (!text) return slots;

  const period = detectExplicitPeriod(text);
  if (period) slots.period = period;

  const days = detectDays(text);
  if (days !== undefined) slots.days = days;

  const wallet = detectWallet(text);
  if (wallet) slots.wallet = wallet;

  // Loại cụm "ngan sach" (ngân sách) trước khi dò danh mục — tránh 'sach' (sách)
  // bị nhận nhầm là danh mục Học tập.
  const cat = detectCategory(text.replace(/ngan sach/g, ' '));
  if (cat) {
    slots.categoryId = cat.categoryId;
    slots.categoryName = cat.categoryName;
  }

  const billName = detectBillName(text);
  if (billName) slots.billName = billName;

  const goalName = detectGoalName(text);
  if (goalName) slots.goalName = goalName;

  const taskStatus = detectTaskStatus(text);
  if (taskStatus) slots.taskStatus = taskStatus;

  return slots;
}
