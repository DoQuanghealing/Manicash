/* ═══ ButlerDrawer — Full overlay with Motivation + Suggestions + Auto-Split ═══ */
'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MOTIVATION_QUOTES, AI_SUGGESTIONS } from '@/data/butlerDrawerData';
import { replaceButlerName } from '@/utils/butlerNameUtils';
import ButlerSettings from './ButlerSettings';
import './ButlerDrawer.css';

interface ButlerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatVND = (n: number) => n.toLocaleString('vi-VN') + 'đ';

export default function ButlerDrawer({ isOpen, onClose }: ButlerDrawerProps) {
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const addToBillFund = useFinanceStore((s) => s.addToBillFund);
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);
  const emergencyBalance = useFinanceStore((s) => s.emergencyBalance);
  const butlerName = useSettingsStore((s) => s.butlerName);

  const [showSplitPopup, setShowSplitPopup] = useState(false);
  const [billPercent, setBillPercent] = useState(40);
  const [savingsPercent, setSavingsPercent] = useState(20);
  const [showSettings, setShowSettings] = useState(false);

  // Random quote (stable per open)
  const quote = useMemo(
    () => {
      const raw = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
      return replaceButlerName(raw, butlerName);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, butlerName]
  );

  const splitAmount = mainBalance;
  const billAllocation = Math.round(splitAmount * (billPercent / 100));
  const savingsAllocation = Math.round(splitAmount * (savingsPercent / 100));
  const remainingPercent = 100 - billPercent - savingsPercent;

  const handleSplit = () => {
    if (billAllocation > 0) addToBillFund(billAllocation);
    setShowSplitPopup(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="bd-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="bd-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Handle bar */}
            <div className="bd-handle"><div className="bd-handle-bar" /></div>

            {/* ═══ Settings Sub-View ═══ */}
            <AnimatePresence mode="wait">
              {showSettings ? (
                <motion.div
                  key="settings"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 60, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ButlerSettings onBack={() => setShowSettings(false)} />
                </motion.div>
              ) : (
                <motion.div
                  key="main"
                  initial={{ x: -60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -60, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Header */}
                  <div className="bd-header">
                    <div className="bd-avatar-wrap">
                      <Image
                        src="/butler-avatar.png"
                        alt={butlerName}
                        width={44}
                        height={44}
                        className="bd-avatar-img"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h2 className="bd-title">{butlerName}</h2>
                      <p className="bd-subtitle">Quản gia tài chính AI</p>
                    </div>
                    <button
                      className="bd-settings-btn"
                      onClick={() => setShowSettings(true)}
                      aria-label="Settings"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      ⚙️
                    </button>
                  </div>

                  {/* ═══ Section 1: Motivation ═══ */}
                  <div className="bd-motivation">
                    <div className="bd-stars" />
                    <p className="bd-quote">&ldquo;{quote}&rdquo;</p>
                  </div>

                  {/* ═══ Section 2: AI Suggestions ═══ */}
                  <div className="bd-section-label">🤖 Gợi ý thông minh</div>
                  <div className="bd-suggestions">
                    {AI_SUGGESTIONS.map((s) => (
                      <div key={s.id} className="bd-sug-card">
                        <span className="bd-sug-icon">{s.icon}</span>
                        <div className="bd-sug-info">
                          <span className="bd-sug-title">{s.title}</span>
                          <span className="bd-sug-desc">{s.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ═══ Section 3: Auto-Split Button ═══ */}
                  <div className="bd-section-label">💸 Phân bổ tài chính</div>
                  <div className="bd-balance-row">
                    <div className="bd-bal-item">
                      <span className="bd-bal-label">Ví chính</span>
                      <span className="bd-bal-value">{formatVND(mainBalance)}</span>
                    </div>
                    <div className="bd-bal-item">
                      <span className="bd-bal-label">Quỹ Bill</span>
                      <span className="bd-bal-value bill">{formatVND(billFundBalance)}</span>
                    </div>
                    <div className="bd-bal-item">
                      <span className="bd-bal-label">Dự phòng</span>
                      <span className="bd-bal-value savings">{formatVND(emergencyBalance)}</span>
                    </div>
                  </div>

                  <button className="bd-split-btn" onClick={() => setShowSplitPopup(true)}>
                    ✨ Chia tiền tự động
                  </button>

                  {/* ═══ Auto-Split Popup ═══ */}
                  <AnimatePresence>
                    {showSplitPopup && (
                      <motion.div
                        className="bd-split-popup"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <h3 className="bd-split-title">Phân bổ thu nhập</h3>
                        <p className="bd-split-subtitle">Từ ví chính: {formatVND(splitAmount)}</p>

                        {/* Sliders */}
                        <div className="bd-slider-group">
                          <div className="bd-slider-row">
                            <span className="bd-slider-label">🏦 Quỹ Bill ({billPercent}%)</span>
                            <span className="bd-slider-value">{formatVND(billAllocation)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={80}
                            value={billPercent}
                            onChange={(e) => setBillPercent(Number(e.target.value))}
                            className="bd-range"
                          />
                        </div>

                        <div className="bd-slider-group">
                          <div className="bd-slider-row">
                            <span className="bd-slider-label">💎 Tiết kiệm ({savingsPercent}%)</span>
                            <span className="bd-slider-value">{formatVND(savingsAllocation)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={50}
                            value={savingsPercent}
                            onChange={(e) => setSavingsPercent(Number(e.target.value))}
                            className="bd-range"
                          />
                        </div>

                        <div className="bd-split-remaining">
                          Còn lại trong ví: {remainingPercent}% ({formatVND(Math.round(splitAmount * (remainingPercent / 100)))})
                        </div>

                        <div className="bd-split-actions">
                          <button className="bd-split-cancel" onClick={() => setShowSplitPopup(false)}>Hủy</button>
                          <button
                            className="bd-split-confirm"
                            onClick={handleSplit}
                            disabled={billAllocation <= 0 && savingsAllocation <= 0}
                          >
                            Xác nhận chia
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
