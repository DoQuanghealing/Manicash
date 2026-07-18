/* ═══ Care Companion — Engine trigger (Cấp 3 · 0đ) ═══
 * PURE + deterministic. Đọc MoneySnapshotV1 (+ đồng hồ client) → kịch bản nào NỔ.
 * Trả danh sách đã xếp ưu tiên; component chỉ hiện kịch bản đầu chưa trong cooldown.
 *
 * NGUYÊN TẮC (tránh vết xe P4 báo động giả): mọi trigger đều CÓ ĐIỀU KIỆN DỮ LIỆU —
 * tài khoản trống (chưa ghi gì, chưa có bill/goal/task) KHÔNG nổ bất kỳ kịch bản nào.
 */

import type { MoneySnapshotV1, MoneyTransactionSnapshot } from '@/lib/moneyBrain/types';
import { getTodayKey, getISOWeekKey } from '@/lib/moneyBrain/dateRange';
import {
  buildCareScript,
  type CareScript,
  type CareContentInput,
} from './careScripts';

/** Danh mục "chi đêm khuya vì buồn" cho sad-guard (canonical id, xem taxonomy.ts). */
const SAD_CATEGORIES = new Set(['food', 'coffee', 'entertain']);
/** Danh mục thu nhập coi như "ngày lương" cho payday-guard. */
const PAYDAY_CATEGORIES = new Set(['salary', 'bonus']);

const BILL_OVERDUE_DAYS = 2;
const GHOST_MIN_DAYS = 3;
const COMEBACK_DAYS = 7;
const TASK_LATE_DAYS = 3;
const PAYDAY_WINDOW_DAYS = 2;
const PAYDAY_SPENT_PCT = 30;
const STREAK_MIN = 5;

/* ─────────── Date helpers (thuần, không phụ thuộc timezone runtime) ─────────── */

/** dateKey "YYYY-MM-DD" → mốc UTC (ms) để trừ ngày lịch ổn định. */
function dateKeyToUTC(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Số ngày lịch từ fromKey đến toKey (toKey - fromKey). */
function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dateKeyToUTC(toKey) - dateKeyToUTC(fromKey)) / 86_400_000);
}

/** Giờ (0–23) + thứ (0=CN..6=T7) theo timezone client — pure qua Intl. */
function clientHourWeekday(clientNow: string, timezone: string): { hour: number; weekday: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
      weekday: 'short',
    }).formatToParts(new Date(clientNow));
    const hourRaw = parts.find((p) => p.type === 'hour')?.value ?? '0';
    const hour = Number(hourRaw) % 24; // '24' → 0 ở một số môi trường
    const wdName = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { hour: Number.isFinite(hour) ? hour : 0, weekday: map[wdName] ?? 0 };
  } catch {
    return { hour: 0, weekday: 0 };
  }
}

/** "HH:mm" → giờ số (0–23), hoặc null nếu thiếu/hỏng. */
function parseHour(time: string | undefined): number | null {
  if (!time) return null;
  const h = Number(time.split(':')[0]);
  return Number.isFinite(h) ? h : null;
}

/* ─────────── Engine ─────────── */

