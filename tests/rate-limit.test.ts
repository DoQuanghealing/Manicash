import {
  evaluateRateLimit,
  checkRateLimit,
  resetRateLimit,
  type RateLimitRule,
} from '@/lib/rateLimit';

type TestFn = () => void;
function describe(name: string, fn: TestFn): void { console.log(`\n${name}`); fn(); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function expectEqual<T>(a: T, b: T): void { if (a !== b) throw new Error(`Expected ${String(b)}, got ${String(a)}`); }

const BURST: RateLimitRule[] = [{ windowMs: 10_000, max: 3 }];
const T = 1_000_000; // mốc thời gian cố định (ms)

describe('evaluateRateLimit — thuần', () => {
  it('dưới ngưỡng → ok, remaining trừ lượt hiện tại', () => {
    const r = evaluateRateLimit([T - 100], BURST, T); // đã 1 lượt, max 3
    expectEqual(r.ok, true);
    expectEqual(r.remaining, 1); // 3 - 1(cũ) - 1(này) = 1
  });

  it('đạt ngưỡng → chặn + retryAfter tính từ lượt cũ nhất', () => {
    const hits = [T - 9_000, T - 5_000, T - 1_000]; // 3 lượt trong 10s, max 3
    const r = evaluateRateLimit(hits, BURST, T);
    expectEqual(r.ok, false);
    expectEqual(r.remaining, 0);
    // lượt cũ nhất rơi ra sau (T-9000)+10000 = T+1000 → chờ 1s
    expectEqual(r.retryAfterSec, 1);
  });

  it('mốc ngoài cửa sổ không tính', () => {
    const hits = [T - 20_000, T - 15_000, T - 11_000]; // đều > 10s trước
    const r = evaluateRateLimit(hits, BURST, T);
    expectEqual(r.ok, true);
  });

  it('nhiều luật — luật burst chặt hơn quyết định', () => {
    const rules: RateLimitRule[] = [
      { windowMs: 10_000, max: 2 },
      { windowMs: 60_000, max: 100 },
    ];
    const r = evaluateRateLimit([T - 1_000, T - 500], rules, T);
    expectEqual(r.ok, false); // burst 2/10s đã đầy
  });
});

describe('checkRateLimit — có store', () => {
  it('chặn sau khi vượt max, key độc lập', () => {
    resetRateLimit();
    expectEqual(checkRateLimit('u1', BURST, T).ok, true);
    expectEqual(checkRateLimit('u1', BURST, T).ok, true);
    expectEqual(checkRateLimit('u1', BURST, T).ok, true);
    expectEqual(checkRateLimit('u1', BURST, T).ok, false); // lượt 4 bị chặn
    expectEqual(checkRateLimit('u2', BURST, T).ok, true);   // key khác không ảnh hưởng
  });

  it('cửa sổ trượt — qua thời gian lại cho phép', () => {
    resetRateLimit();
    checkRateLimit('u3', BURST, T);
    checkRateLimit('u3', BURST, T);
    checkRateLimit('u3', BURST, T);
    expectEqual(checkRateLimit('u3', BURST, T).ok, false);
    // 11s sau, mốc cũ hết hạn
    expectEqual(checkRateLimit('u3', BURST, T + 11_000).ok, true);
  });

  it('lượt bị chặn KHÔNG được ghi nhận (không tự phạt thêm)', () => {
    resetRateLimit();
    for (let i = 0; i < 3; i++) checkRateLimit('u4', BURST, T);
    checkRateLimit('u4', BURST, T); // bị chặn, không push
    // đúng 10s sau lượt hợp lệ đầu tiên → nó vừa hết hạn, cho 1 lượt mới
    expectEqual(checkRateLimit('u4', BURST, T + 10_001).ok, true);
  });
});

if (process.exitCode) process.exit(process.exitCode);
