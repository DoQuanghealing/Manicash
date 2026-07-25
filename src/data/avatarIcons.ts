/* ═══ Avatar icon set ═══
 *
 * Người dùng có 3 lựa chọn avatar, tất cả cùng nằm trong field `photoURL`:
 *
 *   1. `avatar:icon:<id>`  — icon 3D Fluent Emoji (MIT). ĐÂY LÀ BỘ CHÍNH.
 *   2. `avatar:emoji:🦊`   — emoji Unicode. GIỮ LẠI cho user đã chọn từ trước;
 *                            không còn hiện trong picker nữa.
 *   3. data URI / http URL — ảnh người dùng tự tải lên.
 *
 * Dùng `resolveAvatar()` để render — đừng tự parse prefix ở component.
 */

import { fluentEmojiSrc } from './fluentEmojiPack';

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

/* ── Bộ icon 3D (Fluent Emoji) — lựa chọn mặc định hiện nay ─────────────── */

/** Prefix khi avatar là icon 3D trong `public/emoji/fluent3d/`. */
export const AVATAR_ICON_PREFIX = 'avatar:icon:';

export function isIconAvatar(value: string | null | undefined): boolean {
  return !!value && value.startsWith(AVATAR_ICON_PREFIX);
}

export function getIconIdFromAvatar(value: string | null | undefined): string | null {
  if (!isIconAvatar(value)) return null;
  return value!.slice(AVATAR_ICON_PREFIX.length);
}

export function buildIconAvatar(id: string): string {
  return `${AVATAR_ICON_PREFIX}${id}`;
}

/* ── Resolver thống nhất ────────────────────────────────────────────────── */

export type ResolvedAvatar =
  /** Icon 3D — render <img src>. */
  | { kind: 'icon'; id: string; src: string }
  /** Emoji Unicode cũ — render text. */
  | { kind: 'emoji'; emoji: string }
  /** Ảnh user tải lên — render <img src>. */
  | { kind: 'photo'; src: string }
  /** Chưa đặt gì — component tự fallback về chữ cái đầu. */
  | { kind: 'none' };

/**
 * Chuyển giá trị `photoURL` thô thành thứ component render được.
 * Mọi nơi hiển thị avatar nên đi qua hàm này để 3 dạng lưu trữ không rò ra UI.
 */
export function resolveAvatar(value: string | null | undefined): ResolvedAvatar {
  if (!value) return { kind: 'none' };
  const iconId = getIconIdFromAvatar(value);
  if (iconId) return { kind: 'icon', id: iconId, src: fluentEmojiSrc(iconId) };
  const emoji = getEmojiFromAvatar(value);
  if (emoji) return { kind: 'emoji', emoji };
  return { kind: 'photo', src: value };
}
