/* PRISM P4 — Người Gác (proactive guardian).
 * Kiểm: vượt ngân sách -> danh sách cảnh báo danger; bill sắp hạn -> alert bills;
 * tình hình lành mạnh -> ít/không cảnh báo; idle -> alert info; limit + xếp hạng. */
import { toMoneySnapshotV1 } from '@/lib/moneyBrain';
import { detectGuardianAlerts } from '@/lib/aiMoneyChat/prism/guardian';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';

type Fn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: Fn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${String(b)}, got ${String(a)}`);
}
function ok(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // 10:00 VN ngày 08/06/2026
const MK = '2026-06';

// Snapshot "có vấn đề": food + shopping vượt ngân sách, bill Tiền nhà tới hạn ngày 10 (trong 3 ngày).
const TROUBLE: ClientSnapshotInput = {
  version: 'money_snapshot_v1',
  clientNow: CLIENT_NOW,
  timezone: VN,
  monthKey: MK,
  carryOver: 0,
  wallets: { main: 8_000_000, emergency: 2_000_000, billFund: 500_000 },
  transactions: [
    { type: 'income', amount: 20_000_000, categoryId: 'salary', dateKey: '2026-06-01', monthKey: MK, weekKey: '2026-W23', date: '2026-06-01T03:00:00Z' },
    { type: 'expense', amount: 2_400_000, categoryId: 'food', categoryName: 'Ăn uống', dateKey: '2026-06-02', monthKey: MK, weekKey: '2026-W23', date: '2026-06-02T03:00:00Z' },
    { type: 'expense', amount: 1_800_000, categoryId: 'shopping', categoryName: 'Mua sắm', dateKey: '2026-06-03', monthKey: MK, weekKey: '2026-W23', date: '2026-06-03T03:00:00Z' },
  ],
  budgets: [
    { categoryId: 'food', name: 'Ăn uống', limit: 2_000_000 },
    { categoryId: 'shopping', name: 'Mua sắm', limit: 1_500_000 },
  ],
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 4, isPaid: true },
    { id: 'b2', name: 'Tiền nhà', amount: 2_500_000, dueDay: 10, isPaid: false },
  ],
};

// Snapshot lành mạnh: dư dả, không ngân sách, không bill.
const HEALTHY: ClientSnapshotInput = {
  version: 'money_snapshot_v1',
  clientNow: CLIENT_NOW,
  timezone: VN,
  monthKey: MK,
  carryOver: 0,
  wallets: { main: 50_000_000, emergency: 30_000_000, billFund: 0 },
  transactions: [
    { type: 'income', amount: 30_000_000, categoryId: 'salary', dateKey: '2026-06-01', monthKey: MK, weekKey: '2026-W23', date: '2026-06-01T03:00:00Z' },
  ],
};

describe('detectGuardianAlerts — snapshot có vấn đề');
it('có cảnh báo vượt ngân sách (danger)', () => {
  const alerts = detectGuardianAlerts(toMoneySnapshotV1(TROUBLE));
  ok(alerts.length >= 1, 'phải có cảnh báo');
  ok(alerts.some((a) => a.id.startsWith('budget:') && a.severity === 'danger'), 'cần budget danger');
});
it('có cảnh báo bill sắp tới hạn', () => {
  const alerts = detectGuardianAlerts(toMoneySnapshotV1(TROUBLE), { limit: 5 });
  ok(alerts.some((a) => a.id === 'bills'), 'cần alert bills');
});
it('danger xếp trước warn', () => {
  const alerts = detectGuardianAlerts(toMoneySnapshotV1(TROUBLE), { limit: 5 });
  const firstWarnIdx = alerts.findIndex((a) => a.severity === 'warn');
  const lastDangerIdx = alerts.map((a) => a.severity).lastIndexOf('danger');
  if (firstWarnIdx !== -1 && lastDangerIdx !== -1) ok(lastDangerIdx < firstWarnIdx, 'danger trước warn');
});
it('limit cắt số cảnh báo', () => {
  const alerts = detectGuardianAlerts(toMoneySnapshotV1(TROUBLE), { limit: 2 });
  ok(alerts.length <= 2, 'tôn trọng limit');
});

describe('detectGuardianAlerts — lành mạnh + idle');
it('lành mạnh -> không cảnh báo tiền', () => {
  const alerts = detectGuardianAlerts(toMoneySnapshotV1(HEALTHY));
  eq(alerts.filter((a) => a.id !== 'idle').length, 0, 'không alert tiền');
});
it('idle >= 3 ngày -> alert info', () => {
  const alerts = detectGuardianAlerts(toMoneySnapshotV1(HEALTHY), { idleDays: 5 });
  ok(alerts.some((a) => a.id === 'idle' && a.severity === 'info'), 'cần idle alert');
});
it('idle < 3 ngày -> không idle', () => {
  const alerts = detectGuardianAlerts(toMoneySnapshotV1(HEALTHY), { idleDays: 1 });
  ok(!alerts.some((a) => a.id === 'idle'), 'không idle');
});

if (process.exitCode) process.exit(process.exitCode);
