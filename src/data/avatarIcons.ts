/* ═══ Animated emoji avatar set ═══
 *
 * Curated Unicode emojis users can pick instead of uploading a photo.
 * Stored on profile as `avatar:emoji:🦊` so we can distinguish from
 * uploaded photoURL data URIs. The UI applies a subtle CSS animation
 * (scale/wiggle) to make them feel alive like Telegram stickers.
 */

export interface AvatarEmojiOption {
  emoji: string;
  /** Human-friendly Vietnamese label for accessibility. */
  label: string;
  /** Animation variant — maps to CSS class. */
  motion: 'bounce' | 'wiggle' | 'pulse' | 'spin';
}

/** Prefix used when emoji is stored as the photoURL field. */
export const AVATAR_EMOJI_PREFIX = 'avatar:emoji:';

export function isEmojiAvatar(value: string | null | undefined): boolean {
  return !!value && value.startsWith(AVATAR_EMOJI_PREFIX);
}

export function getEmojiFromAvatar(value: string | null | undefined): string | null {
  if (!isEmojiAvatar(value)) return null;
  return value!.slice(AVATAR_EMOJI_PREFIX.length);
}

export function buildEmojiAvatar(emoji: string): string {
  return `${AVATAR_EMOJI_PREFIX}${emoji}`;
}

export const AVATAR_EMOJIS: readonly AvatarEmojiOption[] = [
  { emoji: '🦊', label: 'Cáo', motion: 'wiggle' },
  { emoji: '🐉', label: 'Rồng', motion: 'pulse' },
  { emoji: '🦁', label: 'Sư tử', motion: 'pulse' },
  { emoji: '🐢', label: 'Rùa', motion: 'bounce' },
  { emoji: '🐳', label: 'Cá voi', motion: 'wiggle' },
  { emoji: '🦄', label: 'Kỳ lân', motion: 'bounce' },
  { emoji: '🦉', label: 'Cú', motion: 'wiggle' },
  { emoji: '🐙', label: 'Bạch tuộc', motion: 'wiggle' },
  { emoji: '🐼', label: 'Gấu trúc', motion: 'bounce' },
  { emoji: '🦅', label: 'Đại bàng', motion: 'pulse' },
  { emoji: '🚀', label: 'Tên lửa', motion: 'pulse' },
  { emoji: '🌟', label: 'Ngôi sao', motion: 'spin' },
  { emoji: '💎', label: 'Kim cương', motion: 'spin' },
  { emoji: '🔮', label: 'Quả cầu pha lê', motion: 'pulse' },
  { emoji: '🌙', label: 'Mặt trăng', motion: 'pulse' },
  { emoji: '⚡', label: 'Tia chớp', motion: 'pulse' },
  { emoji: '🎩', label: 'Mũ phép', motion: 'wiggle' },
  { emoji: '🍀', label: 'Cỏ bốn lá', motion: 'wiggle' },
  { emoji: '🌈', label: 'Cầu vồng', motion: 'spin' },
  { emoji: '🎨', label: 'Bảng vẽ', motion: 'bounce' },
] as const;
