/* ═══ Test — luật chống lạm dụng ═══
 * Canh đúng thứ dễ hỏng nhất: đừng khoá nhầm người thật, và đừng để cuộc tấn
 * công tự biến thành hoá đơn Firestore.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { RULES, judge, ruleFor, shouldRecord } from '@/lib/abuse/policy';
import { incrementCounter, isDistributed, __resetLocalCounters } from '@/lib/abuse/counterStore';

test('người sốt ruột bấm lại vài lần vẫn là bình thường', () => {
  // Mạng lag → bấm 5 lần, tải lại 3 lần. Không được coi là tấn công.
  assert.equal(judge(8, RULES.api), 'ok');
});

test('chỉ khoá ở tốc độ bot, không phải tốc độ người', () => {
  assert.equal(judge(RULES.api.watchAt, RULES.api), 'watch');
  assert.equal(judge(RULES.api.lockAt - 1, RULES.api), 'watch');
  assert.equal(judge(RULES.api.lockAt, RULES.api), 'lock');
});

test('ngưỡng khoá đường thường phải cao hơn tay người gõ nhiều lần', () => {
  // 600 request/phút = 10 lần/giây liên tục trong 60 giây. Tay người không đạt.
  assert.ok(RULES.api.lockAt >= 300, 'ngưỡng khoá quá thấp, sẽ khoá nhầm người thật');
});

test('đường gọi AI phải chặt hơn hẳn đường thường — mỗi lượt tốn tiền thật', () => {
  assert.ok(RULES.ai.lockAt < RULES.api.lockAt / 5);
});

test('đếm hỏng (0) thì KHÔNG khoá ai', () => {
  // Redis trục trặc mà khoá người dùng thật là hỏng nặng hơn cả bỏ lọt kẻ phá.
  assert.equal(judge(0, RULES.api), 'ok');
});

test('CHỈ ghi Firestore đúng lần vượt ngưỡng, không ghi mọi request sau đó', () => {
  // Nếu ghi mọi lượt thì kẻ đánh 10.000 lượt/phút biến cuộc tấn công thành
  // hoá đơn Firestore — đúng thứ họ muốn.
  const r = RULES.api;
  assert.equal(shouldRecord(r.watchAt, r), true);
  assert.equal(shouldRecord(r.watchAt + 1, r), false);
  assert.equal(shouldRecord(r.lockAt, r), true);
  assert.equal(shouldRecord(r.lockAt + 500, r), false);
});

test('loại đường lạ thì rơi về luật api, không văng', () => {
  assert.deepEqual(ruleFor('khong-ton-tai'), RULES.api);
});

test('bộ đếm rơi-về đếm tăng dần và tự reset khi hết cửa sổ', async () => {
  __resetLocalCounters();
  assert.equal(isDistributed(), false, 'test này chạy ở chế độ rơi-về');
  assert.equal(await incrementCounter('k1', 60), 1);
  assert.equal(await incrementCounter('k1', 60), 2);
  // Cửa sổ 0 giây → lần sau phải bắt đầu lại từ 1.
  assert.equal(await incrementCounter('k2', 0), 1);
  assert.equal(await incrementCounter('k2', 0), 1);
});

test('hai key khác nhau đếm độc lập', async () => {
  __resetLocalCounters();
  await incrementCounter('a', 60);
  await incrementCounter('a', 60);
  assert.equal(await incrementCounter('b', 60), 1);
});
