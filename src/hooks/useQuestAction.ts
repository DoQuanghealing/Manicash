/* ═══ useQuestAction — Dispatch action khi user bấm "Làm ngay" ═══
 *
 * Map QuestAction.kind → behavior:
 *   - navigate: router.push (kèm query nếu có)
 *   - highlight: scroll vào element + add class pulse 2.5s
 *   - openWishlist: router.push /goals + tab wishlist
 *   - openMoney: router.push /money
 *   - checkin: caller xử lý riêng (modal local)
 */
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { QuestAction } from '@/data/dailyQuestPool';

export function useQuestAction() {
  const router = useRouter();

  return useCallback(
    (action: QuestAction | undefined, onCheckin?: () => void) => {
      if (!action) return;
      switch (action.kind) {
        case 'navigate': {
          const path = action.target || '/';
          const qs = action.query ? '?' + new URLSearchParams(action.query).toString() : '';
          router.push(path + qs);
          break;
        }
        case 'highlight': {
          if (!action.target) return;
          const el = document.getElementById(action.target);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('quest-target-pulse');
            setTimeout(() => el.classList.remove('quest-target-pulse'), 2800);
          }
          break;
        }
        case 'openWishlist': {
          router.push('/goals?tab=wishlist');
          break;
        }
        case 'openMoney': {
          router.push('/money');
          break;
        }
        case 'checkin': {
          onCheckin?.();
          break;
        }
      }
    },
    [router]
  );
}
