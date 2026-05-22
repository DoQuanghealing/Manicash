/* ═══ Age Group — Phân loại user + tone copy ═══
 *
 * Detect nhóm tuổi từ yearOfBirth → quyết định "vibe" của app.
 * User có thể override qua useSettingsStore.appVibe nếu không muốn auto.
 *
 * 3 nhóm:
 *   young     — Gen Z (≤24): meme, đu trend, xuồng xã
 *   pro       — Millennial (25-35): lịch sự, terms tài chính, status
 *   classic   — Gen X+ (36+): tôn trọng, gia đình, ổn định
 */

export type AppVibe = 'young' | 'pro' | 'classic';
export type VibeMode = AppVibe | 'auto';

/** Tính vibe từ năm sinh. Default 'pro' nếu thiếu data. */
export function detectVibeFromYear(yearOfBirth?: number, currentYear?: number): AppVibe {
  if (!yearOfBirth) return 'pro';
  const cy = currentYear ?? new Date().getFullYear();
  const age = cy - yearOfBirth;
  if (age <= 24) return 'young';
  if (age <= 35) return 'pro';
  return 'classic';
}

/** Resolve: mode='auto' → detect; mode khác → trả mode đó. */
export function resolveVibe(mode: VibeMode, yearOfBirth?: number): AppVibe {
  if (mode === 'auto') return detectVibeFromYear(yearOfBirth);
  return mode;
}

export const VIBE_LABELS: Record<AppVibe, { label: string; subtitle: string; emoji: string }> = {
  young:   { label: 'Trẻ Trung', subtitle: 'Năng động, đu trend, xuồng xã', emoji: '🤘' },
  pro:     { label: 'Chuyên Nghiệp', subtitle: 'Lịch sự, hiệu suất, terms tài chính', emoji: '💼' },
  classic: { label: 'Cổ Điển', subtitle: 'Trầm ấm, gia đình, ổn định', emoji: '🌿' },
};
