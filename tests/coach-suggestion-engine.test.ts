/* TDD — suggestionEngine.ts: đề xuất chủ động Phú Vương (ưu tiên/điều kiện) */
import { generateCoachSuggestions } from '@/lib/aiMoneyChat/coach/suggestionEngine';
import type { MoneySnapshotV1, MoneyTransactionSnapshot } from '@/lib/moneyBrain';

function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // VN ngày 8
const MK = '2026-06';

function inc(amount: number): MoneyTransactionSnapshot {
  return { id: 'i' + amount, type: 'income', amount, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK };
}
function exp(amount: number, categoryId: string): MoneyTransactionSnapshot {
  return { id: 'e' + amount, type: 'expense', amount, categoryId, date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: MK };
}
function snap(o: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
    wallets: { main: 5_000_000, emergency: 0, billFund: 0 },
    transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0, ...o,
  };
}

describe('suggestionEngine — điều kiện & ưu tiên');

it('số dư âm → đề xuất "negative-safe" ưu tiên cao nhất', () => {
  const list = generateCoachSuggestions(snap({
    transactions: [inc(3_000_000)],
    budgets: [{ categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }],
    bills: [{ id: 'b', name: 'Nhà', amount: 2_000_000, dueDay: 1, isPaid: false }],
  }));
  eq(list[0].id, 'negative-safe', 'top');
});

it('bill trễ hạn → có đề xuất bill-due (điều hướng tab bills)', () => {
  const list = generateCoachSuggestions(snap({
    transactions: [inc(20_000_000)],
    bills: [{ id: 'b', name: 'Điện', amount: 500_000, dueDay: 1, isPaid: false }], // dueDay 1 < hôm nay 8
  }));
  const bill = list.find((s) => s.id === 'bill-due');
  ok(!!bill, 'có bill-due');
  eq(bill?.actionTarget, '/ledger?tab=bills');
});

it('chi vượt ngưỡng → có overspend', () => {
  const list = generateCoachSuggestions(snap({
    transactions: [inc(20_000_000), exp(3_000_000, 'food')],
    budgets: [{ categoryId: 'food', monthlyLimit: 2_000_000, monthKey: MK }],
  }));
  ok(list.some((s) => s.id === 'overspend'), 'có overspend');
});

it('không có thu tăng thêm → gợi ý no-extra-income (→ /money)', () => {
  const list = generateCoachSuggestions(snap({ transactions: [inc(20_000_000)] }));
  const s = list.find((x) => x.id === 'no-extra-income');
  ok(!!s, 'có no-extra-income');
  eq(s?.actionTarget, '/money');
});

it('streak bội số 7 → khen (positive, không action)', () => {
  const list = generateCoachSuggestions(snap({
    transactions: [inc(20_000_000)],
    tasks: [{ id: 't', name: 'Job', expectedAmount: 1_000_000, actualAmount: 1_000_000, startDate: '2026-06-01T00:00:00Z', endDate: '2026-06-30T00:00:00Z', completedAt: '2026-06-05T03:00:00Z' }],
    goals: [{ id: 'g', name: 'G', targetAmount: 10_000_000, currentAmount: 0, monthlyContributionTarget: 500_000 }],
    user: { streak: 14 },
    wallets: { main: 5_000_000, emergency: 50_000_000, billFund: 0 },
  }));
  const praise = list.find((s) => s.id === 'streak-praise');
  ok(!!praise, 'có streak-praise');
  eq(praise?.actionTarget, undefined, 'không action');
});

it('xưng hô chèn được (danh xưng)', () => {
  const list = generateCoachSuggestions(snap({ transactions: [inc(20_000_000)] }), 'cậu chủ');
  ok(list.some((s) => s.body.includes('cậu chủ')), 'chèn danh xưng');
});

if (process.exitCode) process.exit(process.exitCode);