export function generateCareScripts(snapshot: MoneySnapshotV1, addr = 'ngài'): CareScript[] {
  const out: CareScript[] = [];
  const push = (id: Parameters<typeof buildCareScript>[0], input: Partial<CareContentInput> = {}) =>
    out.push(buildCareScript(id, { addr, ...input }));

  const todayKey = getTodayKey(snapshot.clientNow, snapshot.timezone);
  const todayDay = Number(todayKey.split('-')[2]);
  const { hour, weekday } = clientHourWeekday(snapshot.clientNow, snapshot.timezone);
  const txns = snapshot.transactions;
  const hasHistory = txns.length > 0;

  const todayTxns = txns.filter((t) => t.dateKey === todayKey);
  const loggedToday = todayTxns.length > 0;

  // Ngày ghi chép gần nhất (dateKey lớn nhất) → khoảng vắng.
  const lastDateKey = hasHistory
    ? txns.reduce((max, t) => (t.dateKey > max ? t.dateKey : max), txns[0].dateKey)
    : null;
  const daysAway = lastDateKey ? daysBetween(lastDateKey, todayKey) : 0;

  const streak = snapshot.user?.streak ?? 0;

  // ── comeback: quay lại sau ≥7 ngày vắng (ưu tiên cao — chào ấm trước) ──
  if (hasHistory && daysAway >= COMEBACK_DAYS) {
    push('comeback', { daysAway });
  }

  // ── bill-mosquito: bill quá hạn ≥2 ngày ──
  const overdueBill = snapshot.bills
    .filter((b) => !b.isPaid && todayDay - b.dueDay >= BILL_OVERDUE_DAYS)
    .sort((a, b) => b.amount - a.amount)[0];
  if (overdueBill) {
    push('bill-mosquito', { billName: overdueBill.name, billAmount: overdueBill.amount });
  }

  // ── ghost-3d: 3–6 ngày không ghi (dưới ngưỡng comeback) ──
  if (hasHistory && daysAway >= GHOST_MIN_DAYS && daysAway < COMEBACK_DAYS) {
    push('ghost-3d', { daysAway });
  }

  // ── payday-guard: ≤48h sau lương đã tiêu >30% ──
  const paydayTxn = txns
    .filter((t) => t.type === 'income' && PAYDAY_CATEGORIES.has(t.categoryId ?? ''))
    .filter((t) => daysBetween(t.dateKey, todayKey) <= PAYDAY_WINDOW_DAYS && t.dateKey <= todayKey)
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))[0];
  if (paydayTxn && paydayTxn.amount > 0) {
    const spentSince = txns
      .filter((t) => t.type === 'expense' && t.dateKey >= paydayTxn.dateKey)
      .reduce((s, t) => s + t.amount, 0);
    const pct = Math.round((spentSince / paydayTxn.amount) * 100);
    if (pct > PAYDAY_SPENT_PCT) push('payday-guard', { spentPct: pct });
  }

  // ── streak-save: 23h chưa ghi hôm nay, streak ≥5 sắp gãy ──
  if (hour >= 23 && !loggedToday && streak >= STREAK_MIN) {
    push('streak-save', { streak });
  }

  // ── sad-guard: chi ăn uống/giải trí sau 22h (hôm nay) ──
  const sadTxn = todayTxns.find(
    (t) => t.type === 'expense' && SAD_CATEGORIES.has(t.categoryId ?? '') && (parseHour(t.time) ?? -1) >= 22,
  );
  if (sadTxn) push('sad-guard');

  // ── task-nudge: nhiệm vụ kiếm tiền trễ ≥3 ngày ──
  const lateTask = snapshot.tasks
    .filter((t) => !t.completedAt && !t.deletedAt && t.endDate)
    .map((t) => ({ t, late: daysBetween(t.endDate.slice(0, 10), todayKey) }))
    .filter((x) => x.late >= TASK_LATE_DAYS)
    .sort((a, b) => b.late - a.late)[0];
  if (lateTask) {
    push('task-nudge', { taskName: lateTask.t.name, taskLateDays: lateTask.late });
  }

  // ── night-owl: ghi chi tiêu sau 0h (giao dịch hôm nay lúc 0–4h) ──
  const nightTxn = todayTxns.find((t) => {
    const h = parseHour(t.time);
    return t.type === 'expense' && h !== null && h < 5;
  });
  if (nightTxn) push('night-owl');

  // ── goal-cheer: mục tiêu chạm mốc 50% (băng [50%, 60%) để không nổ mãi) ──
  const cheerGoal = snapshot.goals.find((g) => {
    if (g.targetAmount <= 0) return false;
    const pct = (g.currentAmount / g.targetAmount) * 100;
    return pct >= 50 && pct < 60;
  });
  if (cheerGoal) push('goal-cheer', { goalName: cheerGoal.name });

  // ── sunday-report: chủ nhật 19–21h (cần có hoạt động trong lịch sử) ──
  if (hasHistory && weekday === 0 && hour >= 19 && hour <= 21) {
    const weekKey = getISOWeekKey(snapshot.clientNow, snapshot.timezone);
    const week = txns.filter((t) => t.weekKey === weekKey);
    const weekIncome = sumBy(week, 'income');
    const weekExpense = sumBy(week, 'expense');
    push('sunday-report', { weekIncome, weekExpense });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

function sumBy(txns: MoneyTransactionSnapshot[], type: 'income' | 'expense'): number {
  return txns.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}
