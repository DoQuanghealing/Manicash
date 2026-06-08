/* TDD — taskMetrics.ts: status, pipeline, actual income, subtask progress */
import {
  getTaskStatus, getActiveTasks, getOverdueTasks, getCompletedTasks,
  getExpectedIncomePipeline, getActualTaskIncomeForPeriod,
  getTaskCompletionProgress, getHighestPriorityIncomeTasks,
} from '@/lib/moneyBrain/taskMetrics';
import type { MoneySnapshotV1, MoneyTaskSnapshot } from '@/lib/moneyBrain/types';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const VN = 'Asia/Ho_Chi_Minh';
// clientNow = 2026-06-08 10:00 VN → todayKey = '2026-06-08'
const CLIENT_NOW = '2026-06-08T03:00:00Z';

function makeSnap(tasks: MoneyTaskSnapshot[]): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
    transactions: [],
    budgets: [],
    bills: [],
    goals: [],
    tasks,
  };
}

const TASKS: MoneyTaskSnapshot[] = [
  {
    id: 'active1', name: 'Active freelance', expectedAmount: 3_000_000,
    startDate: '2026-06-01', endDate: '2026-06-15',
    subTasks: [
      { id: 'st1', isCompleted: true },
      { id: 'st2', isCompleted: false },
    ],
  },
  {
    id: 'active2', name: 'Upcoming task', expectedAmount: 1_500_000,
    startDate: '2026-06-10', endDate: '2026-06-20',
  },
  {
    id: 'overdue1', name: 'Overdue task', expectedAmount: 2_000_000,
    startDate: '2026-05-01', endDate: '2026-06-05', // endDate < today (06-08)
  },
  {
    id: 'completed1', name: 'Done task', expectedAmount: 800_000, actualAmount: 800_000,
    startDate: '2026-06-01', endDate: '2026-06-10',
    completedAt: '2026-06-03T03:00:00Z', // 2026-06-03 VN
  },
  {
    id: 'deleted1', name: 'Deleted task', expectedAmount: 500_000,
    startDate: '2026-06-01', endDate: '2026-06-20',
    deletedAt: '2026-06-05T03:00:00Z',
  },
];

async function main() {
  describe('getTaskStatus');

  await it('completed → "completed"', async () => {
    const snap = makeSnap([TASKS[3]]);
    eq(getTaskStatus(TASKS[3], snap), 'completed');
  });

  await it('deleted → "deleted"', async () => {
    const snap = makeSnap([TASKS[4]]);
    eq(getTaskStatus(TASKS[4], snap), 'deleted');
  });

  await it('endDate < today → "overdue"', async () => {
    const snap = makeSnap([TASKS[2]]);
    eq(getTaskStatus(TASKS[2], snap), 'overdue');
  });

  await it('endDate >= today → "active"', async () => {
    const snap = makeSnap([TASKS[0]]);
    eq(getTaskStatus(TASKS[0], snap), 'active');
  });

  describe('getActiveTasks / getOverdueTasks / getCompletedTasks');

  await it('filter đúng status', async () => {
    const snap = makeSnap(TASKS);
    const active = getActiveTasks(snap);
    const overdue = getOverdueTasks(snap);
    const completed = getCompletedTasks(snap);

    if (!active.some((t) => t.id === 'active1')) throw new Error('active1 should be active');
    if (!active.some((t) => t.id === 'active2')) throw new Error('active2 should be active');
    if (!overdue.some((t) => t.id === 'overdue1')) throw new Error('overdue1 should be overdue');
    if (!completed.some((t) => t.id === 'completed1')) throw new Error('completed1 should be completed');
    if (active.some((t) => t.id === 'deleted1')) throw new Error('deleted1 should NOT be in active');
  });

  describe('getExpectedIncomePipeline');

  await it('sum expectedAmount of active + overdue', async () => {
    const snap = makeSnap(TASKS);
    // active: 3M (active1) + 1.5M (active2) + overdue: 2M (overdue1) = 6.5M
    eq(getExpectedIncomePipeline(snap), 3_000_000 + 1_500_000 + 2_000_000, 'pipeline total');
  });

  await it('completed/deleted KHÔNG nằm trong pipeline', async () => {
    const snap = makeSnap([TASKS[3], TASKS[4]]); // only completed + deleted
    eq(getExpectedIncomePipeline(snap), 0, 'no active/overdue = 0 pipeline');
  });

  describe('getActualTaskIncomeForPeriod');

  await it('actual income tháng này: completedAt trong tháng 6', async () => {
    const snap = makeSnap([
      { ...TASKS[3], completedAt: '2026-06-03T03:00:00Z', actualAmount: 800_000 }, // tháng 6
      {
        id: 'old_completed', name: 'Old', expectedAmount: 500_000, actualAmount: 500_000,
        startDate: '2026-05-01', endDate: '2026-05-31',
        completedAt: '2026-05-20T03:00:00Z', // tháng 5
      },
    ]);
    eq(getActualTaskIncomeForPeriod(snap, 'this_month'), 800_000, 'only June completions');
  });

  await it('actual income hôm nay', async () => {
    const todayCompleted: MoneyTaskSnapshot = {
      id: 'today_task', name: 'Quick job', expectedAmount: 500_000, actualAmount: 500_000,
      startDate: '2026-06-08', endDate: '2026-06-08',
      completedAt: '2026-06-08T03:00:00Z', // hôm nay VN
    };
    const snap = makeSnap([todayCompleted, TASKS[3]]); // TASKS[3] completed 06-03
    eq(getActualTaskIncomeForPeriod(snap, 'today'), 500_000, 'only today completions');
  });

  describe('getTaskCompletionProgress');

  await it('subtask progress đúng', async () => {
    const p = getTaskCompletionProgress(TASKS[0]); // 1/2 done
    eq(p.done, 1);
    eq(p.total, 2);
    eq(p.progress, 50, '50% progress');
  });

  await it('no subtasks → 0/0, progress 0', async () => {
    const p = getTaskCompletionProgress(TASKS[1]); // no subTasks
    eq(p.done, 0);
    eq(p.total, 0);
    eq(p.progress, 0);
  });

  describe('getHighestPriorityIncomeTasks');

  await it('overdue tasks trước active; trong cùng loại sort by endDate asc', async () => {
    const snap = makeSnap(TASKS);
    const priority = getHighestPriorityIncomeTasks(snap, 5);
    const ids = priority.map((t) => t.id);
    // overdue1 phải đứng trước active
    const overdueIdx = ids.indexOf('overdue1');
    const activeIdx = ids.indexOf('active1');
    if (overdueIdx === -1) throw new Error('overdue1 not in priority list');
    if (activeIdx === -1) throw new Error('active1 not in priority list');
    if (overdueIdx > activeIdx) throw new Error('overdue should come before active');
    // completed/deleted không nằm trong priority
    if (ids.includes('completed1')) throw new Error('completed not in priority list');
    if (ids.includes('deleted1')) throw new Error('deleted not in priority list');
  });

  console.log('\ntaskMetrics test complete.');
}

main();
