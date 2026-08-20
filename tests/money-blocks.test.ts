/* ═══ Test — số liệu cụm 3 khối Thu nhập · Chi tiêu · Tiết kiệm ═══
 *
 * Ba chỗ dễ sai nhất, canh riêng:
 *   1. Giao dịch cũ KHÔNG có `method` phải tính là chuyển khoản, không phải mất tiêu.
 *   2. Tháng chưa tới không được tính là "tiết kiệm được cả ngưỡng".
 *   3. Tháng không đóng hóa đơn không được làm mốc so sánh (sinh -100% giả).
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { BillPayment, Transaction } from '@/stores/useFinanceStore';
import {
  buildBillMonthTotals,
  buildConicGradient,
  buildIncomeBreakdown,
  buildIncomeSeries,
  buildSpendingSeries,
  getBudgetComposition,
  getMethodSplit,
  hasPriorMonthData,
  restAnchoredStartAngle,
} from '@/lib/moneyBlocks';

/** Mốc thời gian cố định để test không phụ thuộc ngày chạy. */
const NOW = new Date(2026, 7, 16, 10, 0, 0); // 16/08/2026, giờ địa phương

let seq = 0;
/** `date` nhận Date cho dễ đọc; Transaction lưu ISO string nên đổi ở đây. */
function txn(
  partial: Omit<Partial<Transaction>, 'date'> & { amount: number; date: Date },
): Transaction {
  const { date: d, ...rest } = partial;
  return {
    id: `t${seq++}`,
    type: 'expense',
    categoryId: 'food',
    note: '',
    wallet: 'main',
    time: '10:00',
    dateLabel: '',
    dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    ...rest,
    date: d.toISOString(),
  } as Transaction;
}

function payment(billId: string, month: string, amount: number): BillPayment {
  return { id: `p${seq++}`, billId, billName: billId, icon: '💡', amount, month, paidAt: '' };
}

// ─────────────────────────── Thu nhập hai túi ───────────────────────────

test('thu nhập tách đúng tiền mặt và ngân hàng', () => {
  const txns = [
    txn({ type: 'income', amount: 5_000_000, method: 'cash', date: new Date(2026, 7, 10) }),
    txn({ type: 'income', amount: 20_000_000, method: 'transfer', date: new Date(2026, 7, 10) }),
  ];
  const series = buildIncomeSeries(txns, 'month', NOW);
  const aug = series.find((p) => p.label === 'T8')!;
  assert.equal(aug.cash, 5_000_000);
  assert.equal(aug.bank, 20_000_000);
  assert.equal(aug.total, 25_000_000);
});

test('giao dịch cũ thiếu `method` tính là chuyển khoản, không bị mất', () => {
  const txns = [txn({ type: 'income', amount: 7_000_000, date: new Date(2026, 7, 3) })];
  const aug = buildIncomeSeries(txns, 'month', NOW).find((p) => p.label === 'T8')!;
  assert.equal(aug.cash, 0);
  assert.equal(aug.bank, 7_000_000, 'thiếu method phải rơi vào ngân hàng');
  assert.equal(aug.total, 7_000_000);
});

test('thu nhập không lẫn khoản chi, kỳ trống vẫn giữ chỗ', () => {
  const txns = [txn({ type: 'expense', amount: 3_000_000, date: new Date(2026, 7, 5) })];
  const series = buildIncomeSeries(txns, 'month', NOW);
  assert.equal(series.length, 12, 'đủ 12 tháng để trục liền mạch');
  assert.equal(series.reduce((s, p) => s + p.total, 0), 0, 'khoản chi không được tính vào thu');
});

// ─────────────────────────── Mảnh ghép thu nhập ───────────────────────────

test('mảnh ghép thu nhập: gộp theo danh mục, sắp giảm dần, % cộng ~100', () => {
  const txns = [
    txn({ type: 'income', amount: 20_000_000, categoryId: 'salary', date: new Date(2026, 7, 5) }),
    txn({ type: 'income', amount: 8_000_000, categoryId: 'business', date: new Date(2026, 7, 10) }),
    txn({ type: 'income', amount: 7_000_000, categoryId: 'freelance', date: new Date(2026, 7, 14) }),
  ];
  const out = buildIncomeBreakdown(txns, 'month', NOW);
  assert.equal(out.length, 3);
  assert.equal(out[0].categoryId, 'salary', 'lát to nhất đứng đầu');
  assert.equal(out[0].name, 'Lương', 'phải tra được bảng danh mục THU');
  assert.ok(Math.abs(out.reduce((s, x) => s + x.percent, 0) - 100) < 0.5);
});

test('mảnh ghép thu nhập KHÔNG lẫn khoản chi, kỳ khác bị loại', () => {
  const txns = [
    txn({ type: 'income', amount: 10_000_000, categoryId: 'salary', date: new Date(2026, 7, 5) }),
    txn({ type: 'expense', amount: 9_000_000, categoryId: 'food', date: new Date(2026, 7, 6) }),
    txn({ type: 'income', amount: 30_000_000, categoryId: 'bonus', date: new Date(2026, 6, 5) }),
  ];
  const out = buildIncomeBreakdown(txns, 'month', NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].amount, 10_000_000);
  assert.equal(out[0].percent, 100);
});

