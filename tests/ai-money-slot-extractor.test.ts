/* Phase 2 — Slot extractor: period / days / wallet / category / bill / goal / task */
import { extractSlots } from '@/lib/aiMoneyChat/intent/slotExtractor';

type TestFn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function main() {
  describe('period');
  it('hôm nay -> today', () => eq(extractSlots('hôm nay tôi chi bao nhiêu').period, 'today'));
  it('hom nay (không dấu) -> today', () => eq(extractSlots('hom nay chi bao nhieu').period, 'today'));
  it('tháng này -> this_month', () => eq(extractSlots('tháng này tôi thu bao nhiêu').period, 'this_month'));
  it('tháng trước -> last_month', () => eq(extractSlots('tháng trước chi bao nhiêu').period, 'last_month'));
  it('tuần này -> this_week', () => eq(extractSlots('tuần này thu bao nhiêu').period, 'this_week'));
  it('không nêu period -> undefined', () => eq(extractSlots('tôi còn bao nhiêu tiền').period, undefined));

  describe('days');
  it('"7 ngày tới" -> 7', () => eq(extractSlots('7 ngày tới có bill nào').days, 7));
  it('"3 ngày tới" -> 3', () => eq(extractSlots('3 ngày tới phải đóng bill nào').days, 3));
  it('"tuần tới" -> 7', () => eq(extractSlots('tuần tới có bill nào').days, 7));
  it('không nêu -> undefined', () => eq(extractSlots('bill nào chưa đóng').days, undefined));

  describe('wallet');
  it('ví chính -> main', () => eq(extractSlots('ví chính còn bao nhiêu').wallet, 'main'));
  it('quỹ dự phòng -> emergency', () => eq(extractSlots('quỹ dự phòng còn bao nhiêu').wallet, 'emergency'));
  it('quỹ bill -> bill-fund', () => eq(extractSlots('quỹ bill còn bao nhiêu').wallet, 'bill-fund'));

  describe('category');
  it('ăn uống -> food', () => eq(extractSlots('ăn uống tháng này xài bao nhiêu').categoryId, 'food'));
  it('cà phê -> coffee', () => eq(extractSlots('cà phê tháng này hết bao nhiêu').categoryId, 'coffee'));
  it('giải trí -> entertainment', () => eq(extractSlots('giải trí tháng này chi bao nhiêu').categoryId, 'entertainment'));
  it('di chuyển -> transport', () => eq(extractSlots('di chuyển tháng này tốn bao nhiêu').categoryId, 'transport'));

  describe('bill name');
  it('tiền điện -> điện', () => eq(extractSlots('tiền điện đóng chưa').billName, 'điện'));
  it('internet -> internet', () => eq(extractSlots('internet trả chưa').billName, 'internet'));

  describe('goal name');
  it('mua nhà -> mua nhà', () => eq(extractSlots('mục tiêu mua nhà còn thiếu bao nhiêu').goalName, 'mua nhà'));
  it('quỹ khẩn cấp -> quỹ khẩn cấp', () => eq(extractSlots('quỹ khẩn cấp đạt bao nhiêu phần trăm').goalName, 'quỹ khẩn cấp'));

  describe('task status');
  it('trễ hạn -> overdue', () => eq(extractSlots('task nào trễ hạn').taskStatus, 'overdue'));
  it('đang làm -> active', () => eq(extractSlots('task nào đang làm').taskStatus, 'active'));
  it('hoàn thành -> completed', () => eq(extractSlots('task nào đã hoàn thành').taskStatus, 'completed'));

  describe('empty slots');
  it('"tôi còn bao nhiêu tiền" -> 0 key', () => eq(Object.keys(extractSlots('tôi còn bao nhiêu tiền')).length, 0));

  console.log('\nslot extractor test complete.');
}

main();
