/* PRISM P3 — trí nhớ giao dịch lặp lại.
 * Kiểm: record upsert + count; typicalAmount = mode (hòa->mới nhất);
 * topHabits lọc minCount + xếp hạng; bỏ qua transfer / amount xấu. */
import {
  recordHabit,
  topHabits,
  typicalAmount,
  habitKeyword,
  habitLabel,
  type TransactionHabit,
} from '@/lib/aiMoneyChat/prism/transactionMemory';

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

const T0 = '2026-06-10T01:00:00Z';
const T1 = '2026-06-11T01:00:00Z';
const T2 = '2026-06-12T01:00:00Z';

function rec(habits: TransactionHabit[], text: string, categoryId: string, amount: number, now: string) {
  return recordHabit(habits, { text, type: 'expense', categoryId, amount }, now);
}

describe('habitKeyword / habitLabel');
it('bỏ số tiền, fold dấu cho keyword', () => {
  eq(habitKeyword('Cà phê 30k'), habitKeyword('ca phe'));
  eq(habitLabel('Cà phê 30k'), 'Cà phê');
});
it('dấu câu lạc KHÔNG làm tách keyword/label', () => {
  // 'cà phê 30k.' và 'cà phê 35k' phải ra cùng keyword (dedup ổn định)
  eq(habitKeyword('Cà phê 30k.'), habitKeyword('Cà phê 35k'));
  eq(habitLabel('Cà phê 30k.'), 'Cà phê'); // không còn ' .'
});
it('slang VN "5k5"/"5tr2" được bóc khỏi keyword/label', () => {
  eq(habitKeyword('ăn 5k5'), habitKeyword('ăn 6k5')); // cùng "an"
  eq(habitLabel('trả nợ 5tr2'), 'trả nợ');
});

describe('typicalAmount (mode, hòa -> mới nhất)');
it('mode thắng', () => {
  eq(typicalAmount([30000, 30000, 50000]), 30000);
});
it('hòa -> số mới nhất (cuối mảng)', () => {
  eq(typicalAmount([30000, 50000]), 50000);
});

describe('recordHabit — upsert + count');
it('ghi 2 lần cùng keyword+cat -> count=2, lên đầu', () => {
  let h: TransactionHabit[] = [];
  h = rec(h, 'cà phê 30k', 'coffee', 30000, T0);
  h = rec(h, 'ăn trưa 50k', 'food', 50000, T1);
  h = rec(h, 'cà phê 35k', 'coffee', 35000, T2);
  const coffee = h.find((x) => x.keyword === habitKeyword('cà phê'))!;
  eq(coffee.count, 2, 'count cà phê');
  eq(h[0].keyword, habitKeyword('cà phê'), 'mới ghi -> lên đầu');
});
it('typicalAmount cập nhật theo mode khi ghi nhiều lần', () => {
  let h: TransactionHabit[] = [];
  h = rec(h, 'cà phê', 'coffee', 30000, T0);
  h = rec(h, 'cà phê', 'coffee', 30000, T1);
  h = rec(h, 'cà phê', 'coffee', 45000, T2);
  eq(h[0].typicalAmount, 30000, 'mode 30k');
});
it('dấu câu lạc -> vẫn dedup chung 1 habit (count=2)', () => {
  let h: TransactionHabit[] = [];
  h = rec(h, 'cà phê 30k.', 'coffee', 30000, T0);
  h = rec(h, 'cà phê 35k', 'coffee', 35000, T1);
  eq(h.length, 1, 'gộp 1 habit');
  eq(h[0].count, 2, 'count tích lũy');
});

describe('recordHabit — bỏ qua input xấu');
it('transfer -> không ghi', () => {
  const h = recordHabit([], { text: 'chuyển quỹ', type: 'transfer', categoryId: 'x', amount: 100000 }, T0);
  eq(h.length, 0);
});
it('amount <= 0 -> không ghi', () => {
  const h = recordHabit([], { text: 'abc', type: 'expense', categoryId: 'food', amount: 0 }, T0);
  eq(h.length, 0);
});

describe('topHabits — lọc + xếp hạng');
it('chỉ lấy count >= minCount=2', () => {
  let h: TransactionHabit[] = [];
  h = rec(h, 'cà phê', 'coffee', 30000, T0);
  h = rec(h, 'cà phê', 'coffee', 30000, T1); // count 2
  h = rec(h, 'ăn tối', 'food', 80000, T2); // count 1 -> loại
  const top = topHabits(h, { minCount: 2 });
  eq(top.length, 1, 'chỉ cà phê');
  eq(top[0].keyword, habitKeyword('cà phê'));
});
it('count cao xếp trước', () => {
  let h: TransactionHabit[] = [];
  h = rec(h, 'cà phê', 'coffee', 30000, T0);
  h = rec(h, 'cà phê', 'coffee', 30000, T1);
  h = rec(h, 'cà phê', 'coffee', 30000, T2); // count 3
  h = rec(h, 'gửi xe', 'transport', 5000, T1);
  h = rec(h, 'gửi xe', 'transport', 5000, T2); // count 2
  const top = topHabits(h, { minCount: 2 });
  eq(top[0].keyword, habitKeyword('cà phê'), 'cà phê (count 3) trước');
  ok(top.length === 2, '2 thói quen');
});

if (process.exitCode) process.exit(process.exitCode);
