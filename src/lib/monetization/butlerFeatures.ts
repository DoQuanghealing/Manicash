/* ═══ Butler Features — Ma trận 3 cấp quản gia (mô hình "Mercedes") ═══
 * MỘT nguồn sự thật cho việc cấp nào mở tính năng nào. Isomorphic (client + server
 * dùng chung, như moneyBrain) — pure, chỉ đọc env.
 *
 * Nguyên tắc: 1 codebase full-option; cấp dưới = tắt công tắc. Tính năng bị khóa
 * vẫn render UI với 🔒 + nút nâng cấp (FOMO), KHÔNG fork code theo gói.
 *
 * Quyền năng (level) ≠ persona (ButlerTier ở useSettingsStore):
 *   level = min(levelFromButlerTier(userChọn), billingLevelCap(gói đã trả))
 * → user được CHỌN XUỐNG (thích quản gia trầm lặng) nhưng không chọn lên quá gói.
 *
 * Giai đoạn FOMO (hiện tại): Phú Vương mở cho Free → NEXT_PUBLIC_BUTLER_BILLING_ENFORCED
 * chưa bật → billing KHÔNG cap. Flip = 'true' CÙNG LÚC với PV-5 (Pro Plus ra mắt),
 * không sớm hơn — bật sớm sẽ khóa level 3 của mọi người vì chưa có gói pro_plus.
 * Chi tiết: docs/BUTLER_TIERS_AND_API_COST_PLAN.md
 */

import type { Tier } from './entitlement';
import type { ButlerTier } from '@/stores/useSettingsStore';

export type ButlerLevel = 1 | 2 | 3;

/** Cấp TỐI THIỂU để mở tính năng. Đổi số = đổi gói — không sửa code nơi gọi. */
export const FEATURE_MIN_LEVEL = {
  // ── Cấp 1 · 🪶 Tập sự — công cụ tính toán + nhắc bill ──
  'chat.query.basic': 1, // số dư, chi hôm nay, bill status
  'bills.remind.basic': 1, // guardian: CHỈ nhắc bill
  'txn.log': 1,
  'budget.manual': 1,
  'goals.basic': 1,

  // ── Cấp 2 · 👑 Thông thái — cá nhân hóa ──
  'memory.chips': 2, // chip ghi nhanh từ thói quen (P3) — vẫn HỌC ngầm từ cấp 1
  'memory.category': 2, // áp luật keyword→danh mục khi parse
  'chat.followup': 2, // ngữ cảnh hội thoại (conversationStore)
  'guardian.full': 2, // đủ 5 loại cảnh báo (không chỉ bill)
  'cfo.ai': 2, // CFO narration AI (quota)
  'llm.rescue': 2, // cứu intent mù mờ bằng Groq 8B
  'chat.deep': 2, // tư vấn sâu (quota)

  // ── Cấp 3 · 🐉 Phú Vương — full option ──
  'coach.proactive': 3, // CoachSuggestionCard (PV-2)
  'care.companion': 3, // 10 kịch bản chăm sóc + minigame (0đ API)
  'task.eval': 3, // AI đánh giá nhiệm vụ kiếm tiền
  'task.completion.watch': 3, // theo dõi khả năng hoàn thành (deterministic)
  'query.full': 3, // truy xuất mọi thứ (cross-period + LLM-with-snapshot)
  'dna.oracle': 3, // Financial DNA + Oracle (PV-3)
  'sync.multiDevice': 3, // money sync per-user (PV-4)
} as const satisfies Record<string, ButlerLevel>;

export type ButlerFeature = keyof typeof FEATURE_MIN_LEVEL;

/** Cấp `level` có được dùng tính năng `feature` không. */
export function hasFeature(level: ButlerLevel, feature: ButlerFeature): boolean {
  return level >= FEATURE_MIN_LEVEL[feature];
}

/** Cấp tối thiểu cần có (cho badge 🔒 "Cần Phú Vương" trên UI). */
export function minLevelFor(feature: ButlerFeature): ButlerLevel {
  return FEATURE_MIN_LEVEL[feature];
}

/* ─────────── Quota "nếm thử" (taste) ───────────
 * Cho user CHƯA đủ cấp dùng thử vài lượt/tháng để thấy giá trị → hết thì mời nâng cấp.
 * Minh bạch: luôn nói thẳng còn bao nhiêu lượt (không mập mờ). PO chốt 2026-07-19.
 */
export const FEATURE_TASTE_QUOTA: Partial<Record<ButlerFeature, number>> = {
  'chat.deep': 4, // Free (cấp 1) nếm tư vấn sâu 4 lượt/tháng
  'task.eval': 5, // Pro (cấp 2) nếm thẩm định nhiệm vụ 5 lượt/tháng → mời lên cấp 3
};

