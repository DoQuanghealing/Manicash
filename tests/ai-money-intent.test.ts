import {
  classifyIntent,
  normalize,
  tokenize,
} from '@/lib/aiMoneyChat/intent/intentClassifier';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import type {
  ChatIntentType,
  LogTransactionSlots,
} from '@/lib/aiMoneyChat/intent/types';

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

// ─────────────────────────────────────────────────────────────
describe('normalize() — fold dấu + bỏ dấu câu', () => {
  it('lowercase + fold dấu tiếng Việt', () => {
    expectEqual(normalize('Tôi Còn Bao Nhiêu Tiền?'), 'toi con bao nhieu tien');
  });

  it('đ -> d và bỏ dấu câu thừa', () => {
    expectEqual(normalize('Tiền điện đóng chưa!!!'), 'tien dien dong chua');
  });

  it('thu gọn whitespace', () => {
    expectEqual(normalize('  mua   trứng    30k  '), 'mua trung 30k');
  });

  it('input rỗng / sai kiểu trả chuỗi rỗng', () => {
    expectEqual(normalize(''), '');
    // @ts-expect-error test runtime guard
    expectEqual(normalize(null), '');
  });
});

describe('tokenize() — loại stop-word', () => {
  it('bỏ "co", "cua", "minh" nhưng giữ token tín hiệu', () => {
    expectEqual(tokenize('hom nay co viec gi cua minh').join(' '), 'hom nay viec gi');
  });

  it('GIỮ "toi" (vì "tới" fold trùng "tôi")', () => {
    expectTrue(tokenize('toi dau roi').includes('toi'), '"toi" retained');
  });
});

// ─────────────────────────────────────────────────────────────
// 5+ câu thoại tiếng Việt sinh hoạt, chứng minh argmax phân loại đúng.
describe('classifyIntent() — phân loại 10 intent', () => {
  const cases: Array<{ text: string; expected: ChatIntentType }> = [
    { text: 'mua trứng 30k', expected: 'LOG_TRANSACTION' },
    { text: 'nhận lương 20tr', expected: 'LOG_TRANSACTION' },
    { text: 'tôi còn bao nhiêu tiền', expected: 'QUERY_BALANCE' },
    { text: 'tiền điện đóng chưa', expected: 'QUERY_BILL_STATUS' },
    { text: 'tiết kiệm tháng này được bao nhiêu', expected: 'QUERY_SAVINGS' },
    { text: 'tháng này còn bao nhiêu để xài', expected: 'QUERY_SAFE_TO_SPEND' },
    { text: 'hôm nay tôi có việc gì', expected: 'QUERY_TASKS_TODAY' },
    { text: 'mục tiêu mua xe tới đâu rồi', expected: 'QUERY_GOAL_PROGRESS' },
    { text: 'lên báo cáo CFO tháng này', expected: 'CFO_REPORT' },
    { text: 'phân tích năng lực tài chính của tôi', expected: 'ANALYZE_FINANCE' },
    { text: 'gợi ý cắt giảm chi tiêu', expected: 'ADVICE_CUT_SPENDING' },
    { text: 'asdkfj qwerty', expected: 'UNKNOWN' },
  ];

  for (const { text, expected } of cases) {
    it(`"${text}" -> ${expected}`, () => {
      const intent = classifyIntent(text);
      console.log(
        `      [debug] type=${intent.type} score=${intent.score} conf=${intent.confidence} reason=${intent.reason}`,
      );
      expectEqual(intent.type, expected);
    });
  }
});

describe('classifyIntent() — pipeline & confidence', () => {
  it('CFO_REPORT đi pipeline llm', () => {
    expectEqual(classifyIntent('lên báo cáo CFO tháng').pipeline, 'llm');
  });

  it('QUERY_BALANCE đi pipeline deterministic', () => {
    expectEqual(classifyIntent('số dư còn bao nhiêu').pipeline, 'deterministic');
  });

  it('UNKNOWN luôn confidence low', () => {
    expectEqual(classifyIntent('xyz random text').confidence, 'low');
  });

  it('score nằm trong [0,1]', () => {
    const s = classifyIntent('tiền điện đóng chưa').score;
    expectTrue(s >= 0 && s <= 1, 'score in range');
  });
});

// ─────────────────────────────────────────────────────────────
describe('routeIntent() — slot extraction', () => {
  it('LOG_TRANSACTION nạp slot từ parseMoneyText', () => {
    const intent = routeIntent('mua trứng 30k');
    expectEqual(intent.type, 'LOG_TRANSACTION');
    const slots = intent.slots as LogTransactionSlots;
    expectEqual(slots.type, 'expense');
    expectEqual(slots.amount, 30_000);
    expectTrue(typeof slots.categoryId === 'string', 'categoryId is string');
  });

  it('LOG_TRANSACTION income lương 20tr', () => {
    const intent = routeIntent('nhận lương 20tr');
    expectEqual(intent.type, 'LOG_TRANSACTION');
    const slots = intent.slots as LogTransactionSlots;
    expectEqual(slots.type, 'income');
    expectEqual(slots.amount, 20_000_000);
    // parser tự tin -> confidence intent được nâng lên high
    expectEqual(intent.confidence, 'high');
  });

  it('intent không phải LOG_TRANSACTION giữ slots rỗng', () => {
    const intent = routeIntent('tôi còn bao nhiêu tiền');
    expectEqual(intent.type, 'QUERY_BALANCE');
    expectEqual(Object.keys(intent.slots).length, 0);
  });

  it('không throw với input rỗng', () => {
    const intent = routeIntent('');
    expectEqual(intent.type, 'UNKNOWN');
  });
});

console.log('\nIntent router Phase 1 test suite complete.');
