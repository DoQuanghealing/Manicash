/* ═══ CareCard — nhịp "chăm sóc" chủ động của Phú Vương (T4 · 0đ) ═══
 * CHỈ tier Phú Vương (care.companion). Hiện MỘT kịch bản ưu tiên cao nhất, tối đa
 * 1/ngày (gate ở useCareStore), cooldown ≥3 ngày/kịch bản, bỏ qua = lùi không nài.
 * Kịch bản có minigame → bấm hành động mở minigame "đập"; xong mới điều hướng.
 * KHÔNG tự đổi tiền — mọi hành động chỉ ĐIỀU HƯỚNG (mark-paid vẫn phải confirm ở đích).
 */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useMoneySnapshotV1 } from '@/hooks/useMoneySnapshotV1';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCareStore, isCareInCooldown } from '@/stores/useCareStore';
import { generateCareScripts } from '@/lib/aiMoneyChat/care/careTriggers';
import { resolveButlerLevel, hasFeature } from '@/lib/monetization/butlerFeatures';
import { getTodayKey } from '@/lib/moneyBrain/dateRange';
import SquashCritter from './SquashCritter';
import './CareCard.css';

const TONE_CLASS = {
  tease: 'care-tone-plum',
  warm: 'care-tone-amber',
  cheer: 'care-tone-green',
  nudge: 'care-tone-blue',
} as const;

export default function CareCard() {
  const router = useRouter();
  const snapshot = useMoneySnapshotV1();
  const tier = useSettingsStore((s) => s.butlerTier);
  const honorific = useSettingsStore((s) => s.honorific);
  const butlerName = useSettingsStore((s) => s.butlerName);
  const handled = useCareStore((s) => s.handled);
  const lastActionDateKey = useCareStore((s) => s.lastActionDateKey);
  const ack = useCareStore((s) => s.ack);

  const [playing, setPlaying] = useState(false);

  const addr = honorific || 'ngài';
  const todayKey = getTodayKey(snapshot.clientNow, snapshot.timezone);

  // Gate cấp 3 (Mercedes T1). FOMO: billing chưa cap → chỉ cần persona sovereign;
  // khi PV-5 bật NEXT_PUBLIC_BUTLER_BILLING_ENFORCED → truyền thêm billingTier.
  const canCare = hasFeature(resolveButlerLevel({ butlerTier: tier }), 'care.companion');

  const top = useMemo(() => {
    if (!canCare) return null;
    // "1 kịch bản/ngày": đã xử lý một cái hôm nay → nghỉ, không nài thêm.
    if (lastActionDateKey === todayKey) return null;
    const now = new Date(snapshot.clientNow).getTime();
    return (
      generateCareScripts(snapshot, addr).find((s) => !isCareInCooldown(handled[s.id], now)) ?? null
    );
  }, [canCare, snapshot, addr, handled, lastActionDateKey, todayKey]);

  if (!canCare || !top) return null;

  // Xử lý xong (hành động hoặc bỏ qua) → ghi cooldown + chốt 1/ngày, rồi điều hướng nếu có.
  function resolve(navigate: boolean) {
    if (!top) return;
    ack(top.id, todayKey, new Date().toISOString());
    if (navigate && top.action.target) router.push(top.action.target);
  }

  function onPrimary() {
    if (!top) return;
    if (top.minigame && !playing) {
      setPlaying(true);
      return;
    }
    resolve(true);
  }

  return (
    <AnimatePresence>
      <motion.div
        key={top.id}
        className={`care-card ${TONE_CLASS[top.tone]}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="care-avatar">🐉</div>
        <div className="care-body">
          <div className="care-name">{butlerName} · Phú Vương</div>
          <div className="care-title">{top.emoji} {top.title}</div>
          <p className="care-text">{top.body}</p>

          {playing && top.minigame ? (
            <SquashCritter kind={top.minigame} onDone={() => resolve(true)} />
          ) : (
            <div className="care-actions">
              <button className="care-action" onClick={onPrimary}>
                {top.action.label}
              </button>
              <button className="care-later" onClick={() => resolve(false)}>
                {top.action.dismissLabel}
              </button>
            </div>
          )}
        </div>

        {!playing && (
          <button
            className="care-dismiss"
            onClick={() => resolve(false)}
            aria-label="Bỏ qua"
          >
            <X size={15} />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
