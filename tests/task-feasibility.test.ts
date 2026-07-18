/* ═══ Task Eval — deterministic feasibility (T5) ═══
 * PURE: computeTaskFeasibility đọc task + lịch sử + đồng hồ client → điểm 0–100.
 * Chốt: đúng subtask/pace/lịch sử; quá hạn bị phạt; hoàn thành = 100; user mới trung tính.
 */
import {
  computeTaskFeasibility,
  computeHistoricalCompletionRate,
} from '@/lib/aiMoneyChat/taskEval/taskFeasibility';
import type { MoneyTaskSnapshot } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const NOW = '2026-07-15T12:00:00Z';

function task(o: Partial<MoneyTaskSnapshot> & { id: string }): MoneyTaskSnapshot {
  return {
    id: o.id,
    name: o.name ?? 'Freelance',
    expectedAmount: o.expectedAmount ?? 3_000_000,
    actualAmount: o.actualAmount,
    startDate: o.startDate ?? '2026-07-10',
    endDate: o.endDate ?? '2026-07-20',
    completedAt: o.completedAt,
    deletedAt: o.deletedAt,
    subTasks: o.subTasks ?? [],
  };
}
const sub = (n: number, done: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, isCompleted: i < done }));

console.log('\nTask feasibility — điểm deterministic');

it('hoàn thành → 100 bất kể pace', () => {
  const r = computeTaskFeasibility(task({ id: 't', completedAt: '2026-07-14', subTasks: sub(5, 2) }), [], NOW);
  eq(r.score, 100);
});

it('đúng pace (3/5 done, giữa kỳ) → điểm khá + onPace', () => {
  const r = computeTaskFeasibility(task({ id: 't', subTasks: sub(5, 3) }), [], NOW);
  eq(r.signals.subtaskProgress, 60);
  eq(r.signals.daysLeft, 5);
  ok(r.signals.onPace, 'onPace');
  ok(r.score >= 65 && r.score <= 80, `score=${r.score}`);
});

it('chậm pace (1/5 done, giữa kỳ) → thấp hơn đúng pace + không onPace', () => {
  const slow = computeTaskFeasibility(task({ id: 't', subTasks: sub(5, 1) }), [], NOW);
  const good = computeTaskFeasibility(task({ id: 't', subTasks: sub(5, 3) }), [], NOW);
  ok(!slow.signals.onPace, 'không onPace');
  ok(slow.score < good.score, `slow ${slow.score} < good ${good.score}`);
});

it('quá hạn chưa xong → phạt ×0.5 (overdue flag + daysLeft âm)', () => {
  const r = computeTaskFeasibility(
    task({ id: 't', startDate: '2026-07-01', endDate: '2026-07-10', subTasks: sub(5, 2) }),
    [], NOW,
  );
  ok(r.signals.overdue, 'overdue');
  ok(r.signals.daysLeft < 0, 'daysLeft âm');
  ok(r.score < 35, `bị kéo mạnh: ${r.score}`);
});

it('không subtask → progress neutral, không crash', () => {
  const r = computeTaskFeasibility(task({ id: 't', subTasks: [] }), [], NOW);
  eq(r.signals.subtaskTotal, 0);
  ok(r.score > 0 && r.score < 100, `score=${r.score}`);
});

console.log('\nTỷ lệ hoàn thành lịch sử');

it('user mới (không lịch sử) → 60 mặc định', () => {
  eq(computeHistoricalCompletionRate([], NOW), 60);
});

it('2 xong / 1 bỏ → 67%; loại chính task đang xét', () => {
  const hist: MoneyTaskSnapshot[] = [
    task({ id: 'a', completedAt: '2026-07-05' }),
    task({ id: 'b', completedAt: '2026-07-06' }),
    task({ id: 'c', deletedAt: '2026-07-07' }),
    task({ id: 'self', subTasks: sub(3, 1) }), // active, chưa chốt → không tính
  ];
  eq(computeHistoricalCompletionRate(hist, NOW, 'self'), 67);
});

it('quá hạn chưa xong cũng tính là "chốt sổ" (thất bại)', () => {
  const hist: MoneyTaskSnapshot[] = [
    task({ id: 'a', completedAt: '2026-07-05' }),
    task({ id: 'b', startDate: '2026-06-01', endDate: '2026-06-10' }), // quá hạn, chưa xong
  ];
  eq(computeHistoricalCompletionRate(hist, NOW), 50);
});

console.log('\nTask feasibility test suite complete.');
