import {
  detectEarningIntent,
  parseEarningPlan,
  buildEarningTaskDates,
} from '@/lib/aiMoneyChat/earningPlanner';

type TestFn = () => void;

function describe(name: string, fn: TestFn): void {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: TestFn): void {
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`Expected ${label} to be true`);
}

describe('Earning planner - intent detection', () => {
  it('detects earning plans', () => {
    expectTrue(detectEarningIntent('làm freelance kiếm 3tr trong 1 tuần'), 'freelance');
    expectTrue(detectEarningIntent('bán hàng online shopee'), 'sales');
    expectTrue(detectEarningIntent('dạy kèm tiếng anh kiếm 2tr'), 'teaching');
  });

  it('does not flag plain transactions', () => {
    expectEqual(detectEarningIntent('mua trà sữa 50k'), false);
    expectEqual(detectEarningIntent('đi siêu thị hết 300k'), false);
  });
});

describe('Earning planner - parse', () => {
  it('parses amount, duration, and work type for freelance', () => {
    const plan = parseEarningPlan('làm freelance thiết kế logo kiếm 3tr trong 1 tuần');
    expectEqual(plan.expectedAmount, 3_000_000);
    expectEqual(plan.durationDays, 7);
    expectEqual(plan.workType, 'freelance');
    expectTrue(plan.suggestedSubTasks.length > 0, 'has sub-tasks');
    expectEqual(plan.confidence, 'high');
  });

  it('parses weeks and months', () => {
    expectEqual(parseEarningPlan('bán hàng kiếm 5tr trong 2 tuần').durationDays, 14);
    expectEqual(parseEarningPlan('dạy kèm kiếm 4tr trong 1 tháng').durationDays, 30);
    expectEqual(parseEarningPlan('làm freelance kiếm 1tr trong 10 ngày').durationDays, 10);
  });

  it('defaults duration to 7 days when unspecified', () => {
    expectEqual(parseEarningPlan('làm freelance kiếm 2tr').durationDays, 7);
  });

  it('drops to medium confidence without an amount', () => {
    const plan = parseEarningPlan('làm freelance thiết kế');
    expectEqual(plan.expectedAmount, null);
    expectEqual(plan.confidence, 'medium');
  });

  it('falls back to generic work type and checklist', () => {
    const plan = parseEarningPlan('kiếm thêm 1tr');
    expectEqual(plan.workType, 'generic');
    expectTrue(plan.suggestedSubTasks.length > 0, 'has generic sub-tasks');
  });
});

describe('Earning planner - dates', () => {
  it('builds end date durationDays after start', () => {
    const start = new Date('2026-06-01T00:00:00.000Z');
    const { startDate, endDate } = buildEarningTaskDates(7, start);
    expectEqual(startDate, '2026-06-01T00:00:00.000Z');
    expectEqual(endDate, '2026-06-08T00:00:00.000Z');
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
