/* ═══ Test — chỉ số hành vi dùng app ═══
 * Canh mấy chỗ dễ sai nhất: mốc "ghi lúc nào" moi từ id, trung vị chống điểm lạ,
 * và tín hiệu tư vấn phải ưu tiên đúng thứ khẩn.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  buildUsageBehavior,
  parseRecordedAt,
  readUsageSignal,
  type UsageFeatures,
} from '@/lib/behavior/usageMetrics';

const NOW = new Date(2026, 8, 3, 20, 0, 0); // 03/09/2026 20:00 giờ địa phương
const DAY = 86_400_000;

const NO_FEATURES: UsageFeatures = { goals: false, chat: false, tasks: false, bills: false };
const ALL_FEATURES: UsageFeatures = { goals: true, chat: true, tasks: true, bills: true };

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Giao dịch xảy ra `dAgo` ngày trước, được ghi trễ `lagMin` phút. */
function txn(dAgo: number, lagMin = 0, seq = 0) {
  const happened = new Date(NOW.getTime() - dAgo * DAY);
  const recorded = happened.getTime() + lagMin * 60_000;
  return { id: `txn-${recorded}-a${seq}`, dateKey: key(happened), date: happened.toISOString() };
}

// ─────────────────────────── Mốc ghi moi từ id ───────────────────────────

test('moi được mốc ghi từ id sinh tự động', () => {
  assert.equal(parseRecordedAt('txn-1756900000000-ab12'), 1756900000000);
});

test('id KHÔNG đúng dạng thì trả null — không đoán bừa', () => {
  // Giao dịch seed của trang xem thử, hoặc bản rất cũ. Đoán bừa là bịa số liệu.
  assert.equal(parseRecordedAt('seed-12'), null);
  assert.equal(parseRecordedAt('txn-abc-1'), null);
  assert.equal(parseRecordedAt(''), null);
});

