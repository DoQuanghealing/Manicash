/* ═══ MoneySheet — tấm trượt từ đáy cho 3 khối tiền ═══
 *
 * PO chốt: bấm khối → tấm trượt lên, chừa mép, KHÔNG vượt ra khỏi màn hình,
 * vuốt xuống để đóng.
 *
 * ⚠️ Cố tình KHÔNG animate `height` và KHÔNG dùng prop `layout`:
 *   - exit `height: auto → 0` của AnimatePresence không bao giờ báo kết thúc,
 *     node sẽ ở lại DOM vĩnh viễn (đã dính một lần ở phần vuốt-tắt nhắc nhở).
 *   - `layout` ghi đè transform thủ công nên nuốt luôn cử chỉ kéo.
 * Chỉ animate transform + opacity — hai thứ này kết thúc đàng hoàng.
 *
 * Chiều cao dùng `dvh` chứ không `vh`: trên trình duyệt di động thanh địa chỉ
 * thu vào/nhả ra làm `vh` sai, đúng cái cảnh "tràn khỏi màn hình" PO than.
 */
'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import IncomeSheetContent from './sheets/IncomeSheetContent';
import ExpenseSheetContent from './sheets/ExpenseSheetContent';
import SavingsSheetContent from './sheets/SavingsSheetContent';
import './MoneySheet.css';

export type MoneySheetKind = 'income' | 'expense' | 'savings';

const TITLES: Record<MoneySheetKind, string> = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
  savings: 'Tiết kiệm',
};

/** Kéo xuống quá ngần này (hoặc hất đủ nhanh) thì coi như muốn đóng. */
const CLOSE_OFFSET = 120;
const CLOSE_VELOCITY = 500;

interface Props {
  kind: MoneySheetKind | null;
  onClose: () => void;
}

export default function MoneySheet({ kind, onClose }: Props) {
  // Khoá cuộn nền khi tấm trượt đang mở, trả lại đúng giá trị cũ khi đóng.
  useEffect(() => {
    if (!kind) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [kind]);

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, onClose]);

  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          className="ms-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          {/* HAI lớp, cố ý:
           *   .ms-slide — chỉ lo trượt vào/ra
           *   .ms-sheet — chỉ lo cử chỉ kéo
           * Gộp làm một thì `drag="y"` chiếm quyền trục Y và NUỐT luôn
           * `animate={{ y: 0 }}`; tấm trượt sẽ nằm im dưới đáy màn hình, không
           * bao giờ hiện lên. Đã dính đúng lỗi này một lần. */}
          <motion.div
            className="ms-slide"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
          <motion.div
            className="ms-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={TITLES[kind]}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) onClose();
            }}
          >
            <div className="ms-grabber" aria-hidden />

            <header className="ms-header">
              <h2 className="ms-title">{TITLES[kind]}</h2>
              <button type="button" className="ms-close" onClick={onClose} aria-label="Đóng">
                <X size={18} />
              </button>
            </header>

            {/* Chỉ phần này cuộn — mép tấm trượt đứng yên trong khung màn hình. */}
            <div className="ms-body">
              {kind === 'income' && <IncomeSheetContent />}
              {kind === 'expense' && <ExpenseSheetContent />}
              {kind === 'savings' && <SavingsSheetContent />}
            </div>
          </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
