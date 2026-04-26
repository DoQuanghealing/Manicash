/* ═══ XP Events — Singleton EventTarget for XP grant notifications ═══
 * Module-level EventTarget. awardXP emit, XPToastHost subscribe.
 * Tách khỏi store để không ép mọi consumer phải subscribe Zustand state.
 */

import type { XPActionType } from '@/types/gamification';

export interface XPGrantedDetail {
  /** Loại action — toast dùng để map sang label tiếng Việt. */
  type: XPActionType;
  /** Số XP thực tế đã grant (signed — có thể âm cho TASK_OVERDUE). */
  amount: number;
  /** Tổng XP user sau khi grant — toast có thể hiển thị nếu cần. */
  totalXp: number;
}

type XPListener = (detail: XPGrantedDetail) => void;

const EVENT_NAME = 'xp-granted';

// Lazy init — tránh tạo EventTarget ở SSR (Node.js < 19 không có global EventTarget).
let target: EventTarget | null = null;
function getTarget(): EventTarget | null {
  if (typeof window === 'undefined') return null;
  if (!target) target = new EventTarget();
  return target;
}

/** Emit XP grant event. No-op trong SSR. */
export function emitXPGranted(detail: XPGrantedDetail): void {
  const t = getTarget();
  if (!t) return;
  t.dispatchEvent(new CustomEvent<XPGrantedDetail>(EVENT_NAME, { detail }));
}

/** Subscribe — trả về cleanup function. No-op trong SSR. */
export function subscribeXPGranted(handler: XPListener): () => void {
  const t = getTarget();
  if (!t) return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<XPGrantedDetail>).detail);
  t.addEventListener(EVENT_NAME, listener);
  return () => t.removeEventListener(EVENT_NAME, listener);
}
