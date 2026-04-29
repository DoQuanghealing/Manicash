/* ═══ SplitFundsPanel — Shared component for all 3 fund-split entry points ═══
 * 3 preset cards + collapsible slider section + manual input mode
 * Props: totalAmount (source), onConfirm(SplitResult), onCancel
 */
'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Keyboard, RotateCcw } from 'lucide-react';
import { SPLIT_PRESETS, DEFAULT_PRESET_INDEX, type SplitPreset } from '@/constants/splitPresets';
import { useDashboardStore, type SplitResult } from '@/stores/useDashboardStore';
import './SplitFundsPanel.css';

interface SplitFundsPanelProps {
  totalAmount: number;
  onConfirm: (result: SplitResult) => void;
  onCancel: () => void;
}

const formatVND = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}đ`;
};

const formatVNDFull = (n: number) => n.toLocaleString('vi-VN') + 'đ';

export default function SplitFundsPanel({ totalAmount, onConfirm, onCancel }: SplitFundsPanelProps) {
  const splitFunds = useDashboardStore((s) => s.splitFunds);

  // ── Preset & slider state ──
  const [activePresetIdx, setActivePresetIdx] = useState<number | null>(DEFAULT_PRESET_INDEX);
  const [billPercent, setBillPercent] = useState(SPLIT_PRESETS[DEFAULT_PRESET_INDEX].billPercent);
  const [savingsPercent, setSavingsPercent] = useState(SPLIT_PRESETS[DEFAULT_PRESET_INDEX].savingsPercent);
  const [reservePct, setReservePct] = useState(SPLIT_PRESETS[DEFAULT_PRESET_INDEX].savingsBreakdown.reserve);
  const [goalsPct, setGoalsPct] = useState(SPLIT_PRESETS[DEFAULT_PRESET_INDEX].savingsBreakdown.goals);
  const [investPct, setInvestPct] = useState(SPLIT_PRESETS[DEFAULT_PRESET_INDEX].savingsBreakdown.investment);

  // ── UI state ──
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualBill, setManualBill] = useState('');
  const [manualReserve, setManualReserve] = useState('');
  const [manualGoals, setManualGoals] = useState('');
  const [manualInvest, setManualInvest] = useState('');

  // ── Animated display amounts (count-up) ──
  const [displayBill, setDisplayBill] = useState(0);
  const [displaySavings, setDisplaySavings] = useState(0);
  const animRef = useRef<number>(0);

  // Actual calculated amounts
  const billAmount = Math.round(totalAmount * (billPercent / 100));
  const savingsTotal = Math.round(totalAmount * (savingsPercent / 100));
  const reserveAmount = Math.round(savingsTotal * (reservePct / 100));
  const goalsAmount = Math.round(savingsTotal * (goalsPct / 100));
  const investAmount = savingsTotal - reserveAmount - goalsAmount;
  const remaining = totalAmount - billAmount - savingsTotal;

  // Manual mode amounts
  const manualBillAmt = parseInt(manualBill.replace(/\D/g, ''), 10) || 0;
  const manualReserveAmt = parseInt(manualReserve.replace(/\D/g, ''), 10) || 0;
  const manualGoalsAmt = parseInt(manualGoals.replace(/\D/g, ''), 10) || 0;
  const manualInvestAmt = parseInt(manualInvest.replace(/\D/g, ''), 10) || 0;
  const manualTotal = manualBillAmt + manualReserveAmt + manualGoalsAmt + manualInvestAmt;
  const manualRemaining = totalAmount - manualTotal;
  const manualOverflow = manualTotal > totalAmount;

  // ── Count-up animation ──
  useEffect(() => {
    const targetBill = billAmount;
    const targetSavings = savingsTotal;
    const duration = 300;
    const start = performance.now();
    const startBill = displayBill;
    const startSavings = displaySavings;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

      setDisplayBill(Math.round(startBill + (targetBill - startBill) * ease));
      setDisplaySavings(Math.round(startSavings + (targetSavings - startSavings) * ease));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billAmount, savingsTotal]);

  // ── Apply preset ──
  const applyPreset = useCallback((idx: number) => {
    const p = SPLIT_PRESETS[idx];
    setActivePresetIdx(idx);
    setBillPercent(p.billPercent);
    setSavingsPercent(p.savingsPercent);
    setReservePct(p.savingsBreakdown.reserve);
    setGoalsPct(p.savingsBreakdown.goals);
    setInvestPct(p.savingsBreakdown.investment);
    setIsCustomExpanded(false);
    setIsManualMode(false);
  }, []);

  // ── When user drags any slider → deactivate preset ──
  const handleSliderChange = useCallback((setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setter(val);
    setActivePresetIdx(null);
    if (!isCustomExpanded) setIsCustomExpanded(true);
  }, [isCustomExpanded]);

  // ── Linked bill/savings: when bill changes, savings = 100 - bill ──
  const handleBillSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setBillPercent(val);
    setSavingsPercent(100 - val);
    setActivePresetIdx(null);
    if (!isCustomExpanded) setIsCustomExpanded(true);
  }, [isCustomExpanded]);

  const handleSavingsSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSavingsPercent(val);
    setBillPercent(100 - val);
    setActivePresetIdx(null);
    if (!isCustomExpanded) setIsCustomExpanded(true);
  }, [isCustomExpanded]);

  // ── Auto-balance manual inputs ──
  const handleAutoBalance = useCallback(() => {
    const excess = manualTotal - totalAmount;
    if (excess <= 0) return;
    // Reduce proportionally
    const ratio = totalAmount / manualTotal;
    setManualBill(Math.round(manualBillAmt * ratio).toLocaleString('vi-VN'));
    setManualReserve(Math.round(manualReserveAmt * ratio).toLocaleString('vi-VN'));
    setManualGoals(Math.round(manualGoalsAmt * ratio).toLocaleString('vi-VN'));
    setManualInvest(Math.round(manualInvestAmt * ratio).toLocaleString('vi-VN'));
  }, [manualTotal, totalAmount, manualBillAmt, manualReserveAmt, manualGoalsAmt, manualInvestAmt]);

  // ── Format manual input on change ──
  const handleManualInput = useCallback((setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setter(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
  }, []);

  // ── Toggle manual mode — pre-fill with current slider values ──
  const toggleManualMode = useCallback(() => {
    if (!isManualMode) {
      setManualBill(billAmount.toLocaleString('vi-VN'));
      setManualReserve(reserveAmount.toLocaleString('vi-VN'));
      setManualGoals(goalsAmount.toLocaleString('vi-VN'));
      setManualInvest(investAmount.toLocaleString('vi-VN'));
    }
    setIsManualMode(!isManualMode);
    setActivePresetIdx(null);
  }, [isManualMode, billAmount, reserveAmount, goalsAmount, investAmount]);

  // ── Confirm split ──
  const handleConfirm = useCallback(() => {
    if (isManualMode) {
      if (manualOverflow) return;
      // Convert manual amounts to percentages for splitFunds
      const bPct = totalAmount > 0 ? (manualBillAmt / totalAmount) * 100 : 0;
      const sPct = totalAmount > 0 ? ((manualReserveAmt + manualGoalsAmt + manualInvestAmt) / totalAmount) * 100 : 0;
      const savTotal = manualReserveAmt + manualGoalsAmt + manualInvestAmt;
      const result = splitFunds({
        sourceAmount: totalAmount,
        billPercent: bPct,
        savingsPercent: sPct,
        savingsBreakdown: {
          reserve: savTotal > 0 ? (manualReserveAmt / savTotal) * 100 : 40,
          goals: savTotal > 0 ? (manualGoalsAmt / savTotal) * 100 : 40,
          investment: savTotal > 0 ? (manualInvestAmt / savTotal) * 100 : 20,
        },
      });
      onConfirm(result);
    } else {
      const result = splitFunds({
        sourceAmount: totalAmount,
        billPercent,
        savingsPercent,
        savingsBreakdown: { reserve: reservePct, goals: goalsPct, investment: investPct },
      });
      onConfirm(result);
    }
  }, [isManualMode, manualOverflow, totalAmount, manualBillAmt, manualReserveAmt, manualGoalsAmt, manualInvestAmt, splitFunds, onConfirm, billPercent, savingsPercent, reservePct, goalsPct, investPct]);

  const isConfirmDisabled = isManualMode ? manualOverflow || manualTotal === 0 : totalAmount === 0;

  return (
    <div className="sfp-root">
      {/* ═══ Source Amount ═══ */}
      <div className="sfp-source">
        <span className="sfp-source-label">💰 Cần chia</span>
        <span className="sfp-source-amount">{formatVNDFull(totalAmount)}</span>
      </div>

      {/* ═══ 3 Preset Cards ═══ */}
      <p className="sfp-section-label">Chọn nhanh:</p>
      <div className="sfp-presets">
        {SPLIT_PRESETS.map((p, idx) => (
          <button
            key={p.id}
            className={`sfp-preset-card ${activePresetIdx === idx ? 'sfp-preset-card--active' : ''}`}
            onClick={() => applyPreset(idx)}
            aria-pressed={activePresetIdx === idx}
            style={{
              '--preset-color': p.color,
            } as React.CSSProperties}
          >
            <span className="sfp-preset-icon">{p.icon}</span>
            <span className="sfp-preset-name">{p.name}</span>
            {activePresetIdx === idx && (
              <span className="sfp-preset-badge">💡 Gợi ý</span>
            )}
            {activePresetIdx === null && idx === DEFAULT_PRESET_INDEX && (
              <span className="sfp-preset-badge sfp-preset-badge--custom">✏️ Tùy chỉnh</span>
            )}
            <span className="sfp-preset-ratio">{p.billPercent}/{p.savingsPercent}</span>
          </button>
        ))}
      </div>

      {/* ═══ Customization toggle ═══ */}
      <button
        className={`sfp-custom-toggle ${isCustomExpanded ? 'sfp-custom-toggle--open' : ''}`}
        onClick={() => setIsCustomExpanded(!isCustomExpanded)}
      >
        <ChevronDown size={16} className="sfp-custom-chevron" />
        <span>Tùy chỉnh chi tiết</span>
      </button>

      {/* ═══ Collapsible Slider Section ═══ */}
      <AnimatePresence initial={false}>
        {isCustomExpanded && !isManualMode && (
          <motion.div
            className="sfp-sliders-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="sfp-sliders">
              {/* Bill slider */}
              <div className="sfp-slider-group">
                <div className="sfp-slider-row">
                  <span className="sfp-slider-label">🏦 Quỹ Bill</span>
                  <span className="sfp-slider-value">{billPercent}% <span className="sfp-slider-amt">{formatVND(billAmount)}</span></span>
                </div>
                <input
                  type="range" min={0} max={100} value={billPercent}
                  onChange={handleBillSlider}
                  className="sfp-range sfp-range--bill"
                  aria-label="Phần trăm quỹ bill"
                />
              </div>

              {/* Savings slider */}
              <div className="sfp-slider-group">
                <div className="sfp-slider-row">
                  <span className="sfp-slider-label">💎 Tiết kiệm</span>
                  <span className="sfp-slider-value">{savingsPercent}% <span className="sfp-slider-amt">{formatVND(savingsTotal)}</span></span>
                </div>
                <input
                  type="range" min={0} max={100} value={savingsPercent}
                  onChange={handleSavingsSlider}
                  className="sfp-range sfp-range--savings"
                  aria-label="Phần trăm tiết kiệm"
                />
              </div>

              {/* Sub-sliders (savings breakdown) */}
              {savingsPercent > 0 && (
                <div className="sfp-sub-sliders">
                  <div className="sfp-sub-row">
                    <span className="sfp-sub-label">🔒 Dự phòng</span>
                    <input
                      type="range" min={0} max={100} value={reservePct}
                      onChange={handleSliderChange(setReservePct)}
                      className="sfp-range sfp-range--sub"
                      aria-label="Phần trăm dự phòng"
                    />
                    <span className="sfp-sub-value">{reservePct}% <span className="sfp-slider-amt">{formatVND(reserveAmount)}</span></span>
                  </div>
                  <div className="sfp-sub-row">
                    <span className="sfp-sub-label">🎯 Mục tiêu</span>
                    <input
                      type="range" min={0} max={100} value={goalsPct}
                      onChange={handleSliderChange(setGoalsPct)}
                      className="sfp-range sfp-range--sub"
                      aria-label="Phần trăm mục tiêu"
                    />
                    <span className="sfp-sub-value">{goalsPct}% <span className="sfp-slider-amt">{formatVND(goalsAmount)}</span></span>
                  </div>
                  <div className="sfp-sub-row">
                    <span className="sfp-sub-label">📈 Đầu tư</span>
                    <input
                      type="range" min={0} max={100} value={investPct}
                      onChange={handleSliderChange(setInvestPct)}
                      className="sfp-range sfp-range--sub"
                      aria-label="Phần trăm đầu tư"
                    />
                    <span className="sfp-sub-value">{investPct}% <span className="sfp-slider-amt">{formatVND(investAmount)}</span></span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Manual input toggle ═══ */}
      <button className="sfp-manual-toggle" onClick={toggleManualMode}>
        <Keyboard size={14} />
        <span>{isManualMode ? 'Quay lại chọn nhanh' : 'Nhập số tiền chính xác'}</span>
      </button>

      {/* ═══ Manual Input Mode ═══ */}
      <AnimatePresence initial={false}>
        {isManualMode && (
          <motion.div
            className="sfp-manual-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sfp-manual-grid">
              <div className="sfp-manual-field">
                <label className="sfp-manual-label">🏦 Quỹ Bill</label>
                <input
                  type="text" inputMode="numeric" placeholder="0"
                  value={manualBill} onChange={handleManualInput(setManualBill)}
                  className="sfp-manual-input"
                />
              </div>
              <div className="sfp-manual-field">
                <label className="sfp-manual-label">🔒 Dự phòng</label>
                <input
                  type="text" inputMode="numeric" placeholder="0"
                  value={manualReserve} onChange={handleManualInput(setManualReserve)}
                  className="sfp-manual-input"
                />
              </div>
              <div className="sfp-manual-field">
                <label className="sfp-manual-label">🎯 Mục tiêu</label>
                <input
                  type="text" inputMode="numeric" placeholder="0"
                  value={manualGoals} onChange={handleManualInput(setManualGoals)}
                  className="sfp-manual-input"
                />
              </div>
              <div className="sfp-manual-field">
                <label className="sfp-manual-label">📈 Đầu tư</label>
                <input
                  type="text" inputMode="numeric" placeholder="0"
                  value={manualInvest} onChange={handleManualInput(setManualInvest)}
                  className="sfp-manual-input"
                />
              </div>
            </div>

            {/* Overflow warning */}
            {manualOverflow && (
              <div className="sfp-manual-warning">
                <span>⚠️ Tổng vượt quá {formatVNDFull(totalAmount)}!</span>
                <button className="sfp-manual-autofix" onClick={handleAutoBalance}>
                  <RotateCcw size={12} /> Tự cân bằng
                </button>
              </div>
            )}

            {/* Underflow info */}
            {!manualOverflow && manualRemaining > 0 && manualTotal > 0 && (
              <p className="sfp-manual-info">
                Còn lại {formatVNDFull(manualRemaining)} chưa chia — sẽ giữ ở Ví chính
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Summary & Confirm ═══ */}
      <div className="sfp-summary">
        {!isManualMode ? (
          <p className="sfp-remaining">
            💰 Còn lại trong ví: <strong>{formatVNDFull(Math.max(0, remaining))}</strong>
          </p>
        ) : (
          <p className="sfp-remaining">
            💰 Còn lại trong ví: <strong>{formatVNDFull(Math.max(0, manualRemaining))}</strong>
          </p>
        )}
      </div>

      <div className="sfp-actions">
        <button
          className="sfp-confirm-btn"
          onClick={handleConfirm}
          disabled={isConfirmDisabled}
        >
          Xác nhận chia {formatVNDFull(isManualMode ? Math.min(manualTotal, totalAmount) : totalAmount - Math.max(0, remaining))}
        </button>
        <button className="sfp-cancel-btn" onClick={onCancel}>
          Để sau
        </button>
      </div>
    </div>
  );
}
