/* ═══ InputMoneyFlow — FAB + SplitFundsPanel quick-action popup ═══
 * Entry point 3: Quick fund split from the Overview page FAB button.
 * Uses SplitFundsPanel (shared) with mainBalance as source.
 */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { SplitResult } from '@/stores/useDashboardStore';
import SplitFundsPanel from '@/components/ui/SplitFundsPanel';
import SplitSuccessPopup from '@/components/ui/SplitSuccessPopup';
import './InputMoneyFlow.css';

export default function InputMoneyFlow() {
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const [showPopup, setShowPopup] = useState(false);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);

  const handleFabClick = useCallback(() => {
    setShowPopup(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setShowPopup(false);
  }, []);

  const handleSplitConfirm = useCallback((result: SplitResult) => {
    setSplitResult(result);
    setShowPopup(false);
  }, []);

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        className="input-fab"
        id="input-money-fab"
        onClick={handleFabClick}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
        aria-label="Chia tiền nhanh"
      >
        <Plus size={24} strokeWidth={2.5} />
        <div className="input-fab-ring" />
      </motion.button>

      {/* Fund Split Popup */}
      <AnimatePresence>
        {showPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              className="input-popup-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleDismiss}
            />

            {/* Popup Panel */}
            <motion.div
              className="input-popup-panel"
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 80, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Close button */}
              <button className="input-popup-close" onClick={handleDismiss}>
                <X size={18} />
              </button>

              {/* Butler header */}
              <div className="input-popup-butler">
                <div className="input-popup-butler-avatar">🎩</div>
                <div className="input-popup-butler-bubble">
                  <p className="input-popup-butler-text">
                    <span className="input-popup-butler-title">Chia tiền nhanh!</span>
                    <br />
                    Phân bổ số dư trong ví chính vào các quỹ ngay bây giờ.
                  </p>
                </div>
              </div>

              {/* SplitFundsPanel — shared component */}
              <SplitFundsPanel
                totalAmount={mainBalance}
                onConfirm={handleSplitConfirm}
                onCancel={handleDismiss}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Split Success Popup */}
      <SplitSuccessPopup
        isOpen={!!splitResult}
        result={splitResult}
        onClose={() => setSplitResult(null)}
      />
    </>
  );
}
