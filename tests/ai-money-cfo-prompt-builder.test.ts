/* Phase 3 — CFO prompt builder: number guard + JSON-only + no raw transactions */
import { buildCFOSystemPrompt, buildCFOUserPrompt } from '@/lib/aiMoneyChat/cfo/cfoPromptBuilder';
import { buildCFOContextPack } from '@/lib/moneyBrain/cfoContextPack';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function inc(h: string, n: string): void { if (!h.includes(n)) throw new Error(`expected to include "${n}"`); }
function noinc(h: string, n: string): void { if (h.includes(n)) throw new Error(`should NOT include "${n}"`); }

const SNAP: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-08T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 1_000_000 },
  transactions: [
    { id: 'i1', type: 'income', amount: 20_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
    { id: 'e1', type: 'expense', amount: 2_000_000, categoryId: 'food', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: '2026-06' },
  ],
  budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
};

function main() {
  console.log('\nCFO prompt builder');
  const sys = buildCFOSystemPrompt();
  const user = buildCFOUserPrompt(buildCFOContextPack(SNAP));

  it('system: cấm AI tự tạo số', () => inc(sys, 'Không tự tạo số liệu'));
  it('system: không sửa healthScore', () => inc(sys, 'Không sửa healthScore'));
  it('system: yêu cầu JSON schema', () => {
    inc(sys, 'actionPlan7Days');
    inc(sys, 'JSON');
  });
  it('user: chứa context version', () => inc(user, 'cfo_context_v1'));
  it('user: yêu cầu JSON only', () => inc(user, 'JSON'));
  it('user: KHÔNG chứa danh sách transaction thô', () => noinc(user, '"transactions"'));

  console.log('\nCFO prompt builder test complete.');
}

main();
