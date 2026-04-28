/* ═══ ButlerNotifBanner — Notification inside shell-content, below header ═══
 * Renders as the first child of shell-content via app layout.
 * Shows bill reminders, savings nudges, wellness messages.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useButlerContext } from '@/hooks/useButlerContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import './FloatingButler.css';

const NOTIF_SHOW_MS = 5000;    // Visible for 5s
const NOTIF_CYCLE_MS = 60_000; // New notification every 60s

export default function ButlerNotifBanner() {
  const { notification, nextNotification } = useButlerContext();
  const butlerName = useSettingsStore((s) => s.butlerName);
  const [showNotif, setShowNotif] = useState(false);

  // Notification cycle: show after 3s, hide after 5s, next after 60s
  useEffect(() => {
    const showTimer = setTimeout(() => setShowNotif(true), 3000);
    const hideTimer = setTimeout(() => setShowNotif(false), 3000 + NOTIF_SHOW_MS);
    const cycleTimer = setTimeout(() => nextNotification(), NOTIF_CYCLE_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(cycleTimer);
    };
  }, [notification.text, nextNotification]);

  return (
    <AnimatePresence>
      {showNotif && (
        <motion.div
          className={`fb-notif fb-notif--${notification.priority}`}
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          <div className="fb-notif-avatar">
            <Image src="/butler-avatar.png" alt={butlerName} width={34} height={34} className="fb-notif-avatar-img" />
          </div>
          <div className="fb-notif-body">
            <div className="fb-notif-header">
              <span className="fb-notif-name">{butlerName}</span>
              <span className="fb-notif-time">vừa xong</span>
            </div>
            <p className="fb-notif-text">{notification.text}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
