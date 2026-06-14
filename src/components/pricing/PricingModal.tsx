/* ═══ PricingModal — cửa sổ bán hàng 3 gói (bottom-sheet, framer-motion) ═══ */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown } from 'lucide-react';
import { usePricingModalStore } from '@/stores/usePricingModalStore';
import PricingCards from './PricingCards';
import './pricing-modal.css';

export default function PricingModal() {
  const isOpen = usePricingModalStore((s) => s.isOpen);
  const close = usePricingModalStore((s) => s.close);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="pm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            className="pm-panel"
            role="dialog"
            aria-label="Chọn gói ManiCash"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="pm-top">
              <h3 className="pm-title"><Crown size={18} /> Chọn gói ManiCash</h3>
              <button className="pm-close" onClick={close} aria-label="Đóng"><X size={18} /></button>
            </div>
            <PricingCards onSuccess={() => setTimeout(close, 1200)} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
