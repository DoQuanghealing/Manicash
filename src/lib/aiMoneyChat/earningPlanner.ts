/* ═══ Phase 14 — Earning Planner ═══
 * Local-first parser that turns a natural-language earning goal into a draft
 * EarningTask: "làm freelance thiết kế kiếm 3 triệu trong 1 tuần" →
 * { name, expectedAmount, durationDays, suggestedSubTasks }. Pure & testable;
 * the chat shows a confirmation card before anything is saved to useTaskStore.
 */

import { extractVndAmount, normalizeMoneyTextForMemory } from './parser';

export type EarningWorkType = 'freelance' | 'sales' | 'teaching' | 'writing' | 'photo' | 'service' | 'generic';

export type EarningPlanConfidence = 'high' | 'medium' | 'low';

export interface ParsedEarningPlan {
  rawText: string;
  name: string;
  expectedAmount: number | null;
  durationDays: number;
  workType: EarningWorkType;
  suggestedSubTasks: string[];
  confidence: EarningPlanConfidence;
}

const DEFAULT_DURATION_DAYS = 7;

/** Keywords (accent-stripped) that signal the user wants to PLAN earning, not log a transaction. */
const EARNING_INTENT_HINTS = [
  'kiem',
  'kiem tien',
  'freelance',
  'lam them',
  'lam theo',
  'nhan job',
  'nhan viec',
  'nhan don',
  'ke hoach kiem',
  'muc tieu kiem',
  'di lam',
  'ban hang',
  'day kem',
  'day hoc',
  'nhan show',
  'cay job',
];

interface WorkTypeRule {
  type: EarningWorkType;
  keywords: string[];
  subTasks: string[];
}

/** Accent-stripped keywords → proper Vietnamese sub-task checklist suggestions. */
const WORK_TYPE_RULES: WorkTypeRule[] = [
  {
    type: 'freelance',
    keywords: ['freelance', 'thiet ke', 'design', 'logo', 'code', 'lap trinh', 'web', 'app', 'ung dung'],
    subTasks: ['Liên hệ & chốt yêu cầu khách', 'Gửi bản nháp', 'Chỉnh sửa theo feedback', 'Giao sản phẩm cuối', 'Nhận thanh toán'],
  },
  {
    type: 'sales',
    keywords: ['ban hang', 'ban', 'shopee', 'lazada', 'tiktok', 'online', 'livestream', 'don hang'],
    subTasks: ['Chuẩn bị & chụp ảnh sản phẩm', 'Đăng listing', 'Chạy quảng cáo / livestream', 'Xử lý đơn hàng', 'Chốt doanh thu'],
  },
  {
    type: 'teaching',
    keywords: ['day', 'day kem', 'day hoc', 'gia su', 'lop', 'hoc sinh', 'tieng anh', 'khoa hoc'],
    subTasks: ['Soạn giáo trình', 'Xếp lịch với học viên', 'Dạy các buổi', 'Nhận học phí'],
  },
  {
    type: 'writing',
    keywords: ['viet', 'blog', 'bai viet', 'content', 'copywriting', 'biên tập', 'bien tap'],
    subTasks: ['Research chủ đề', 'Viết bản nháp', 'Chỉnh sửa & submit', 'Nhận nhuận bút'],
  },
  {
    type: 'photo',
    keywords: ['chup anh', 'chup', 'photo', 'quay', 'video', 'su kien', 'cuoi'],
    subTasks: ['Xác nhận lịch với khách', 'Chuẩn bị thiết bị', 'Chụp / quay', 'Chỉnh sửa & giao file', 'Nhận thanh toán'],
  },
  {
    type: 'service',
    keywords: ['dich vu', 'sua', 'lap dat', 'giao hang', 'ship', 'grab', 'xe om', 'phu', 'lam thue'],
    subTasks: ['Nhận yêu cầu / đơn', 'Thực hiện công việc', 'Bàn giao & xác nhận', 'Nhận tiền'],
  },
];

const GENERIC_SUBTASKS = ['Lập kế hoạch chi tiết', 'Bắt tay thực hiện', 'Hoàn thành & bàn giao', 'Nhận thanh toán'];

/** True when the message reads like an earning plan rather than a logged transaction. */
export function detectEarningIntent(input: string): boolean {
  const text = normalizeMoneyTextForMemory(input);
  return EARNING_INTENT_HINTS.some((hint) => text.includes(hint));
}

function detectDurationDays(text: string): number {
  const dayMatch = text.match(/(\d+)\s*ngay/);
  if (dayMatch) return clampDuration(Number(dayMatch[1]));

  const weekMatch = text.match(/(\d+)\s*tuan/);
  if (weekMatch) return clampDuration(Number(weekMatch[1]) * 7);

  const monthMatch = text.match(/(\d+)\s*thang/);
  if (monthMatch) return clampDuration(Number(monthMatch[1]) * 30);

  if (/\btuan\b/.test(text)) return 7;
  if (/\bthang\b/.test(text)) return 30;
  return DEFAULT_DURATION_DAYS;
}

function clampDuration(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_DURATION_DAYS;
  return Math.min(365, Math.round(days));
}

function detectWorkType(text: string): WorkTypeRule | null {
  let best: { rule: WorkTypeRule; score: number } | null = null;
  for (const rule of WORK_TYPE_RULES) {
    const score = rule.keywords.reduce((acc, kw) => (text.includes(kw) ? acc + 1 : acc), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { rule, score };
    }
  }
  return best?.rule ?? null;
}

function deriveName(rawText: string, workType: EarningWorkType): string {
  // Strip amount/duration noise to keep a readable task name.
  const cleaned = rawText
    .replace(/\b\d+(?:[.,]\d+)?\s*(tr|trieu|triệu|k|nghìn|nghin|ngàn|ngan)\b/gi, '')
    .replace(/\btrong\b/gi, '')
    .replace(/\b\d+\s*(ngày|ngay|tuần|tuan|tháng|thang)\b/gi, '')
    .replace(/\b(kiếm|kiem|được|duoc)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length >= 4) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  const fallback: Record<EarningWorkType, string> = {
    freelance: 'Nhận việc freelance',
    sales: 'Bán hàng online',
    teaching: 'Dạy kèm / gia sư',
    writing: 'Viết bài / content',
    photo: 'Chụp ảnh / quay video',
    service: 'Làm dịch vụ',
    generic: 'Nhiệm vụ kiếm tiền',
  };
  return fallback[workType];
}

export function parseEarningPlan(input: string): ParsedEarningPlan {
  const rawText = input.trim();
  const text = normalizeMoneyTextForMemory(input);
  const amount = extractVndAmount(input) ?? null;
  const durationDays = detectDurationDays(text);
  const matchedRule = detectWorkType(text);
  const workType = matchedRule?.type ?? 'generic';
  const suggestedSubTasks = matchedRule ? matchedRule.subTasks : GENERIC_SUBTASKS;
  const name = deriveName(rawText, workType);

  let confidence: EarningPlanConfidence = 'low';
  if (amount && matchedRule) confidence = 'high';
  else if (amount || matchedRule) confidence = 'medium';

  return {
    rawText,
    name,
    expectedAmount: amount,
    durationDays,
    workType,
    suggestedSubTasks,
    confidence,
  };
}

/** Convert a plan + chosen start date into the start/end ISO dates useTaskStore expects. */
export function buildEarningTaskDates(durationDays: number, start = new Date()): { startDate: string; endDate: string } {
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
