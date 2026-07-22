/* ═══ Migration Free-sovereign → PV-5 (bước 3) ═══
 * Chốt chữ tín: 14 ngày báo + 7 ngày trial VẪN giữ cấp 3, chỉ hạ ở phase 'ended'.
 * Chưa enforce → không đụng gì (FOMO tiếp). Đã trả Pro Plus → không migrate.
 */
import {
  evaluateSovereignMigration,
  MIGRATION_NOTICE_DAYS,
  MIGRATION_TRIAL_DAYS,
} from '@/lib/monetization/sovereignMigration';
import { isBannerDismissedToday } from '@/stores/useSovereignMigrationStore';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const START = '2026-08-01T00:00:00Z';
const plusDays = (n: number) => new Date(Date.parse(START) + n * 86_400_000).toISOString();

const base = {
  butlerTier: 'sovereign' as const,
  billingTier: 'free' as const,
  enforced: true,
  noticeStartedAt: START,
};

console.log('\nMigration Free-sovereign — không đụng khi chưa tới lúc');

it('chưa enforce → phase none, không banner (FOMO tiếp)', () => {
  const s = evaluateSovereignMigration({ ...base, enforced: false, nowISO: plusDays(100) });
  eq(s.phase, 'none');
  eq(s.showBanner, false);
  eq(s.effectiveLevel, 3);
});

it('đã trả Pro Plus → không migrate, giữ cấp 3', () => {
  const s = evaluateSovereignMigration({ ...base, billingTier: 'pro_plus', nowISO: plusDays(100) });
  eq(s.phase, 'none');
  eq(s.effectiveLevel, 3);
});

it('không dùng persona sovereign → không liên quan', () => {
  const s = evaluateSovereignMigration({ ...base, butlerTier: 'wise', nowISO: plusDays(100) });
  eq(s.phase, 'none');
  eq(s.showBanner, false);
});

console.log('\nMigration — GIỮ CHỮ TÍN: báo 14 ngày + trial 7 ngày vẫn full cấp 3');

it('ngày 0 → notice, còn 14 ngày, VẪN cấp 3', () => {
  const s = evaluateSovereignMigration({ ...base, nowISO: START });
  eq(s.phase, 'notice');
  eq(s.daysLeft, MIGRATION_NOTICE_DAYS);
  eq(s.effectiveLevel, 3, 'không cắt trong thời gian báo');
  ok(s.showBanner && s.headline.includes('14'), 'banner nói rõ số ngày');
});

it('ngày 13 → vẫn notice (còn 1 ngày), cấp 3', () => {
  const s = evaluateSovereignMigration({ ...base, nowISO: plusDays(13) });
  eq(s.phase, 'notice');
  eq(s.daysLeft, 1);
  eq(s.effectiveLevel, 3);
});

it('ngày 14 → chuyển sang trial, còn 7 ngày, VẪN cấp 3', () => {
  const s = evaluateSovereignMigration({ ...base, nowISO: plusDays(14) });
  eq(s.phase, 'trial');
  eq(s.daysLeft, MIGRATION_TRIAL_DAYS);
  eq(s.effectiveLevel, 3, 'trial vẫn full');
});

it('ngày 20 → trial ngày cuối, cấp 3', () => {
  const s = evaluateSovereignMigration({ ...base, nowISO: plusDays(20) });
  eq(s.phase, 'trial');
  eq(s.daysLeft, 1);
  eq(s.effectiveLevel, 3);
});

console.log('\nMigration — hết hạn thì hạ mềm về gói');

it('ngày 21 → ended, Free rơi về cấp 1', () => {
  const prev = process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
  process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = 'true';
  try {
    const s = evaluateSovereignMigration({ ...base, nowISO: plusDays(21) });
    eq(s.phase, 'ended');
    eq(s.effectiveLevel, 1, 'Free → cấp 1');
    ok(s.body.includes('0đ'), 'trấn an: tính năng 0đ vẫn còn');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
    else process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = prev;
  }
});

it('ngày 21 với gói Pro → rơi về cấp 2 (không phải 1)', () => {
  const prev = process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
  process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = 'true';
  try {
    const s = evaluateSovereignMigration({ ...base, billingTier: 'pro', nowISO: plusDays(21) });
    eq(s.phase, 'ended');
    eq(s.effectiveLevel, 2);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
    else process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = prev;
  }
});

it('chưa bắt đầu đếm (noticeStartedAt null) → coi như ngày đầu', () => {
  const s = evaluateSovereignMigration({ ...base, noticeStartedAt: null, nowISO: plusDays(99) });
  eq(s.phase, 'notice');
  eq(s.daysLeft, MIGRATION_NOTICE_DAYS);
});

console.log('\nBanner — đóng thì ẩn trong ngày, hôm sau nhắc lại');

it('đóng hôm nay → ẩn; sang ngày khác → hiện lại', () => {
  eq(isBannerDismissedToday('2026-08-01T10:00:00Z', '2026-08-01T23:00:00Z'), true);
  eq(isBannerDismissedToday('2026-08-01T10:00:00Z', '2026-08-02T00:30:00Z'), false);
  eq(isBannerDismissedToday(null, '2026-08-01T10:00:00Z'), false);
});

console.log('\nSovereign migration test suite complete.');