test('chưa có khoản thu nào thì trả mảng rỗng, không chia cho 0', () => {
  assert.deepEqual(buildIncomeBreakdown([], 'month', NOW), []);
});

test('conic-gradient nối các cung liền nhau và lấp phần còn thiếu', () => {
  const g = buildConicGradient(
    [{ color: 'red', percent: 30 }, { color: 'blue', percent: 20 }],
    'grey',
  );
  assert.ok(g.includes('red 0% 30%'), 'cung đầu bắt từ 0');
  assert.ok(g.includes('blue 30% 50%'), 'cung sau nối tiếp, không chồng lấn');
  assert.ok(g.includes('grey 50% 100%'), 'phần thiếu phải được lấp');
});

test('conic-gradient đủ 100% thì không chèn phần lấp', () => {
  const g = buildConicGradient([{ color: 'red', percent: 100 }], 'grey');
  assert.ok(g.includes('red 0% 100%'));
  assert.ok(!g.includes('grey'), 'đã kín vòng thì không cần màu lấp');
});

test('cung "còn lại" phải rơi xuống ĐÁY để mũi tên chỉ đúng chỗ', () => {
  // Mốc đối chứng lấy từ mẫu thiết kế: chưa chi 41,53% → 254,75°.
  assert.equal(Math.round(restAnchoredStartAngle(41.53) * 100) / 100, 254.75);
  // Chưa chi đúng nửa vòng → cung còn lại chiếm nửa sau, tâm ở đáy khi bắt từ 270°.
  assert.equal(restAnchoredStartAngle(50), 270);
  // Không còn dư gì → không cần xoay để né, quay về mốc 180°.
  assert.equal(restAnchoredStartAngle(0), 180);
  assert.ok(restAnchoredStartAngle(41.53) >= 0 && restAnchoredStartAngle(41.53) < 360);
});

test('vòng kín thì không xoay theo phần dư (không có phần dư để canh)', () => {
  const g = buildConicGradient([{ color: 'red', percent: 100 }], 'grey');
  assert.ok(g.startsWith('conic-gradient(from 180deg,'));
});

// ─────────────────────────── Chi tiêu vs ngưỡng ───────────────────────────

test('người mới chưa có tháng trước → chế độ cộng dồn theo ngày', () => {
  const txns = [txn({ amount: 200_000, date: new Date(2026, 7, 2) })];
  assert.equal(hasPriorMonthData(txns, NOW), false);
  const series = buildSpendingSeries(txns, 5_000_000, NOW);
  assert.equal(series.mode, 'cumulative');
  assert.equal(series.points.length, 16, 'từ 1/8 tới hết 16/8');
  assert.equal(series.points[series.points.length - 1].isCurrent, true);
});

test('cộng dồn: vượt ngưỡng từ mốc nào thì từ đó trở đi đều là vượt', () => {
  const txns = [
    txn({ amount: 600_000, date: new Date(2026, 7, 1) }),
    txn({ amount: 600_000, date: new Date(2026, 7, 2) }),
    txn({ amount: 600_000, date: new Date(2026, 7, 3) }),
  ];
  const series = buildSpendingSeries(txns, 1_000_000, NOW);
  assert.equal(series.points[0].cumulative, 600_000);
  assert.equal(series.points[0].isOver, false);
  assert.equal(series.points[1].cumulative, 1_200_000);
  assert.equal(series.points[1].isOver, true, 'vượt từ ngày 2');
  assert.equal(series.points[1].overBy, 200_000);
  // Đã vượt thì các ngày sau không được quay lại "an toàn".
  assert.ok(series.points.slice(1).every((p) => p.isOver), 'vượt rồi phải đỏ tới cuối');
});

test('có tháng trước → chế độ theo tháng, đếm đúng số tháng vượt ngưỡng', () => {
  const txns = [
    txn({ amount: 12_000_000, date: new Date(2026, 5, 10) }), // T6 vượt
    txn({ amount: 4_000_000, date: new Date(2026, 6, 10) }),  // T7 dưới
    txn({ amount: 11_000_000, date: new Date(2026, 7, 10) }), // T8 vượt
  ];
  const series = buildSpendingSeries(txns, 9_000_000, NOW);
  assert.equal(series.mode, 'monthly');
  assert.equal(series.monthsOver, 2);
  assert.equal(series.totalOver, 3_000_000 + 2_000_000);
  assert.equal(series.totalSaved, 5_000_000, 'chỉ T7 được tính tiết kiệm');
});

