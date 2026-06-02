import {
  buildLocalCfoNarration,
  buildCfoNarrationPrompt,
  computeNarrationFingerprint,
  validateNarration,
  type CfoNarrationInput,
} from '@/lib/aiMoneyChat/cfoNarration';
import { buildMonthlyReportCsv, type ReportExportData } from '@/lib/aiMoneyChat/reportExport';

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

function expectContains(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected output to include "${expected}"`);
  }
}

function expectTruthy(value: unknown, label: string): void {
  if (!value) {
    throw new Error(`Expected ${label} to be truthy, got ${String(value)}`);
  }
}

const goodInput: CfoNarrationInput = {
  monthLabel: 'tháng 6/2026',
  tier: 'good',
  healthScore: 82,
  income: 20_000_000,
  expense: 12_000_000,
  savings: 8_000_000,
  savingsRate: 40,
  topCategory: { name: 'Ăn uống', amount: 4_000_000 },
  topGoal: { name: 'Mua xe', progress: 60, remaining: 40_000_000 },
  budgetOnTrack: 5,
  budgetTotal: 6,
};

const negativeInput: CfoNarrationInput = {
  monthLabel: 'tháng 6/2026',
  tier: 'poor',
  healthScore: 30,
  income: 10_000_000,
  expense: 13_000_000,
  savings: -3_000_000,
  savingsRate: -30,
  topCategory: { name: 'Mua sắm', amount: 6_000_000 },
  topGoal: null,
  budgetOnTrack: 1,
  budgetTotal: 6,
};

describe('CFO narration - local template', () => {
  it('mentions month, savings, and top category for a good month', () => {
    const text = buildLocalCfoNarration(goodInput);
    expectContains(text, 'tháng 6/2026');
    expectContains(text, 'Ăn uống');
    expectContains(text, 'Cậu chủ');
  });

  it('frames negative cashflow as a deficit', () => {
    const text = buildLocalCfoNarration(negativeInput);
    expectContains(text, 'âm');
    expectContains(text, 'vượt kế hoạch');
  });

  it('omits goal sentence when there is no active goal', () => {
    const text = buildLocalCfoNarration(negativeInput);
    expectEqual(text.includes('cán đích'), false);
  });
});

describe('CFO narration - prompt builder', () => {
  it('includes aggregated numbers but no raw transactions', () => {
    const prompt = buildCfoNarrationPrompt(goodInput);
    expectContains(prompt, '82/100');
    expectContains(prompt, 'Mua xe');
  });
});

describe('CFO narration - validation', () => {
  it('accepts a clean paragraph', () => {
    const result = validateNarration('Cậu chủ, tháng này cậu làm rất tốt và ta rất tự hào.');
    expectTruthy(result, 'validated narration');
  });

  it('rejects empty, JSON, and markdown output', () => {
    expectEqual(validateNarration(''), null);
    expectEqual(validateNarration('{ "text": "x" }'), null);
    expectEqual(validateNarration('```json\n{}\n```'), null);
    expectEqual(validateNarration(42), null);
  });
});

describe('CFO narration - cache fingerprint', () => {
  it('is stable for identical input', () => {
    expectEqual(computeNarrationFingerprint(goodInput), computeNarrationFingerprint({ ...goodInput }));
  });

  it('changes when a number changes', () => {
    const a = computeNarrationFingerprint(goodInput);
    const b = computeNarrationFingerprint({ ...goodInput, expense: goodInput.expense + 1 });
    expectEqual(a === b, false);
  });

  it('changes when the top category changes', () => {
    const a = computeNarrationFingerprint(goodInput);
    const b = computeNarrationFingerprint({ ...goodInput, topCategory: { name: 'Đi lại', amount: 1_000_000 } });
    expectEqual(a === b, false);
  });

  it('handles null category and goal without throwing', () => {
    const fp = computeNarrationFingerprint({ ...goodInput, topCategory: null, topGoal: null });
    expectEqual(typeof fp, 'string');
    expectEqual(fp.length, 8);
  });
});

describe('CFO report - CSV export', () => {
  const data: ReportExportData = {
    monthLabel: 'tháng 6/2026',
    income: 20_000_000,
    expense: 12_000_000,
    savings: 8_000_000,
    savingsRate: 40,
    healthScore: 82,
    tierLabel: 'Sức khỏe tốt',
    categories: [{ name: 'Ăn uống', amount: 4_000_000 }],
    goals: [{ name: 'Mua xe', current: 60_000_000, target: 100_000_000, progress: 60 }],
    actionPlan: ['Xem lại Ăn uống', 'Giữ tỷ lệ tiết kiệm'],
  };

  it('emits a header and section labels', () => {
    const csv = buildMonthlyReportCsv(data);
    expectContains(csv, 'ManiCash');
    expectContains(csv, 'Danh mục chi tiêu');
    expectContains(csv, 'Kế hoạch tháng tới');
  });

  it('escapes cells containing commas', () => {
    const csv = buildMonthlyReportCsv({
      ...data,
      categories: [{ name: 'Ăn uống, cà phê', amount: 100 }],
    });
    expectContains(csv, '"Ăn uống, cà phê"');
  });

  it('keeps Vietnamese accents intact', () => {
    const csv = buildMonthlyReportCsv(data);
    expectContains(csv, 'Sức khỏe tài chính');
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
