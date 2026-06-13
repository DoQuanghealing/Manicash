/* Phase 4A — amount parser */
import { parseMoneyAmount } from '@/lib/aiMoneyChat/actions/amountParser';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown): void {
  if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function main() {
  console.log('\namount parser');
  it('50k -> 50.000', () => eq(parseMoneyAmount('ghi chi 50k cà phê'), 50_000));
  it('500 nghìn -> 500.000', () => eq(parseMoneyAmount('500 nghìn'), 500_000));
  it('500 ngan -> 500.000', () => eq(parseMoneyAmount('500 ngan'), 500_000));
  it('1 triệu -> 1.000.000', () => eq(parseMoneyAmount('1 triệu'), 1_000_000));
  it('1 trieu -> 1.000.000', () => eq(parseMoneyAmount('1 trieu'), 1_000_000));
  it('1tr5 -> 1.500.000', () => eq(parseMoneyAmount('1tr5'), 1_500_000));
  it('2.5 triệu -> 2.500.000', () => eq(parseMoneyAmount('2.5 triệu'), 2_500_000));
  it('15tr -> 15.000.000', () => eq(parseMoneyAmount('nhận lương 15tr'), 15_000_000));
  it('1.500.000 (nhóm) -> 1.500.000', () => eq(parseMoneyAmount('chi 1.500.000 tiền nhà'), 1_500_000));
  it('không có số -> null', () => eq(parseMoneyAmount('bill nào chưa đóng'), null));
  it('rỗng -> null', () => eq(parseMoneyAmount(''), null));

  console.log('\namount parser test complete.');
}

main();