test('giao dịch không moi được mốc ghi thì KHÔNG vào mẫu tính trễ', () => {
  const b = buildUsageBehavior({
    transactions: [
      { id: 'seed-1', dateKey: key(NOW), date: NOW.toISOString() },
      txn(0, 30, 1),
    ],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.lagSampleSize, 1);
});

// ─────────────────────────── Đều đặn ───────────────────────────

test('đếm đúng số ngày có ghi trong 7 và 30 ngày', () => {
  const b = buildUsageBehavior({
    transactions: [txn(0), txn(1, 0, 1), txn(3, 0, 2), txn(10, 0, 3), txn(40, 0, 4)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.daysLogged7, 3);   // hôm nay, 1, 3
  assert.equal(b.daysLogged30, 4);  // thêm ngày thứ 10; ngày 40 ngoài cửa sổ
});

test('nhiều giao dịch trong CÙNG một ngày chỉ tính là một ngày', () => {
  const b = buildUsageBehavior({
    transactions: [txn(0, 0, 1), txn(0, 0, 2), txn(0, 0, 3)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.daysLogged7, 1);
});

test('chưa ghi hôm nay vẫn giữ chuỗi tính từ hôm qua', () => {
  // Không thì suốt cả ngày hôm nay chuỗi hiện 0 và người dùng tưởng đã mất chuỗi.
  const b = buildUsageBehavior({
    transactions: [txn(1, 0, 1), txn(2, 0, 2), txn(3, 0, 3)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.currentStreak, 3);
});

test('đứt quãng đủ dài mà gần đây vẫn ghi = đã quay lại', () => {
  const b = buildUsageBehavior({
    transactions: [txn(0, 0, 1), txn(9, 0, 2), txn(10, 0, 3)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.ok(b.longestGapDays >= 3);
  assert.equal(b.returnedAfterGap, true);
});

test('đứt quãng rồi im luôn thì KHÔNG phải quay lại', () => {
  const b = buildUsageBehavior({
    transactions: [txn(20, 0, 1), txn(21, 0, 2)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.daysLogged7, 0);
  assert.equal(b.returnedAfterGap, false);
});

// ─────────────────────────── Ghi ngay hay dồn ───────────────────────────

test('ghi ngay thì tỉ lệ "ghi sớm" đạt 100%', () => {
  const b = buildUsageBehavior({
    transactions: [txn(0, 5, 1), txn(1, 10, 2), txn(2, 15, 3)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.promptRate, 100);
  assert.equal(b.medianLagMinutes, 10);
});

test('MỘT lần nhập bù không được bôi đen cả hồ sơ — dùng trung vị', () => {
  // Trung bình của [5,10,15,43200] là ~10.808 phút; trung vị là 12,5 → 13.
  const b = buildUsageBehavior({
    transactions: [txn(0, 5, 1), txn(1, 10, 2), txn(2, 15, 3), txn(3, 43_200, 4)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.ok(b.medianLagMinutes !== null && b.medianLagMinutes < 60, `trung vị ${b.medianLagMinutes} phải nhỏ`);
});

test('ghi TRƯỚC lúc tiêu không bị tính là trễ', () => {
  const b = buildUsageBehavior({ transactions: [txn(0, -600, 1)], features: NO_FEATURES, now: NOW });
  assert.equal(b.medianLagMinutes, 0);
});

test('không có mẫu nào thì trả null chứ không phải 0', () => {
  // 0 nghĩa là "ghi cực nhanh"; null nghĩa là "chưa biết". Lẫn hai cái là đọc sai người dùng.
  const b = buildUsageBehavior({ transactions: [], features: NO_FEATURES, now: NOW });
  assert.equal(b.medianLagMinutes, null);
  assert.equal(b.sameDayRate, null);
  assert.equal(b.lagSampleSize, 0);
});

// ─────────────────────────── Độ sâu + tín hiệu ───────────────────────────

test('đếm đúng số tính năng đã chạm', () => {
  const b = buildUsageBehavior({ transactions: [], features: ALL_FEATURES, now: NOW });
  assert.equal(b.featureDepth, 4);
});

test('quá ít dữ liệu thì KHÔNG phán, trả "chưa đủ dữ liệu"', () => {
  const b = buildUsageBehavior({ transactions: [txn(0)], features: NO_FEATURES, now: NOW });
  assert.equal(readUsageSignal(b), 'chua_du_du_lieu');
});

test('tín hiệu ưu tiên người sắp trôi hơn mọi thứ khác', () => {
  const b = buildUsageBehavior({
    transactions: Array.from({ length: 8 }, (_, i) => txn(10 + i, 0, i)),
    features: ALL_FEATURES,
    now: NOW,
  });
  assert.equal(b.daysLogged7, 0);
  assert.equal(readUsageSignal(b), 'dang_troi');
});

test('ghi đều + dùng sâu thì khen', () => {
  const b = buildUsageBehavior({
    transactions: Array.from({ length: 10 }, (_, i) => txn(i, 5, i)),
    features: ALL_FEATURES,
    now: NOW,
  });
  assert.equal(readUsageSignal(b), 'ghi_deu');
});

test('hồ sơ KHÔNG chứa số tiền — chỉ hành vi', () => {
  // Canh cứng ranh giới: thêm tiền vào đây là biến tệp hành vi thành tệp tài chính.
  const b = buildUsageBehavior({ transactions: [txn(0, 5)], features: NO_FEATURES, now: NOW });
  const s = JSON.stringify(b);
  assert.ok(!/amount|tien|balance/i.test(s), 'không được lọt trường tiền');
});

test('người MỚI dùng liên tục không bị gắn nhãn "đã quay lại"', () => {
  // Lỗi đã từng mắc: quét trọn 30 ngày nên những ngày TRƯỚC KHI người ta biết
  // tới app cũng bị tính là bỏ bê. Chỉ được tính đứt quãng từ ngày ghi đầu tiên.
  const b = buildUsageBehavior({
    transactions: Array.from({ length: 6 }, (_, i) => txn(i, 5, i)),
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.longestGapDays, 0);
  assert.equal(b.returnedAfterGap, false);
});

test('bỏ bê THẬT ở giữa vẫn bị bắt', () => {
  // ngày 0,1 có ghi · 2,3,4,5 trống · 6,7 có ghi → đứt 4 ngày ở giữa
  const b = buildUsageBehavior({
    transactions: [txn(0, 5, 1), txn(1, 5, 2), txn(6, 5, 3), txn(7, 5, 4)],
    features: NO_FEATURES,
    now: NOW,
  });
  assert.equal(b.longestGapDays, 4);
  assert.equal(b.returnedAfterGap, true);
});
