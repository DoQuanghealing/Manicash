/* ═══ InputMoneyFlow — Floating + Button with Fund Split Popup ═══ */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Sparkles, ArrowRight } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import './InputMoneyFlow.css';

const SPLIT_PRESETS = [
  { label: '50/20/20/10', desc: 'Cân bằng', splits: { spending: 50, reserve: 20, goals: 20, investment: 10 } },
  { label: '60/15/15/10', desc: 'Ưu tiên chi', splits: { spending: 60, reserve: 15, goals: 15, investment: 10 } },
  { label: '40/20/30/10', desc: 'Ưu tiên tiết kiệm', splits: { spending: 40, reserve: 20, goals: 30, investment: 10 } },
];

export default function InputMoneyFlow() {
  const autoSplit = useDashboardStore((s) => s.auto_split);
  const setAutoSplit = useDashboardStore((s) => s.setAutoSplit);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(0);

  const handleFabClick = useCallback(() => {
    if (!autoSplit) {
      setShowPopup(true);
    }
  }, [autoSplit]);

  const handleDismiss = useCallback(() => {
    setShowPopup(false);
  }, []);

  const handleEnableAutoSplit = useCallback(() => {
    setAutoSplit(true);
    setShowPopup(false);
  }, [setAutoSplit]);

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
        aria-label="Thêm giao dịch"
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

              {/* Butler message */}
              <div className="input-popup-butler">
                <div className="input-popup-butler-avatar">🎩</div>
                <div className="input-popup-butler-bubble">
                  <p className="input-popup-butler-text">
                    <span className="input-popup-butler-title">Cậu chủ ơi!</span>
                    <br />
                    Hãy chia tiền ra các quỹ để tránh xài lẹm và bảo vệ mục tiêu lớn!
                  </p>
                </div>
              </div>

              {/* Sparkle divider */}
              <div className="input-popup-divider">
                <Sparkles size={14} className="input-popup-sparkle" />
              </div>

              {/* Preset selection */}
              <p className="input-popup-section-label">Chọn tỷ lệ phân chia</p>
              <div className="input-popup-presets">
                {SPLIT_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    className={`input-popup-preset ${selectedPreset === i ? 'input-popup-preset--active' : ''}`}
                    onClick={() => setSelectedPreset(i)}
                  >
                    <span className="input-popup-preset-label">{preset.label}</span>
                    <span className="input-popup-preset-desc">{preset.desc}</span>
                  </button>
                ))}
              </div>

              {/* Split breakdown */}
              <div className="input-popup-breakdown">
                {Object.entries(SPLIT_PRESETS[selectedPreset].splits).map(([key, pct]) => (
                  <div key={key} className="input-popup-breakdown-row">
                    <span className="input-popup-breakdown-name">
                      {key === 'spending' ? 'Chi tiêu' :
                       key === 'reserve' ? 'Dự phòng' :
                       key === 'goals' ? 'Mục tiêu' : 'Đầu tư'}
                    </span>
                    <div className="input-popup-breakdown-bar-wrap">
                      <div
                        className="input-popup-breakdown-bar"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="input-popup-breakdown-pct">{pct}%</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="input-popup-actions">
                <button
                  className="input-popup-btn-primary"
                  onClick={handleEnableAutoSplit}
                >
                  <span>Bật chia tự động</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  className="input-popup-btn-ghost"
                  onClick={handleDismiss}
                >
                  Để sau
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
