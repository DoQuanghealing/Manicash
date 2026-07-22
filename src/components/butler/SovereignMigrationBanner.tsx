/* ═══ SovereignMigrationBanner — báo trước PV-5 (bước 3) ═══
 * Hiện khi user dùng persona Phú Vương mà chưa trả Pro Plus, lúc đã bật enforce.
 * Giữ chữ tín: 14 ngày báo trước + 7 ngày dùng thử, TRONG thời gian đó vẫn full cấp 3.
 * Đóng banner = ẩn trong ngày (hôm sau nhắc lại nhẹ nhàng, không nài).
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffectiveButlerLevel } from '@/hooks/useEffectiveButlerLevel';
import { useSovereignMigrationStore, isBannerDismissedToday } from '@/stores/useSovereignMigrationStore';
import './SovereignMigrationBanner.css';

const PHASE_CLASS = {
  notice: 'smb-notice',
  trial: 'smb-trial',
  ended: 'smb-ended',
} as const;

export default function SovereignMigrationBanner() {
  const router = useRouter();
  const { migration } = useEffectiveButlerLevel();
  const startNotice = useSovereignMigrationStore((s) => s.startNotice);
  const dismissBanner = useSovereignMigrationStore((s) => s.dismissBanner);
  const bannerDismissedAt = useSovereignMigrationStore((s) => s.bannerDismissedAt);

  const active = migration.showBanner;

  // Bắt đầu đếm 14 ngày kể từ LẦN ĐẦU user thấy thông báo (store tự chống ghi đè).
  useEffect(() => {
    if (active) startNotice(new Date().toISOString());
  }, [active, startNotice]);

  if (!active) return null;
  if (isBannerDismissedToday(bannerDismissedAt, new Date().toISOString())) return null;

  const phaseClass = PHASE_CLASS[migration.phase as keyof typeof PHASE_CLASS] ?? 'smb-notice';

  return (
    <AnimatePresence>
      <motion.div
        className={`smb ${phaseClass}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="smb-icon">🐉</div>
        <div className="smb-body">
          <div className="smb-headline">{migration.headline}</div>
          <p className="smb-text">{migration.body}</p>
          {migration.ctaLabel && (
            <button className="smb-cta" onClick={() => router.push('/upgrade')}>
              {migration.ctaLabel}
            </button>
          )}
        </div>
        <button
          className="smb-dismiss"
          onClick={() => dismissBanner(new Date().toISOString())}
          aria-label="Ẩn thông báo hôm nay"
        >
          <X size={15} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
