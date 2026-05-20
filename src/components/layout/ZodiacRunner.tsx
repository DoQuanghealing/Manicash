/* ═══ ZodiacRunner — Con giáp chạy trên header ═══
 *
 * Hiển thị 1 con giáp đang được user chọn (activeZodiac) hoặc fallback:
 *   1. activeZodiac đã set & unlocked
 *   2. Mệnh chủ tự động (yearOfBirth → chiIndex)
 *   3. Con giáp năm hiện tại (year % 12)
 *
 * Animation: chạy ngang qua header với độ trễ ngẫu nhiên 30-60s.
 * Click → mở reward drawer (future), hiện tại scroll vào hồ sơ.
 */
'use client';

import { useMemo, useState } from 'react';
import { useRewardStore } from '@/stores/useRewardStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getRewardById, getZodiacByChiIndex } from '@/data/rewardCatalog';
import { getBanMenh, getCurrentYearChi } from '@/lib/banMenh';
import RewardCollectionDrawer from '@/components/ui/RewardCollectionDrawer';
import './ZodiacRunner.css';

export default function ZodiacRunner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeZodiacId = useRewardStore((s) => s.activeZodiac);
  const isUnlocked = useRewardStore((s) => s.isUnlocked);
  const yearOfBirth = useAuthStore((s) => s.user?.yearOfBirth);

  const zodiacToShow = useMemo(() => {
    // 1. User đã chọn & unlock
    if (activeZodiacId && isUnlocked(activeZodiacId)) {
      const item = getRewardById(activeZodiacId);
      if (item) return { icon: item.icon, name: item.name, locked: false };
    }
    // 2. Mệnh chủ theo yearOfBirth
    if (yearOfBirth) {
      const menh = getBanMenh(yearOfBirth);
      if (menh) {
        const item = getZodiacByChiIndex(menh.chiIndex);
        return {
          icon: menh.chiIcon,
          name: item?.name || `${menh.chi}`,
          locked: !item ? false : !isUnlocked(item.id),
        };
      }
    }
    // 3. Con giáp năm hiện tại (fallback)
    const current = getCurrentYearChi();
    return { icon: current.icon, name: current.chi, locked: true };
  }, [activeZodiacId, isUnlocked, yearOfBirth]);

  return (
    <>
      <button
        className={`zodiac-runner ${zodiacToShow.locked ? 'zodiac-runner--locked' : ''}`}
        onClick={() => setDrawerOpen(true)}
        aria-label={`Linh vật: ${zodiacToShow.name}`}
        title={zodiacToShow.name}
      >
        <span className="zodiac-runner-emoji">{zodiacToShow.icon}</span>
      </button>
      <RewardCollectionDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
