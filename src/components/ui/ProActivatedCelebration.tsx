/* ═══ ProActivatedCelebration — Popup trong app khi vừa mua Pro thành công ═══
 *
 * /payment/success (ngoài app shell) set sessionStorage flag khi webhook xác nhận
 * paid. Component này mount trong (app)/layout.tsx, đọc flag đúng 1 lần rồi xoá
 * ngay — hiện popup ăn mừng gọn gàng, KHÔNG confetti (giữ tông sang trọng, không
 * lặp lại mỗi lần mở app).
 */
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';
import './ProActivatedCelebration.css';

export const PRO_JUST_ACTIVATED_KEY = 'manicash:pro-just-activated';

export default function ProActivatedCelebration() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(PRO_JUST_ACTIVATED_KEY) === '1';
      if (flagged) sessionStorage.removeItem(PRO_JUST_ACTIVATED_KEY);
    } catch {
      /* sessionStorage unavailable (privacy mode) — bỏ qua, không chặn app */
    }
    if (flagged) setVisible(true);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pac-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setVisible(false)}
        >
          <motion.div
            className="pac-card"
            initial={{ y: 24, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pac-icon-wrap">
              <Crown size={30} />
            </div>
            <h2 className="pac-title">Chúc mừng! Bạn đã là Pro 💎</h2>
            <p className="pac-body">
              Cảm ơn bạn đã đồng hành cùng ManiCash. Toàn bộ tính năng Pro đã được mở khoá.
            </p>
            <button className="pac-btn" onClick={() => setVisible(false)}>
              Tuyệt vời!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
