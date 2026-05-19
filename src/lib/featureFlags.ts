/**
 * Feature flags cho Phase 1+ của 3-account model migration.
 *
 * Tham chiếu:
 *   - docs/adr/0001-three-account-model.md §11 (Rollback plan)
 *   - docs/plans/phase-1-read-model.md §3 (Feature flag setup)
 *
 * Quy ước:
 *   - Mỗi flag MẶC ĐỊNH FALSE (production safe).
 *   - Chỉ env value chính xác = "true" mới bật. Mọi giá trị khác ("1", "yes",
 *     "TRUE") đều coi là FALSE — tránh accidental enable.
 *   - Flag được đọc 1 lần lúc module load. Không hỗ trợ toggle runtime.
 *   - KHÔNG check `process.env` rải rác trong codebase — luôn qua helper này
 *     để dễ grep và mock trong test.
 */

/**
 * Pure parser exported for unit testability.
 * Only the exact string 'true' returns true. Everything else (undefined,
 * empty string, '1', 'TRUE', 'yes') returns false.
 */
export function readFlag(envValue: string | undefined): boolean {
  return envValue === 'true';
}

export const FLAGS = {
  /**
   * Phase 1 gate — bật read model mới + domain adapter + migration planner.
   * UI vẫn dùng legacy shape (`useAccountOverviewStore` map ngược lại).
   *
   * Khi ON:
   *   - useAccountOverviewStore đọc từ threeAccountSnapshot
   *   - Migration plan có thể được gọi từ Phase 2 wiring (nhưng KHÔNG auto-execute)
   *
   * Khi OFF (default):
   *   - Mọi behavior identical với trước Phase 1 (LA1 acceptance)
   */
  NEW_THREE_ACCOUNT_MODEL: readFlag(process.env.NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL),

  /**
   * Phase 2 gate — bật Overview UI mới (4 chỉ số: Safe-to-Spend / Income /
   * Spending / Saving). Yêu cầu `NEW_THREE_ACCOUNT_MODEL = true` để có data.
   */
  NEW_OVERVIEW_UI: readFlag(process.env.NEXT_PUBLIC_ENABLE_NEW_OVERVIEW),

  /**
   * Phase 3 gate — bật allocation modal sau khi nhập income. Yêu cầu
   * `NEW_THREE_ACCOUNT_MODEL = true`.
   */
  NEW_ALLOCATION_FLOW: readFlag(process.env.NEXT_PUBLIC_ENABLE_ALLOCATION_FLOW),
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] === true;
}