test('tháng chưa tới KHÔNG được tính là tiết kiệm được cả ngưỡng', () => {
  const txns = [
    txn({ amount: 1_000_000, date: new Date(2026, 5, 10) }),
    txn({ amount: 1_000_000, date: new Date(2026, 7, 10) }),
  ];
  const series = buildSpendingSeries(txns, 9_000_000, NOW);
  const future = series.points.filter((p) => p.label === 'T9' || p.label === 'T12');
  assert.ok(future.every((p) => !p.hasData), 'tháng tương lai phải bị loại');
  assert.ok(future.every((p) => p.savedBy === 0));
  // 2 tháng có chi thật, mỗi tháng dư 8tr.
  assert.equal(series.totalSaved, 16_000_000);
});

test('chưa đặt ngưỡng (0) thì không mốc nào bị coi là vượt', () => {
  const txns = [
    txn({ amount: 50_000_000, date: new Date(2026, 5, 1) }),
    txn({ amount: 50_000_000, date: new Date(2026, 7, 1) }),
  ];
  const series = buildSpendingSeries(txns, 0, NOW);
  assert.equal(series.monthsOver, 0);
  assert.equal(series.totalOver, 0);
  assert.equal(series.totalSaved, 0);
});

// ─────────────────────────── Hóa đơn theo tháng ───────────────────────────

test('tổng hóa đơn theo tháng gộp mọi hóa đơn và tính % chênh', () => {
  const ps = [
    payment('dien', '2026-06', 1_000_000),
    payment('nuoc', '2026-06', 200_000),
    payment('dien', '2026-07', 1_500_000),
    payment('nuoc', '2026-07', 300_000),
  ];
  const out = buildBillMonthTotals(ps, 2026, NOW);
  const jun = out.find((m) => m.label === 'T6')!;
  const jul = out.find((m) => m.label === 'T7')!;
  assert.equal(jun.amount, 1_200_000);
  assert.equal(jul.amount, 1_800_000);
  assert.equal(jun.changePercent, null, 'tháng đầu chưa có mốc so');
  assert.equal(jul.changePercent, 50, 'tăng 50%');
});

test('tháng không đóng hóa đơn không làm mốc so sánh (tránh -100% giả)', () => {
  const ps = [payment('dien', '2026-03', 1_000_000), payment('dien', '2026-07', 1_200_000)];
  const out = buildBillMonthTotals(ps, 2026, NOW);
  assert.equal(out.find((m) => m.label === 'T4')!.changePercent, null);
  assert.equal(out.find((m) => m.label === 'T7')!.changePercent, 20, 'so với T3, không so với T6 rỗng');
});

test('đánh dấu đúng tháng hiện tại', () => {
  const out = buildBillMonthTotals([], 2026, NOW);
  assert.equal(out.filter((m) => m.isCurrent).length, 1);
  assert.equal(out.find((m) => m.isCurrent)!.label, 'T8');
});

// ─────────────────────────── Ngân sách vs thu nhập ───────────────────────────

test('ngân sách tách rõ phần chi tiêu và phần hóa đơn', () => {
  const c = getBudgetComposition(20_000_000, 6_000_000, 4_000_000)!;
  assert.equal(c.budget, 10_000_000);
  assert.equal(c.budgetPercentOfIncome, 50);
  assert.equal(c.spendingPercentOfIncome, 30);
  assert.equal(c.billPercentOfIncome, 20);
  assert.equal(c.leftover, 10_000_000);
  assert.equal(c.isOverIncome, false);
});

test('ngân sách ngốn hết hoặc vượt thu nhập thì phải bật cờ cảnh báo', () => {
  const c = getBudgetComposition(10_000_000, 7_000_000, 5_000_000)!;
  assert.equal(c.isOverIncome, true);
  assert.equal(c.leftover, -2_000_000, 'thiếu hụt giữ dấu âm, không kẹp về 0');
});

test('chưa có thu nhập → trả null thay vì chia cho 0', () => {
  assert.equal(getBudgetComposition(0, 5_000_000, 1_000_000), null);
  assert.equal(getBudgetComposition(-1, 5_000_000, 1_000_000), null);
});

// ─────────────────────────── Chuyển khoản vs tiền mặt ───────────────────────────

test('tách chi chuyển khoản và tiền mặt trong kỳ hiện tại', () => {
  const txns = [
    txn({ amount: 3_000_000, method: 'cash', date: new Date(2026, 7, 5) }),
    txn({ amount: 1_000_000, method: 'transfer', date: new Date(2026, 7, 6) }),
    txn({ amount: 9_000_000, method: 'cash', date: new Date(2026, 6, 5) }), // tháng trước, loại
  ];
  const split = getMethodSplit(txns, 'expense', 'month', NOW);
  assert.equal(split.cash, 3_000_000);
  assert.equal(split.bank, 1_000_000);
  assert.equal(split.cashPercent, 75);
  assert.equal(split.bankPercent, 25);
});

test('không có giao dịch nào thì % là 0, không phải NaN', () => {
  const split = getMethodSplit([], 'expense', 'month', NOW);
  assert.equal(split.total, 0);
  assert.equal(split.cashPercent, 0);
  assert.equal(split.bankPercent, 0);
  assert.ok(!Number.isNaN(split.cashPercent));
});
