/* ═══ Money Brain — Category Normalization (Phase 0) ═══
 * Hợp nhất categoryId lệch nhau giữa seed/budget/transaction để khi recompute
 * budget từ transactions không bị về 0.
 */

/** Map alias categoryId cũ -> chuẩn. */
export const CATEGORY_ALIASES: Record<string, string> = {
  entertain: 'entertainment',
};

/** Trả categoryId chuẩn hoá; giữ undefined nếu input undefined. */
export function normalizeCategoryId(categoryId?: string): string | undefined {
  if (!categoryId) return categoryId;
  return CATEGORY_ALIASES[categoryId] ?? categoryId;
}
