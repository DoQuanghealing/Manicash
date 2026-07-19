/* ═══ useEffectiveButlerLevel — cấp quản gia HIỆU LỰC (gồm ân hạn PV-5) ═══
 * Nguồn duy nhất cho mọi gate cấp ở client: persona user chọn × trần theo gói
 * × ân hạn migration (14 ngày báo + 7 ngày trial vẫn giữ cấp 3).
 * Dùng thay cho resolveButlerLevel gọi trực tiếp trong component.
 */
'use client';

import { useMemo } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProStatus } from '@/hooks/useIsPro';
import { useSovereignMigrationStore } from '@/stores/useSovereignMigrationStore';
import { resolveButlerLevel, isButlerBillingEnforced, type ButlerLevel } from '@/lib/monetization/butlerFeatures';
import { evaluateSovereignMigration, type MigrationState } from '@/lib/monetization/sovereignMigration';

export interface EffectiveButlerLevel {
  level: ButlerLevel;
  migration: MigrationState;
}

export function useEffectiveButlerLevel(): EffectiveButlerLevel {
  const butlerTier = useSettingsStore((s) => s.butlerTier);
  const { tier: billingTier } = useProStatus();
  const noticeStartedAt = useSovereignMigrationStore((s) => s.noticeStartedAt);

  return useMemo(() => {
    const enforced = isButlerBillingEnforced();
    const migration = evaluateSovereignMigration({
      butlerTier,
      billingTier,
      enforced,
      noticeStartedAt,
      nowISO: new Date().toISOString(),
    });

    // Chưa enforce → giữ hành vi FOMO hiện tại (persona quyết định).
    if (!enforced) {
      return { level: resolveButlerLevel({ butlerTier }), migration };
    }
    // Đã enforce: lấy min(persona, cấp hiệu lực sau ân hạn).
    const personaLevel = resolveButlerLevel({ butlerTier, billingTier });
    const level = (migration.effectiveLevel > personaLevel ? personaLevel : migration.effectiveLevel) as ButlerLevel;
    return { level, migration };
  }, [butlerTier, billingTier, noticeStartedAt]);
}
