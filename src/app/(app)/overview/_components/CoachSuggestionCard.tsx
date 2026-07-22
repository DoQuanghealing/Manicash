/* ═══ CoachSuggestionCard — Đề xuất chủ động của quản gia (PV-2) ═══
 * CHỈ hiện với tier Phú Vương. Hiện MỘT đề xuất ưu tiên cao nhất (không nài), dạng
 * card xin phép: bấm hành động = điều hướng (KHÔNG tự đổi tiền); bấm ✕ = bỏ qua (cooldown).
 */
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useMoneySnapshotV1 } from '@/hooks/useMoneySnapshotV1';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCoachSuggestionStore, isInCooldown } from '@/stores/useCoachSuggestionStore';
import { generateCoachSuggestions } from '@/lib/aiMoneyChat/coach/suggestionEngine';
import { hasFeature } from '@/lib/monetization/butlerFeatures';
import { useEffectiveButlerLevel } from '@/hooks/useEffectiveButlerLevel';
import './CoachSuggestionCard.css';

const TONE_CLASS = {
  urgent: 'coach-tone-red',
  warn: 'coach-tone-amber',
  info: 'coach-tone-navy',
  positive: 'coach-tone-green',
} as const;

export default function CoachSuggestionCard() {
  const router = useRouter();
  const snapshot = useMoneySnapshotV1();
  const tier = useSettingsStore((s) => s.butlerTier);
  const honorific = useSettingsStore((s) => s.honorific);
  const butlerName = useSettingsStore((s) => s.butlerName);
  const dismissed = useCoachSuggestionStore((s) => s.dismissed);
  const dismiss = useCoachSuggestionStore((s) => s.dismiss);

  const addr = honorific || 'ngài';

  // Gate theo ma trận 3 cấp (Mercedes T1). FOMO: billing chưa cap nên chỉ cần persona;
  // khi PV-5 bật NEXT_PUBLIC_BUTLER_BILLING_ENFORCED → truyền thêm billingTier từ profile.
  const { level } = useEffectiveButlerLevel();
  const canCoach = hasFeature(level, 'coach.proactive');

  // Đề xuất ưu tiên cao nhất chưa bị bỏ qua (trong cooldown).
  const top = useMemo(() => {
    if (!canCoach) return null;
    // Mốc "bây giờ" lấy từ snapshot (pure, isomorphic) — cooldown 3 ngày không cần độ chính xác ms.
    const now = new Date(snapshot.clientNow).getTime();
    return (
      generateCoachSuggestions(snapshot, addr).find((s) => !isInCooldown(dismissed[s.id], now)) ?? null
    );
  }, [canCoach, snapshot, addr, dismissed]);

  if (!canCoach || !top) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={top.id}
        className={`coach-card ${TONE_CLASS[top.tone]}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="coach-avatar">🐉</div>
        <div className="coach-body">
          <div className="coach-name">{butlerName} · Phú Vương</div>
          <div className="coach-title">{top.emoji} {top.title}</div>
          <p className="coach-text">{top.body}</p>
          {top.actionLabel && top.actionTarget && (
            <button
              className="coach-action"
              onClick={() => router.push(top.actionTarget as string)}
            >
              {top.actionLabel}
            </button>
          )}
        </div>
        <button
          className="coach-dismiss"
          onClick={() => dismiss(top.id, new Date().toISOString())}
          aria-label="Bỏ qua đề xuất"
        >
          <X size={15} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
