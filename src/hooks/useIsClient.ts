/* ═══ useIsClient — true sau khi hydrate xong (an toàn để createPortal vào document.body) ═══
 * Dùng useSyncExternalStore thay cho `useEffect(() => setMounted(true))` để không render 2 lần
 * và không dính luật react-hooks/set-state-in-effect.
 */
'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
