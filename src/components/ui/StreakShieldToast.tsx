/* ═══ StreakShieldToast — Banner khi shield được dùng ═══
 *
 * Detect shield mới dùng bằng so sánh user.shieldsUsedAt[].length thay đổi.
 * Hiển thị banner 5s ở top với animation.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import './StreakShieldToast.css';

export default function StreakShieldToast() {
  const shieldsUsedAt = useAuthStore((s) => s.user?.shieldsUsedAt);
  const streak = useAuthStore((s) => s.user?.streak || 0);
  const [show, setShow] = useState(false);
  const prevCountRef = useRef(shieldsUsedAt?.length ?? 0);

  useEffect(() => {
    const currentCount = shieldsUsedAt?.length ?? 0;
    if (currentCount > prevCountRef.current) {
      prevCountRef.current = currentCount;
      // Defer setState ra ngoài effect body để tránh cascading render warning.
      // Đây là subscribe pattern (store update → UI toast) — pattern hợp lệ.
      const showTimer = setTimeout(() => setShow(true), 0);
      const hideTimer = setTimeout(() => setShow(false), 5500);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
    prevCountRef.current = currentCount;
  }, [shieldsUsedAt]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="sst-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          <div className="sst-icon">
            <Shield size={20} />
          </div>
          <div className="sst-content">
            <p className="sst-title">Shield đã cứu streak của bạn! 🛡️</p>
            <p className="sst-body">
              Streak {streak} ngày được bảo toàn. Đừng lặp lại nhé!
            </p>
          </div>
          <button className="sst-close" onClick={() => setShow(false)} aria-label="Đóng">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
