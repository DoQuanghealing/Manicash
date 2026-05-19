/* ═══ BankSyncReminder — Nudge user to reconcile with bank ═══
 *
 * Shows when (a) user has never marked synced, or (b) it's been ≥7 days.
 * Two actions: "Tôi đã đồng bộ" (resets cadence), "Để sau" (snoozes 24h).
 *
 * Visibility derived inline from store state — no useEffect+setState
 * cascade. SSR returns shouldShow=false so server output is stable; the
 * client-side render after hydration computes the real value.
 */
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CheckCircle2 } from 'lucide-react';
import { useBankSyncStore } from '@/stores/useBankSyncStore';
import './BankSyncReminder.css';

const SYNC_REMINDER_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(fromIso: string, nowMs: number): number {
  const from = new Date(fromIso).getTime();
  return Math.floor((nowMs - from) / MS_PER_DAY);
}

export default function BankSyncReminder() {
  const lastSyncedAt = useBankSyncStore((s) => s.lastSyncedAt);
  const snoozedUntil = useBankSyncStore((s) => s.snoozedUntil);
  const markSynced = useBankSyncStore((s) => s.markSynced);
  const snooze = useBankSyncStore((s) => s.snooze);

  // Cache "now" as state so the render stays pure. Refresh when sync
  // state changes — banner doesn't need second-level granularity. The
  // lint rule discourages setState-in-effect for cascade-render reasons;
  // here the cascade is bounded (mount + on sync change) so the cost is
  // acceptable.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [lastSyncedAt, snoozedUntil]);

  const shouldShow = (() => {
    if (now === null) return false; // SSR / pre-mount
    if (snoozedUntil && new Date(snoozedUntil).getTime() > now) return false;
    if (!lastSyncedAt) return true;
    return daysBetween(lastSyncedAt, now) >= SYNC_REMINDER_DAYS;
  })();

  const daysSince = lastSyncedAt && now !== null ? daysBetween(lastSyncedAt, now) : null;

  const headline = daysSince === null
    ? 'Đồng bộ tài khoản ngân hàng?'
    : `Đã ${daysSince} ngày chưa đồng bộ`;

  const subline = daysSince === null
    ? 'Đối chiếu số dư trong app với ngân hàng để tránh sai lệch.'
    : 'Số dư trong app có thể đã lệch so với ngân hàng thực tế.';

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          className="bsr-card"
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <div className="bsr-icon">
            <Building2 size={18} />
          </div>
          <div className="bsr-copy">
            <p className="bsr-headline">{headline}</p>
            <p className="bsr-subline">{subline}</p>
          </div>
          <div className="bsr-actions">
            <button
              className="bsr-btn bsr-btn--primary"
              type="button"
              onClick={markSynced}
            >
              <CheckCircle2 size={14} />
              <span>Đã đồng bộ</span>
            </button>
            <button
              className="bsr-btn bsr-btn--ghost"
              type="button"
              onClick={snooze}
            >
              Để sau
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
