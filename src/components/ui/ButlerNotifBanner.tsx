/* ═══ ButlerNotifBanner — Absolute overlay inside mobile-shell, Overview-only ═══
 * Positioned absolute within mobile-shell → stays inside the phone frame.
 * Swipe-up to dismiss. 6s display time.
 * Route-aware: only renders on /overview.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useButlerContext } from '@/hooks/useButlerContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import './FloatingButler.css';

const NOTIF_SHOW_MS = 6000;    // Visible for 6s
const NOTIF_CYCLE_MS = 60_000; // New notification every 60s
const SWIPE_DISMISS_THRESHOLD = -30; // px — drag up to dismiss

export default function ButlerNotifBanner() {
  const pathname = usePathname();
  const { notification, nextNotification } = useButlerContext();
  const butlerName = useSettingsStore((s) => s.butlerName);
  const [showNotif, setShowNotif] = useState(false);

  // Only show on /overview
  const isOverview = pathname === '/overview';

  // Notification cycle: show after 3s, hide after 6s, next after 60s
  useEffect(() => {
    if (!isOverview) return;

    const showTimer = setTimeout(() => setShowNotif(true), 3000);
    const hideTimer = setTimeout(() => setShowNotif(false), 3000 + NOTIF_SHOW_MS);
    const cycleTimer = setTimeout(() => nextNotification(), NOTIF_CYCLE_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(cycleTimer);
    };
  }, [notification.text, nextNotification, isOverview]);

  // Reset when leaving overview
  useEffect(() => {
    if (!isOverview) setShowNotif(false);
  }, [isOverview]);

  // Swipe-up dismiss handler
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < SWIPE_DISMISS_THRESHOLD || info.velocity.y < -200) {
      setShowNotif(false);
    }
  }, []);

  // Hide when not on overview
  const visible = showNotif && isOverview;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`fb-notif fb-notif--${notification.priority}`}
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.6, bottom: 0.1 }}
          onDragEnd={handleDragEnd}
          style={{ touchAction: 'none' }}
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