/** Số lượt nếm/tháng của feature (0 = không cho nếm). */
export function tasteQuotaFor(feature: ButlerFeature): number {
  return FEATURE_TASTE_QUOTA[feature] ?? 0;
}

export interface TasteDecision {
  /** Dùng được lượt này không (đủ cấp HOẶC còn lượt nếm). */
  allowed: boolean;
  /** Đang dùng bằng suất nếm (chưa đủ cấp) — UI hiện nhãn "nếm thử". */
  isTaste: boolean;
  /** Còn bao nhiêu lượt nếm trong tháng (chỉ có nghĩa khi isTaste hoặc bị chặn). */
  remainingTaste: number;
  tasteQuota: number;
  /** Cấp tối thiểu để dùng thoải mái (cho CTA nâng cấp). */
  requiredLevel: ButlerLevel;
}

/**
 * PURE: quyết định 1 lượt dùng feature khi xét CẢ cấp lẫn suất nếm.
 * - Đủ cấp → allowed, isTaste=false (không tốn suất nếm).
 * - Chưa đủ cấp + còn suất nếm → allowed, isTaste=true (caller phải tăng counter).
 * - Chưa đủ cấp + hết suất → allowed=false → UI mời nâng cấp.
 */
export function evaluateFeatureTaste(
  level: ButlerLevel,
  feature: ButlerFeature,
  tasteUsedThisMonth: number,
): TasteDecision {
  const requiredLevel = FEATURE_MIN_LEVEL[feature];
  const tasteQuota = tasteQuotaFor(feature);
  const used = Math.max(0, tasteUsedThisMonth);
  const remainingTaste = Math.max(0, tasteQuota - used);

  if (hasFeature(level, feature)) {
    return { allowed: true, isTaste: false, remainingTaste, tasteQuota, requiredLevel };
  }
  // CHỈ cho nếm khi kém ĐÚNG 1 cấp: Free nếm chat.deep (cấp 2), Pro nếm task.eval (cấp 3).
  // Kém từ 2 cấp trở lên → không nếm, mời nâng cấp thẳng.
  const canTaste = tasteQuota > 0 && level >= requiredLevel - 1;
  if (!canTaste) {
    return { allowed: false, isTaste: false, remainingTaste: 0, tasteQuota, requiredLevel };
  }
  return { allowed: remainingTaste > 0, isTaste: true, remainingTaste, tasteQuota, requiredLevel };
}

/** Câu thông báo minh bạch cho UI (nói thẳng còn bao nhiêu lượt). */
export function describeTaste(d: TasteDecision, upgradeName = 'Phú Vương'): string {
  if (d.isTaste) {
    return d.allowed
      ? `Lượt nếm thử — ngài còn ${d.remainingTaste}/${d.tasteQuota} lượt tháng này.`
      : `Ngài đã dùng hết ${d.tasteQuota} lượt nếm thử tháng này. Nâng lên ${upgradeName} để dùng thoải mái.`;
  }
  // Không đủ cấp và không được nếm (kém từ 2 cấp).
  return d.allowed ? '' : `Tính năng này dành cho ${upgradeName}. Nâng cấp để quản gia phục vụ ngài.`;
}

/** Persona user chọn → level tương ứng (chưa xét billing). */
export function levelFromButlerTier(tier: ButlerTier): ButlerLevel {
  switch (tier) {
    case 'sovereign':
      return 3;
    case 'wise':
      return 2;
    default:
      return 1;
  }
}

/** Billing đã cap level chưa. Flip 'true' CÙNG LÚC PV-5 (xem header). */
export function isButlerBillingEnforced(): boolean {
  return process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED === 'true';
}

/**
 * Trần level theo gói đã trả. FOMO (chưa enforce) → không cap (3).
 * Khi enforce: free→1, pro→2. Level 3 cần gói pro_plus — thêm ở PV-5
 * (mở rộng Tier + nhánh ở đây).
 */
export function billingLevelCap(billingTier: Tier | undefined): ButlerLevel {
  if (!isButlerBillingEnforced()) return 3;
  // Fail-closed: thiếu thông tin billing khi đã enforce → coi như free.
  if (billingTier === 'pro_plus') return 3; // Phú Vương (PV-5) — full option.
  return billingTier === 'pro' ? 2 : 1;
}

export interface ResolveButlerLevelInput {
  /** Persona user chọn (useSettingsStore.butlerTier). */
  butlerTier: ButlerTier;
  /** Tier từ resolveTier(profile). Bỏ trống = fail-closed khi đã enforce. */
  billingTier?: Tier;
}

/** Level hiệu lực = min(persona user chọn, trần billing). */
export function resolveButlerLevel(input: ResolveButlerLevelInput): ButlerLevel {
  const chosen = levelFromButlerTier(input.butlerTier);
  const cap = billingLevelCap(input.billingTier);
  return (chosen < cap ? chosen : cap) as ButlerLevel;
}
