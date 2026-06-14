import { makeOrderCode, isPaidWebhook, ORDER_CODE_MAX } from '@/lib/monetization/payosOrder';

type TestFn = () => void;
function describe(name: string, fn: TestFn): void { console.log(`\n${name}`); fn(); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function expectEqual<T>(a: T, b: T): void { if (a !== b) throw new Error(`Expected ${String(b)}, got ${String(a)}`); }
function expectTrue(v: boolean, msg = ''): void { if (!v) throw new Error(`Expected true. ${msg}`); }

const NOW = 1_750_000_000_000; // ms

describe('makeOrderCode', () => {
  it('là số nguyên dương, ≤ MAX_SAFE', () => {
    const code = makeOrderCode(NOW, 4242);
    expectTrue(Number.isInteger(code) && code > 0, `code=${code}`);
    expectTrue(code <= ORDER_CODE_MAX, `code=${code} > max`);
  });
  it('deterministic theo (now, rand)', () => {
    expectEqual(makeOrderCode(NOW, 7), makeOrderCode(NOW, 7));
  });
  it('rand được kẹp trong 0..9999', () => {
    const a = makeOrderCode(NOW, 10003); // 10003 % 10000 = 3
    const b = makeOrderCode(NOW, 3);
    expectEqual(a, b);
  });
  it('rand âm vẫn ra số hợp lệ', () => {
    const code = makeOrderCode(NOW, -55);
    expectTrue(Number.isInteger(code) && code > 0, `code=${code}`);
  });
});

describe('isPaidWebhook', () => {
  const ok = { code: '00', success: true, data: { code: '00' } };
  it('true khi code 00 + success + data.code 00', () => expectEqual(isPaidWebhook(ok), true));
  it('false khi success=false', () => expectEqual(isPaidWebhook({ ...ok, success: false }), false));
  it('false khi top code != 00', () => expectEqual(isPaidWebhook({ ...ok, code: '01' }), false));
  it('false khi data.code != 00', () => expectEqual(isPaidWebhook({ ...ok, data: { code: '99' } }), false));
});

if (process.exitCode) process.exit(process.exitCode);
