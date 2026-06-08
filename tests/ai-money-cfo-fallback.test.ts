/* Phase 3 — CFO deterministic fallback builder */
import { buildDeterministicCFOFallback } from '@/lib/aiMoneyChat/cfo/cfoFallback';
import { buildCFOContextPack } from '@/lib/moneyBrain/cfoContextPack';
import { validateCFOAIResponse } from '@/lib/aiMoneyChat/cfo/cfoResponseSchema';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, msg: string): void { if (!v) throw new Error(msg); }

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z';
const MK = '2026-06';

// Snapshot vùng nguy hiểm: chi > thu, bill chưa đóng, overbudget.
const DANGER: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
  wallets: { main: 2_000_000, emergency: 0, billFund: 500_000 },
  transactions: [
    { id: 'i1', type: 'income', amount: 5_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
    { id: 'e1', type: 'expense', amount: 7_000_000, categoryId: 'food', categoryName: 'Ăn uống', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
  ],
  budgets: [{ categoryId: 'food', categoryName: 'Ăn uống', monthlyLimit: 2_000_000, monthKey: MK }],
  bills: [{ id: 'b1', name: 'Tiền nhà', amount: 3_000_000, dueDay: 10, isPaid: false }],
  goals: [], tasks: [], carryOver: 0,
};

// Snapshot khỏe: thu > chi nhiều, không bill, không overbudget.
const HEALTHY: MoneySnapshotV1 = {
  ...DANGER,
  wallets: { main: 50_000_000, emergency: 30_000_000, billFund: 5_000_000 },
  transactions: [
    { id: 'i1', type: 'income', amount: 30_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
    { id: 'e1', type: 'expense', amount: 5_000_000, categoryId: 'food', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
  ],
  budgets: [{ categoryId: 'food', monthlyLimit: 8_000_000, monthKey: MK }],
  bills: [],
};

function main() {
  console.log('\nCFO fallback');

  it('fallback hợp lệ schema + actionPlan >= 3', () => {
    const fb = buildDeterministicCFOFallback(buildCFOContextPack(DANGER));
    ok(validateCFOAIResponse(fb) !== null, 'valid schema');
    ok(fb.actionPlan7Days.length >= 3, 'plan >= 3');
    ok(fb.diagnosis.length >= 1, 'diagnosis >= 1');
    ok(fb.summary.length > 0, 'summary non-empty');
  });

  it('danger: chẩn đoán nêu dòng tiền âm / bill thiếu', () => {
    const fb = buildDeterministicCFOFallback(buildCFOContextPack(DANGER));
    const joined = fb.diagnosis.join(' ') + ' ' + fb.risks.join(' ');
    ok(/âm|thiếu|vượt|chưa đóng/.test(joined), 'mentions a problem');
  });

  it('mode khác -> summary khác', () => {
    const a = buildDeterministicCFOFallback(buildCFOContextPack(DANGER)).summary;
    const b = buildDeterministicCFOFallback(buildCFOContextPack(HEALTHY)).summary;
    ok(a !== b, 'different summary by mode');
  });

  it('không bịa: chỉ diễn giải số có sẵn (fallback không throw)', () => {
    const fb = buildDeterministicCFOFallback(buildCFOContextPack(HEALTHY));
    ok(fb.opportunities.length >= 1, 'has opportunities');
  });

  console.log('\nCFO fallback test complete.');
}

main();
