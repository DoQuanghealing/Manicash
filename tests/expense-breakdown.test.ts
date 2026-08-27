/* ═══ Test — expenseBreakdown (gom chi tiêu theo ngày/tuần/tháng/năm) ═══ */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { Transaction } from '@/stores/useFinanceStore';
import {
  buildCategoryBreakdown,
  buildDonutSegments,
  buildExpenseBuckets,
  filterExpensesForPeriod,
  getPeriodRange,
  getPeriodTotal,
} from '@/lib/expenseBreakdown';

/** Thứ Năm 13/08/2026 10:00 giờ địa phương — mốc "bây giờ" cố định cho mọi ca. */
const NOW = new Date(2026, 7, 13, 10, 0, 0);

let seq = 0;
function txn(p: {
  amount: number;
  categoryId?: string;
  at: Date;
  type?: 'income' | 'expense';
}): Transaction {
  const d = p.at;
  return {
    id: `t${++seq}`,
    type: p.type ?? 'expense',
    amount: p.amount,
    categoryId: p.categoryId ?? 'food',
    note: '',
    wallet: 'main',
    date: d.toISOString(),
    time: '10:00',
    dateLabel: '',
    dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  };
}

const SAMPLE: Transaction[] = [
  txn({ amount: 100_000, at: new Date(2026, 7, 13, 8, 0), categoryId: 'coffee' }),   // hôm nay
  txn({ amount: 250_000, at: new Date(2026, 7, 13, 19, 0), categoryId: 'groceries' }), // hôm nay
  txn({ amount: 60_000, at: new Date(2026, 7, 11, 9, 0), categoryId: 'food' }),       // T3 tuần này
  txn({ amount: 900_000, at: new Date(2026, 7, 6, 9, 0), categoryId: 'groceries' }),  // tuần trước
  txn({ amount: 500_000, at: new Date(2026, 6, 20, 9, 0), categoryId: 'clothing' }),  // tháng trước
  txn({ amount: 300_000, at: new Date(2025, 4, 2, 9, 0), categoryId: 'food' }),       // năm ngoái
  txn({ amount: 9_000_000, at: new Date(2026, 7, 5, 9, 0), type: 'income' }),         // THU — phải bị bỏ
];

test('kỳ hiện tại: ngày chỉ lấy hôm nay, tuần tính từ thứ Hai', () => {
  const day = getPeriodRange('day', NOW);
  assert.equal(day.from.getDate(), 13);
  assert.equal(day.to.getDate(), 14);

  const week = getPeriodRange('week', NOW);
  // 13/8/2026 là thứ Năm → đầu tuần là thứ Hai 10/8.
  assert.equal(week.from.getDay(), 1, 'đầu tuần phải là thứ Hai');
  assert.equal(week.from.getDate(), 10);

  const month = getPeriodRange('month', NOW);
  assert.equal(month.from.getDate(), 1);
  assert.equal(month.from.getMonth(), 7);

  const year = getPeriodRange('year', NOW);
  assert.equal(year.from.getMonth(), 0);
  assert.equal(year.from.getFullYear(), 2026);
});

test('tổng theo kỳ cộng dồn đúng và KHÔNG tính khoản thu', () => {
  assert.equal(getPeriodTotal(SAMPLE, 'day', NOW), 350_000);
  assert.equal(getPeriodTotal(SAMPLE, 'week', NOW), 410_000);              // + 60k thứ Ba
  assert.equal(getPeriodTotal(SAMPLE, 'month', NOW), 1_310_000);           // + 900k tuần trước
  assert.equal(getPeriodTotal(SAMPLE, 'year', NOW), 1_810_000);            // + 500k tháng 7
});

test('giao dịch trong kỳ xếp mới nhất trước', () => {
  const list = filterExpensesForPeriod(SAMPLE, 'week', NOW);
  assert.equal(list.length, 3);
  assert.equal(list[0].amount, 250_000, 'khoản 19h hôm nay đứng đầu');
  assert.equal(list[2].amount, 60_000, 'khoản thứ Ba đứng cuối');
});

test('dải cột: đúng số cột và đánh dấu kỳ hiện tại', () => {
  const day = buildExpenseBuckets(SAMPLE, 'day', NOW);
  assert.equal(day.length, 7);
  assert.equal(day[6].isCurrent, true);
  assert.equal(day[6].amount, 350_000);
  assert.equal(day.filter((b) => b.isCurrent).length, 1);

  const week = buildExpenseBuckets(SAMPLE, 'week', NOW);
  assert.equal(week.length, 6);
  assert.equal(week[5].amount, 410_000);
  assert.equal(week[4].amount, 900_000, 'tuần trước gom đúng khoản 6/8');

  const month = buildExpenseBuckets(SAMPLE, 'month', NOW);
  assert.equal(month.length, 12);
  assert.equal(month[7].amount, 1_310_000, 'tháng 8');
  assert.equal(month[6].amount, 500_000, 'tháng 7');
  assert.equal(month[7].isCurrent, true);

  const year = buildExpenseBuckets(SAMPLE, 'year', NOW);
  assert.equal(year.length, 4);
  assert.equal(year[3].amount, 1_810_000);
  assert.equal(year[2].amount, 300_000, 'năm 2025');
});

test('phân bổ danh mục: sắp giảm dần, % cộng lại ~100, có màu riêng', () => {
  const slices = buildCategoryBreakdown(SAMPLE, 'month', NOW);
  assert.equal(slices[0].categoryId, 'groceries');
  assert.equal(slices[0].amount, 1_150_000);
  assert.equal(slices[0].name, 'Đi chợ/Siêu thị');

  const sum = slices.reduce((s, x) => s + x.percent, 0);
  assert.ok(Math.abs(sum - 100) < 0.5, `tổng % phải ~100, đang ${sum}`);

  const colors = new Set(slices.map((s) => s.color));
  assert.equal(colors.size, slices.length, 'mỗi danh mục một màu');

  assert.deepEqual(buildCategoryBreakdown([], 'month', NOW), [], 'không có chi thì rỗng');
});

test('danh mục lạ vẫn hiện, không làm vỡ biểu đồ', () => {
  const slices = buildCategoryBreakdown(
    [txn({ amount: 50_000, at: NOW, categoryId: 'khong-ton-tai' })],
    'day',
    NOW,
  );
  assert.equal(slices.length, 1);
  assert.equal(slices[0].name, 'khong-ton-tai');
  assert.ok(slices[0].color.startsWith('#'));
});

test('cung tròn nối tiếp nhau, không chồng lấn', () => {
  const slices = buildCategoryBreakdown(SAMPLE, 'month', NOW);
  const C = 100;
  const segs = buildDonutSegments(slices, C);
  assert.equal(segs.length, slices.length);
  assert.equal(segs[0].offset, 0, 'cung đầu bắt đầu ở mốc 0');

  // offset của cung sau = -(tổng độ dài các cung trước)
  let acc = 0;
  segs.forEach((seg, i) => {
    assert.ok(Math.abs(seg.offset + acc) < 0.001, `cung ${i} lệch chỗ`);
    acc += (slices[i].percent / 100) * C;
  });
  assert.ok(acc <= C + 0.001, 'tổng các cung không vượt quá chu vi');
});
