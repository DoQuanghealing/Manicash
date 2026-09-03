/* ═══ Test — chế độ giả lập ═══
 * Canh ba thứ: bộ kiểm phải chỉ đúng chỗ sai, dịch ngày phải giữ khoảng cách,
 * và id phải đúng dạng để màn CRM còn đọc được.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { validateSimFile, type SimFile } from '@/lib/simulation/schema';
import {
  buildSimulation,
  expandDates,
  latestDateIn,
  shiftDate,
} from '@/lib/simulation/build';
import { parseRecordedAt } from '@/lib/behavior/usageMetrics';

const NOW = new Date(2026, 8, 10, 12, 0, 0); // 10/09/2026

// ─────────────────────────── Bộ kiểm ───────────────────────────

test('file hợp lệ thì qua', () => {
  const r = validateSimFile({
    transactions: [{ date: '2026-09-01', type: 'expense', categoryId: 'food', amount: 50000 }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test('báo HẾT lỗi cùng lúc, không dừng ở lỗi đầu', () => {
  // Sửa từng lỗi rồi nạp lại năm lần thì rất nản.
  const r = validateSimFile({
    transactions: [{ date: 'hôm qua', type: 'chi', categoryId: '', amount: -5 }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 4, `phải báo ít nhất 4 lỗi, chỉ có ${r.errors.length}`);
});

test('lỗi phải chỉ ĐÚNG chỗ sai', () => {
  const r = validateSimFile({
    transactions: [
      { date: '2026-09-01', type: 'expense', categoryId: 'food', amount: 1000 },
      { date: '2026-13-45', type: 'expense', categoryId: 'food', amount: 1000 },
    ],
  });
  assert.ok(r.errors.some((e) => e.includes('transactions[1].date')), r.errors.join(' | '));
});

test('ngày 31/02 bị bắt, không nhận bừa', () => {
  const r = validateSimFile({
    transactions: [{ date: '2026-02-31', type: 'expense', categoryId: 'food', amount: 1000 }],
  });
  assert.equal(r.ok, false);
});

test('repeatUntil sớm hơn date thì bị bắt', () => {
  const r = validateSimFile({
    transactions: [
      { date: '2026-09-10', repeatUntil: '2026-09-01', type: 'expense', categoryId: 'food', amount: 1000 },
    ],
  });
  assert.ok(r.errors.some((e) => e.includes('repeatUntil')));
});

test('góp nhiều hơn mục tiêu là CẢNH BÁO, không phải lỗi', () => {
  // Vẫn dựng được, chỉ là thanh tiến độ đầy — không nên chặn người dùng vì việc đó.
  const r = validateSimFile({ goals: [{ name: 'Xe', target: 100, current: 200 }] });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes('goals[0]')));
});

test('file rỗng cảnh báo sẽ trống màn, nhưng không chặn', () => {
  const r = validateSimFile({});
  assert.equal(r.ok, true);
  assert.ok(r.warnings.length > 0);
});

test('không phải object thì từ chối tử tế', () => {
  assert.equal(validateSimFile([]).ok, false);
  assert.equal(validateSimFile(null).ok, false);
  assert.equal(validateSimFile('x').ok, false);
});

// ─────────────────────────── Trải ngày lặp ───────────────────────────

test('repeatUntil trải ra từng ngày', () => {
  const days = expandDates({
    date: '2026-09-01', repeatUntil: '2026-09-05',
    type: 'expense', categoryId: 'food', amount: 1000,
  });
  assert.deepEqual(days, ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
});

test('không repeat thì đúng một ngày', () => {
  assert.deepEqual(
    expandDates({ date: '2026-09-01', type: 'expense', categoryId: 'food', amount: 1000 }),
    ['2026-09-01'],
  );
});

test('repeatUntil xa 10 năm bị cắt, không treo trình duyệt', () => {
  const days = expandDates({
    date: '2020-01-01', repeatUntil: '2030-01-01',
    type: 'expense', categoryId: 'food', amount: 1000,
  });
  assert.ok(days.length <= 400, `phải cắt ở 400, đang ${days.length}`);
});

// ─────────────────────────── Dịch mốc về hôm nay ───────────────────────────

const FILE: SimFile = {
  transactions: [
    { date: '2026-01-05', type: 'income', categoryId: 'salary', amount: 20_000_000 },
    { date: '2026-01-10', type: 'expense', categoryId: 'food', amount: 50_000 },
  ],
  tasks: [{ name: 'Freelance', expected: 3_000_000, start: '2026-01-02', end: '2026-01-08' }],
};

test('dịch xong ngày mới nhất rơi vào HÔM NAY', () => {
  const out = buildSimulation(FILE, { now: NOW });
  assert.equal(out.latestAfterShift, '2026-09-10');
});

test('dịch giữ NGUYÊN khoảng cách giữa các ngày', () => {
  // Trong file cách nhau 5 ngày → sau khi dịch vẫn phải 5 ngày.
  const out = buildSimulation(FILE, { now: NOW });
  const keys = out.transactions.map((t) => t.dateKey).sort();
  assert.deepEqual(keys, ['2026-09-05', '2026-09-10']);
});

test('tắt dịch thì giữ đúng ngày trong file', () => {
  const out = buildSimulation(FILE, { now: NOW, shiftToToday: false });
  assert.equal(out.shiftDays, 0);
  assert.deepEqual(out.transactions.map((t) => t.dateKey).sort(), ['2026-01-05', '2026-01-10']);
});

test('hạn mục tiêu KHÔNG được dùng làm mốc dịch', () => {
  // Mục tiêu "mua nhà 2030" mà lấy làm mốc thì cả sổ sách bị kéo lùi 4 năm.
  const withGoal: SimFile = { ...FILE, goals: [{ name: 'Mua nhà', target: 9e8, deadline: '2030-12-31' }] };
  assert.equal(latestDateIn(withGoal), '2026-01-10');
});

test('giao dịch bị dịch sang TƯƠNG LAI thì bỏ, không hiện', () => {
  // Sổ sách hiện khoản chi của ngày mai là thứ khách hỏi ngay.
  const f: SimFile = {
    transactions: [
      { date: '2026-01-10', type: 'expense', categoryId: 'food', amount: 1000 },
      { date: '2026-01-20', type: 'expense', categoryId: 'food', amount: 1000 },
    ],
  };
  // Mốc là 20/01 → dịch để 20/01 thành hôm nay; 10/01 lùi về quá khứ. Không cái nào ở tương lai.
  const out = buildSimulation(f, { now: NOW });
  const todayKey = '2026-09-10';
  assert.ok(out.transactions.every((t) => t.dateKey <= todayKey));
  assert.equal(out.transactions.length, 2);
});

test('shiftDate dịch ngày lẻ cùng mốc với giao dịch', () => {
  const out = buildSimulation(FILE, { now: NOW });
  assert.equal(shiftDate('2026-01-02', out.shiftDays), '2026-09-02');
});

// ─────────────────────────── Ràng buộc với màn CRM ───────────────────────────

test('id giao dịch phải đúng dạng để CRM moi được mốc ghi', () => {
  // Bộ chỉ số hành vi lấy mốc GHI từ chính id. Sai dạng là toàn bộ dữ liệu demo
  // bị CRM đọc thành "không tính được".
  const out = buildSimulation(FILE, { now: NOW });
  assert.ok(out.transactions.length > 0);
  for (const t of out.transactions) {
    assert.notEqual(parseRecordedAt(t.id), null, `id sai dạng: ${t.id}`);
  }
});

test('mỗi giao dịch một id riêng', () => {
  const f: SimFile = {
    transactions: [
      { date: '2026-01-01', repeatUntil: '2026-01-20', type: 'expense', categoryId: 'food', amount: 1000 },
    ],
  };
  const out = buildSimulation(f, { now: NOW });
  assert.equal(new Set(out.transactions.map((t) => t.id)).size, out.transactions.length);
});

test('giờ được rải, không dồn hết vào một mốc', () => {
  const f: SimFile = {
    transactions: [
      { date: '2026-01-01', repeatUntil: '2026-01-06', type: 'expense', categoryId: 'food', amount: 1000 },
    ],
  };
  const out = buildSimulation(f, { now: NOW });
  assert.ok(new Set(out.transactions.map((t) => t.time)).size > 1);
});
