/* TDD — butlerFeatures.ts: ma trận 3 cấp quản gia + resolve level (Mercedes T1) */
import {
  FEATURE_MIN_LEVEL,
  hasFeature,
  minLevelFor,
  levelFromButlerTier,
  billingLevelCap,
  resolveButlerLevel,
  type ButlerFeature,
  type ButlerLevel,
} from '@/lib/monetization/butlerFeatures';

function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }

const ENV_KEY = 'NEXT_PUBLIC_BUTLER_BILLING_ENFORCED';
function withEnforced<T>(fn: () => T): T {
  const prev = process.env[ENV_KEY];
  process.env[ENV_KEY] = 'true';
  try { return fn(); }
  finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
}

describe('FEATURE_MIN_LEVEL — ma trận nhất quán');

it('mọi min-level đều hợp lệ (1|2|3)', () => {
  for (const [f, lv] of Object.entries(FEATURE_MIN_LEVEL)) {
    ok(lv === 1 || lv === 2 || lv === 3, `level lạ ở ${f}: ${lv}`);
  }
});

it('hasFeature: cấp cao mở được MỌI tính năng cấp thấp (monotonic)', () => {
  const features = Object.keys(FEATURE_MIN_LEVEL) as ButlerFeature[];
  for (const f of features) {
    for (const lv of [1, 2, 3] as ButlerLevel[]) {
      eq(hasFeature(lv, f), lv >= FEATURE_MIN_LEVEL[f], `${f} @ level ${lv}`);
    }
  }
});

it('mốc kinh doanh: cấp 1 = công cụ, cấp 2 = cá nhân hóa, cấp 3 = chủ động', () => {
  // Cấp 1 KHÔNG có cá nhân hóa/chủ động.
  ok(!hasFeature(1, 'memory.chips'), 'chip thói quen khóa ở cấp 1');
  ok(!hasFeature(1, 'chat.followup'), 'follow-up khóa ở cấp 1');
  ok(!hasFeature(1, 'coach.proactive'), 'coach khóa ở cấp 1');
  ok(hasFeature(1, 'bills.remind.basic'), 'nhắc bill mở ở cấp 1');
  // Cấp 2 có cá nhân hóa nhưng CHƯA có chủ động.
  ok(hasFeature(2, 'memory.chips'), 'chip thói quen mở ở cấp 2');
  ok(hasFeature(2, 'cfo.ai'), 'CFO AI mở ở cấp 2');
  ok(!hasFeature(2, 'coach.proactive'), 'coach khóa ở cấp 2');
  ok(!hasFeature(2, 'care.companion'), 'care khóa ở cấp 2');
  ok(!hasFeature(2, 'task.eval'), 'task eval khóa ở cấp 2');
  // Cấp 3 full option.
  ok(hasFeature(3, 'coach.proactive'));
  ok(hasFeature(3, 'care.companion'));
  ok(hasFeature(3, 'sync.multiDevice'));
});

it('minLevelFor trả đúng mốc cho badge 🔒', () => {
  eq(minLevelFor('coach.proactive'), 3);
  eq(minLevelFor('memory.chips'), 2);
  eq(minLevelFor('txn.log'), 1);
});

describe('levelFromButlerTier — persona → level');

it('basic→1, wise→2, sovereign→3', () => {
  eq(levelFromButlerTier('basic'), 1);
  eq(levelFromButlerTier('wise'), 2);
  eq(levelFromButlerTier('sovereign'), 3);
});

describe('billingLevelCap + resolveButlerLevel — giai đoạn FOMO (chưa enforce)');

it('FOMO: billing KHÔNG cap — sovereign trên gói free vẫn level 3 (giữ hành vi hiện tại)', () => {
  eq(billingLevelCap('free'), 3);
  eq(billingLevelCap(undefined), 3);
  eq(resolveButlerLevel({ butlerTier: 'sovereign' }), 3);
  eq(resolveButlerLevel({ butlerTier: 'sovereign', billingTier: 'free' }), 3);
});

it('FOMO: user chọn persona thấp → level theo persona (chọn xuống được)', () => {
  eq(resolveButlerLevel({ butlerTier: 'basic', billingTier: 'pro' }), 1);
  eq(resolveButlerLevel({ butlerTier: 'wise', billingTier: 'pro' }), 2);
});

describe('billingLevelCap + resolveButlerLevel — khi enforce (PV-5)');

it('enforce: free cap 1, pro cap 2 (level 3 chờ pro_plus ở PV-5)', () => {
  withEnforced(() => {
    eq(billingLevelCap('free'), 1);
    eq(billingLevelCap('pro'), 2);
    eq(resolveButlerLevel({ butlerTier: 'sovereign', billingTier: 'free' }), 1);
    eq(resolveButlerLevel({ butlerTier: 'sovereign', billingTier: 'pro' }), 2);
    eq(resolveButlerLevel({ butlerTier: 'wise', billingTier: 'pro' }), 2);
  });
});

it('enforce: thiếu billingTier → fail-closed về free (an toàn tiền)', () => {
  withEnforced(() => {
    eq(billingLevelCap(undefined), 1);
    eq(resolveButlerLevel({ butlerTier: 'sovereign' }), 1);
  });
});

it('enforce: persona vẫn cap được XUỐNG dưới gói', () => {
  withEnforced(() => {
    eq(resolveButlerLevel({ butlerTier: 'basic', billingTier: 'pro' }), 1);
  });
});
