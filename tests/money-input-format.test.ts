/* ═══ Test — gõ số tiền tự chấm + đổi danh xưng quản gia ═══
 *
 * Hai thứ PO báo cùng lúc, gom một file vì đều là hàm thuần và đều là "hiển thị
 * đúng thứ người dùng mong đợi":
 *   1. formatAmountInput — gõ tiền phải tự chấm để đọc được bao nhiêu.
 *   2. replaceButlerName — đặt danh xưng thì MỌI chỗ phải đổi theo.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { formatAmountInput } from '@/utils/formatCurrency';
import { replaceButlerName, butlerInitials } from '@/utils/butlerNameUtils';

// ─────────────────────────── Gõ số tiền ───────────────────────────

test('chấm phân cách nghìn kiểu Việt', () => {
  assert.equal(formatAmountInput('100000000'), '100.000.000');
  assert.equal(formatAmountInput('3000000'), '3.000.000');
  assert.equal(formatAmountInput('1000'), '1.000');
});

test('số ngắn chưa cần chấm thì để nguyên', () => {
  assert.equal(formatAmountInput('5'), '5');
  assert.equal(formatAmountInput('999'), '999');
});

test('rỗng ra rỗng — KHÔNG ra "0"', () => {
  // Ra "0" thì ô nhập không bao giờ xoá trắng được, gõ xong xoá vẫn còn số 0.
  assert.equal(formatAmountInput(''), '');
  assert.equal(formatAmountInput('abc'), '');
});

test('gõ tiếp vào chuỗi ĐÃ có dấu chấm vẫn đúng', () => {
  // Ô nhập gọi lại hàm này trên chính giá trị đã format ở lần gõ trước, nên
  // hàm bắt buộc phải nuốt được dấu chấm cũ. Không thì gõ tới số thứ tư là loạn.
  assert.equal(formatAmountInput('100.000'), '100.000');
  assert.equal(formatAmountInput('100.0001'), '1.000.001');
});

test('lọc sạch ký tự rác, giữ đúng chữ số', () => {
  assert.equal(formatAmountInput('12a3b4'), '1.234');
  assert.equal(formatAmountInput('1 000 000'), '1.000.000');
  assert.equal(formatAmountInput('-500'), '500');
});

test('chặn độ dài để không tràn số nguyên an toàn', () => {
  const out = formatAmountInput('9'.repeat(30));
  assert.equal(out.replace(/\D/g, '').length, 15);
});

test('nơi lưu lọc \D vẫn ra đúng số — chuỗi có chấm không phá phép lưu', () => {
  // Đây chính là lý do đổi sang chấm được mà không phải sửa chỗ lưu.
  const shown = formatAmountInput('6000000000');
  assert.equal(shown, '6.000.000.000');
  assert.equal(Number(shown.replace(/\D/g, '')), 6_000_000_000);
});

// ─────────────────────────── Danh xưng quản gia ───────────────────────────

test('đổi tên mặc định sang danh xưng người dùng đặt', () => {
  assert.equal(
    replaceButlerName('Lord Diamond đang viết...', 'Vượng Tài'),
    'Vượng Tài đang viết...',
  );
});

test('đổi HẾT mọi lần xuất hiện trong một đoạn', () => {
  // Chữ AI sinh ra hay nhắc tên nhiều lần trong cùng một câu trả lời.
  const raw = 'Lord Diamond đã xem sổ. Lord Diamond khuyên ngài tiết kiệm thêm.';
  assert.equal(
    replaceButlerName(raw, 'Thần Tài'),
    'Thần Tài đã xem sổ. Thần Tài khuyên ngài tiết kiệm thêm.',
  );
});

test('chưa đặt tên hoặc đặt đúng tên mặc định thì giữ nguyên', () => {
  const raw = 'Lord Diamond ghi nhận.';
  assert.equal(replaceButlerName(raw, ''), raw);
  assert.equal(replaceButlerName(raw, 'Lord Diamond'), raw);
});

test('chữ cái viết tắt cho avatar theo đúng tên đã đặt', () => {
  assert.equal(butlerInitials('Lord Diamond'), 'LD');
  assert.equal(butlerInitials('Vượng Tài'), 'VT');
  assert.equal(butlerInitials('Pic Cà Pu'), 'PP');
  assert.equal(butlerInitials(''), 'LD');
});
