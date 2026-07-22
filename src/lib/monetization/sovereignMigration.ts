/* ═══ Migration Free-sovereign → PV-5 (bước 3) ═══
 * PURE + deterministic. Khi bật enforce billing, user đang dùng persona Phú Vương
 * (sovereign) mà CHƯA trả Pro Plus sẽ KHÔNG bị cắt đột ngột:
 *
 *   báo trước 14 ngày (giữ nguyên cấp 3) → dùng thử 7 ngày (vẫn cấp 3) → rơi về gói.
 *
 * Giữ chữ tín: đã hứa 14 ngày thì trong 14 ngày đó vẫn phải dùng được đầy đủ —
 * vì vậy effectiveLevel = 3 suốt notice + trial, chỉ hạ ở phase 'ended'.
 */

import type { ButlerTier } from '@/stores/useSettingsStore';
import type { Tier } from './entitlement';
import { billingLevelCap, type ButlerLevel } from './butlerFeatures';

export type MigrationPhase = 'none' | 'notice' | 'trial' | 'ended';

export const MIGRATION_NOTICE_DAYS = 14;
export const MIGRATION_TRIAL_DAYS = 7;

export interface MigrationState {
  phase: MigrationPhase;
  /** Số ngày còn lại của phase hiện tại (0 khi 'none'/'ended'). */
  daysLeft: number;
  /** Cấp quản gia HIỆU LỰC sau khi tính ân hạn. */
  effectiveLevel: ButlerLevel;
  /** Có nên hiện banner không (none → không). */
  showBanner: boolean;
  headline: string;
  body: string;
  ctaLabel?: string;
}

export interface SovereignMigrationInput {
  /** Persona user đang chọn. */
  butlerTier: ButlerTier;
  /** Gói thật đang trả. */
  billingTier: Tier | undefined;
  /** NEXT_PUBLIC_BUTLER_BILLING_ENFORCED đã bật chưa. */
  enforced: boolean;
  /** ISO thời điểm bắt đầu báo (store ghi lần đầu thấy phase cần báo). null = chưa bắt đầu. */
  noticeStartedAt: string | null;
  nowISO: string;
  noticeDays?: number;
  trialDays?: number;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO);
  const b = Date.parse(toISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

const NONE: MigrationState = {
  phase: 'none', daysLeft: 0, effectiveLevel: 3, showBanner: false, headline: '', body: '',
};

export function evaluateSovereignMigration(input: SovereignMigrationInput): MigrationState {
  const noticeDays = input.noticeDays ?? MIGRATION_NOTICE_DAYS;
  const trialDays = input.trialDays ?? MIGRATION_TRIAL_DAYS;

  // Chưa tới PV-5 → FOMO tiếp, không đụng gì.
  if (!input.enforced) return NONE;
  // Không dùng persona Phú Vương → không liên quan.
  if (input.butlerTier !== 'sovereign') {
    return { ...NONE, effectiveLevel: billingLevelCap(input.billingTier) };
  }
  // Đã trả Pro Plus → giữ nguyên, không cần migrate.
  if (input.billingTier === 'pro_plus') return { ...NONE, effectiveLevel: 3 };

  const paidLevel = billingLevelCap(input.billingTier);

  // Chưa bắt đầu đếm → hôm nay là ngày đầu báo.
  const elapsed = input.noticeStartedAt ? Math.max(0, daysBetween(input.noticeStartedAt, input.nowISO)) : 0;

  if (elapsed < noticeDays) {
    const daysLeft = noticeDays - elapsed;
    return {
      phase: 'notice',
      daysLeft,
      effectiveLevel: 3, // giữ trọn quyền trong thời gian báo trước
      showBanner: true,
      headline: `Quản gia Phú Vương của ngài còn ${daysLeft} ngày`,
      body:
        `ManiCash sắp áp dụng gói Phú Vương (99.000đ/tháng). Ngài vẫn dùng ĐẦY ĐỦ trong ${daysLeft} ngày tới, ` +
        `sau đó có thêm ${trialDays} ngày dùng thử miễn phí trước khi trở về gói hiện tại.`,
      ctaLabel: 'Xem gói Phú Vương',
    };
  }

  const trialElapsed = elapsed - noticeDays;
  if (trialElapsed < trialDays) {
    const daysLeft = trialDays - trialElapsed;
    return {
      phase: 'trial',
      daysLeft,
      effectiveLevel: 3, // trial vẫn full
      showBanner: true,
      headline: `Đang dùng thử Phú Vương — còn ${daysLeft} ngày`,
      body:
        `Đây là ${trialDays} ngày dùng thử miễn phí. Hết hạn, quản gia sẽ trở về cấp theo gói hiện tại ` +
        `(vẫn giữ toàn bộ dữ liệu và các tính năng 0đ như Care Companion).`,
      ctaLabel: 'Giữ Phú Vương',
    };
  }

  return {
    phase: 'ended',
    daysLeft: 0,
    effectiveLevel: paidLevel, // rơi về gói thật
    showBanner: true,
    headline: 'Quản gia đã trở về cấp theo gói của ngài',
    body:
      'Thời gian dùng thử Phú Vương đã kết thúc. Dữ liệu và các tính năng 0đ vẫn nguyên vẹn — ' +
      'nâng lên Phú Vương bất cứ lúc nào để quản gia phục vụ đầy đủ trở lại.',
    ctaLabel: 'Nâng lên Phú Vương',
  };
}
