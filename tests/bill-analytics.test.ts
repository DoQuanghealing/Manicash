/* ═══ Test — billAnalytics (hạn đóng + lịch sử hóa đơn) ═══ */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { BillPayment, FixedBill } from '@/stores/useFinanceStore';
import {
  buildBillSlices,
  buildBillYearSeries,
  getBillDueStatus,
  getBillShareOfIncome,
} from '@/lib/billAnalytics';

/** 13/08/2026 giờ địa phương. */
const NOW = new Date(2026, 7, 13, 10, 0, 0);

function bill(p: Partial<FixedBill> & { dueDay: number }): FixedBill {
  return {
    id: p.id ?? 'b1',
    name: p.name ?? 'Tiền điện',
    icon: p.icon ?? '⚡',
    amount: p.amount ?? 1_200_000,
    dueDay: p.dueDay,
    isPaid: p.isPaid ?? false,
  };
}

test('đã đóng thì báo "Đã thanh toán", không tính ngày', () => {
  const s = getBillDueStatus(bill({ dueDay: 5, isPaid: true }), NOW);
  assert.equal(s.tone, 'paid');
  assert.equal(s.label, 'Đã thanh toán');
  assert.equal(s.daysLeft, null);
});

test('mốc màu: >7 ngày xám · ≤7 xanh · ≤3 cam · quá hạn đỏ', () => {
  assert.equal(getBillDueStatus(bill({ dueDay: 25 }), NOW).tone, 'later');   // còn 12 ngày
  assert.equal(getBillDueStatus(bill({ dueDay: 20 }), NOW).tone, 'soon');    // còn 7 ngày
  assert.equal(getBillDueStatus(bill({ dueDay: 20 }), NOW).label, 'Còn 7 ngày');
  assert.equal(getBillDueStatus(bill({ dueDay: 16 }), NOW).tone, 'urgent');  // còn 3 ngày
  assert.equal(getBillDueStatus(bill({ dueDay: 14 }), NOW).tone, 'urgent');  // còn 1 ngày
  assert.equal(getBillDueStatus(bill({ dueDay: 13 }), NOW).label, 'Tới hạn hôm nay');
  const late = getBillDueStatus(bill({ dueDay: 10 }), NOW);
  assert.equal(late.tone, 'overdue');
  assert.equal(late.label, 'Quá hạn 3 ngày');
});

test('ranh giới 7/8 ngày không nhảy sai màu', () => {
  assert.equal(getBillDueStatus(bill({ dueDay: 21 }), NOW).tone, 'later', 'còn 8 ngày vẫn là xa');
  assert.equal(getBillDueStatus(bill({ dueDay: 20 }), NOW).tone, 'soon', 'còn đúng 7 ngày là xanh');
  assert.equal(getBillDueStatus(bill({ dueDay: 17 }), NOW).tone, 'soon', 'còn 4 ngày vẫn xanh');
  assert.equal(getBillDueStatus(bill({ dueDay: 16 }), NOW).tone, 'urgent', 'còn đúng 3 ngày là cam');
});

test('hạn ngày 31 ở tháng 30 ngày lùi về ngày cuối tháng', () => {
  const inApril = new Date(2026, 3, 25, 10, 0); // tháng 4 có 30 ngày
  const s = getBillDueStatus(bill({ dueDay: 31 }), inApril);
  assert.equal(s.daysLeft, 5, 'hạn phải là 30/4 chứ không phải ngày không tồn tại');
  assert.equal(s.label, 'Còn 5 ngày');
});

function payment(month: string, amount: number, billId = 'bill-electric'): BillPayment {
  return {
    id: `bp-${billId}-${month}`,
    billId,
    billName: 'Tiền điện',
    icon: '⚡',
    amount,
    month,
    paidAt: `${month}-15T10:00:00.000Z`,
  };
}

test('biểu đồ năm: đủ 12 tháng, %tăng giảm so với lần đóng gần nhất', () => {
  const payments = [
    payment('2026-01', 1_000_000),
    payment('2026-02', 1_200_000),  // +20%
    payment('2026-03', 900_000),    // -25%
    payment('2026-08', 1_800_000),  // +100% so với tháng 3 (tháng 4-7 không đóng)
    payment('2026-05', 500_000, 'bill-water'), // hóa đơn khác — phải bị bỏ qua
  ];
  const series = buildBillYearSeries(payments, 'bill-electric', 2026, NOW);

  assert.equal(series.length, 12);
  assert.equal(series[0].changePercent, null, 'tháng đầu chưa có mốc so');
  assert.equal(series[1].changePercent, 20);
  assert.equal(series[2].changePercent, -25);
  assert.equal(series[3].amount, 0, 'tháng 4 không đóng');
  assert.equal(series[3].changePercent, null, 'tháng trống KHÔNG được tính -100%');
  assert.equal(series[7].amount, 1_800_000);
  assert.equal(series[7].changePercent, 100, 'so với lần đóng gần nhất là tháng 3');
  assert.equal(series[7].isCurrent, true);
  assert.equal(series.filter((p) => p.isCurrent).length, 1);
});

test('biểu đồ năm rỗng khi chưa có lịch sử', () => {
  const series = buildBillYearSeries([], 'bill-electric', 2026, NOW);
  assert.equal(series.length, 12);
  assert.ok(series.every((p) => p.amount === 0 && p.changePercent === null));
});

test('cung tròn hóa đơn: sắp giảm dần, % ~100, mỗi hóa đơn một màu', () => {
  const bills = [
    bill({ id: 'rent', name: 'Tiền nhà', amount: 6_000_000, dueDay: 5 }),
    bill({ id: 'tuition', name: 'Tiền học', amount: 4_000_000, dueDay: 10 }),
    bill({ id: 'elec', name: 'Tiền điện', amount: 1_200_000, dueDay: 15 }),
    bill({ id: 'water', name: 'Tiền nước', amount: 300_000, dueDay: 15 }),
  ];
  const slices = buildBillSlices(bills);
  assert.equal(slices[0].billId, 'rent');
  assert.equal(slices[0].percent, 52.2);
  assert.equal(new Set(slices.map((s) => s.color)).size, 4, 'không trùng màu');
  const sum = slices.reduce((s, x) => s + x.percent, 0);
  assert.ok(Math.abs(sum - 100) < 0.5, `tổng % phải ~100, đang ${sum}`);
  assert.deepEqual(buildBillSlices([]), []);
});

test('tỷ trọng hóa đơn trên thu nhập; thu nhập 0 thì trả null', () => {
  assert.equal(getBillShareOfIncome(11_500_000, 37_550_000), 30.6);
  assert.equal(getBillShareOfIncome(11_500_000, 0), null, 'không được chia cho 0');
  assert.equal(getBillShareOfIncome(0, 10_000_000), 0);
});
