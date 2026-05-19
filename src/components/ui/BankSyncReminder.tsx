/* ═══ BankSyncReminder — Nudge user to reconcile with bank ═══
 *
 * Shows when (a) user has never marked synced, or (b) it's been ≥7 days.
 * Two actions: "Tôi đã đồng bộ" (resets cadence), "Để sau" (snoozes 24h).
 */
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CheckCircle2 } from 'lucide-react';
import { useBankSyncStore } from '@/stores/useBankSyncStore';
import './BankSyncReminder.css';

export default function BankSyncReminder() {
  const lastSyncedAt = useBankSyncStore((s) => s.lastSyncedAt);
  const snoozedUntil = useBankSyncStore((s) => s.snoozedUntil);
  const markSynced = useBankSyncStore((s) => s.markSynced);
  const snooze = useBankSyncStore((s) => s.snooze);

  // Recompute "should show" client-side. Avoids hydration mismatch.
  const [shouldShow, setShouldShow] = useState(false);
  const [daysSince, setDaysSince] = useState<number | null>(null);

  useEffect(() => {
    const s = useBankSyncStore.getState();
    setShouldShow(s.shouldShowReminder());
    const d = s.daysSinceSync();
    setDaysSince(Number.isFinite(d) ? d : null);
  }, [lastSyncedAt, snoozedUntil]);

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
