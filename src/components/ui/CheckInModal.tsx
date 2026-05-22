/* ═══ CheckInModal — Điểm danh hằng ngày ═══
 *
 * Modal explainer khi user bấm "Điểm danh" trên DailyQuestCard.
 *
 * Nguyên tắc: streak chỉ tăng khi user thực sự ghi 1 giao dịch (theo
 * logic updateStreak trong useAuthStore). Modal này hiển thị streak hiện
 * tại + CTA "Ghi giao dịch ngay" để dẫn user tới /input.
 *
 * KHÔNG cho user click "Điểm danh xong" mà không ghi gì — như vậy phá
 * vỡ ý nghĩa habit-building của streak.
 */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Flame, Shield, X } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getDateKey } from '@/lib/dateHelpers';
import './CheckInModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckInModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const streak = user?.streak || 0;
  const shields = user?.streakShields || 0;
  const today = getDateKey(new Date());
  const lastActive = (user?.lastActiveDate || '').slice(0, 10);
  const checkedInToday = lastActive === today;

  const nextMilestone = Math.ceil((streak + 1) / 7) * 7;
  const daysToShield = nextMilestone - streak;

  const handleGoInput = () => {
    onClose();
    router.push('/input?type=expense');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cim-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="cim-panel"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="cim-close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>

            <div className="cim-hero">
              <motion.div
                className="cim-flame-wrap"
                animate={{ rotate: [-3, 3, -3] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              >
                <Flame size={56} />
                <span className="cim-streak-num">{streak}</span>
              </motion.div>
              <h2 className="cim-title">
                {checkedInToday ? 'Bạn đã điểm danh hôm nay rồi!' : 'Sẵn sàng điểm danh?'}
              </h2>
              <p className="cim-sub">
                Streak hiện tại: <strong>{streak} ngày</strong>
                {shields > 0 && (
                  <>
                    {' · '}
                    <Shield size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {shields} shield
                  </>
                )}
              </p>
            </div>

            <div className="cim-explainer">
              <p className="cim-explainer-label">📌 Cách điểm danh hoạt động</p>
              <ul className="cim-rules">
                <li>
                  <span className="cim-rule-num">1</span>
                  Ghi <strong>1 giao dịch bất kỳ</strong> trong ngày (thu/chi/chuyển khoản) → streak +1
                </li>
                <li>
                  <span className="cim-rule-num">2</span>
                  Đạt mốc <strong>7 ngày</strong> liên tiếp → tặng 1 shield 🛡️ (tối đa giữ 3)
                </li>
                <li>
                  <span className="cim-rule-num">3</span>
                  Lỡ 1 ngày → shield tự kích để cứu streak
                </li>
              </ul>
              {!checkedInToday && daysToShield <= 3 && (
                <p className="cim-milestone-hint">
                  🎯 Còn <strong>{daysToShield} ngày</strong> nữa đến mốc {nextMilestone}-day — sẽ nhận thêm 1 shield!
                </p>
              )}
            </div>

            {checkedInToday ? (
              <div className="cim-already">
                ✓ Hôm nay đã đếm. Hẹn lại bạn ngày mai!
              </div>
            ) : (
              <button className="cim-cta" onClick={handleGoInput}>
                Ghi giao dịch để điểm danh →
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
