/* ═══ GoalDepositModal — Nạp tiền vào mục tiêu ═══
 *
 * Cho user chọn nguồn nạp:
 *   - Tài khoản chính (main)
 *   - Quỹ dự phòng (reserve)
 *   - Quỹ mục tiêu chung (goals-fund) — chia từ overview
 *   - Tài khoản ngân hàng linked (bank) — nếu goal có bankInfo
 *   - Manual (cash, gift…) — luôn cho phép
 *
 * Hiển thị số dư từng nguồn để user dễ chọn.
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Landmark, Wallet, ShieldCheck, Target, Coins } from 'lucide-react';
import type { Goal, GoalDepositSource } from '@/types/budget';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useConfetti } from '@/hooks/useConfetti';
import { formatCurrency } from '@/utils/formatCurrency';
import './GoalDepositModal.css';

interface Props {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
}

interface SourceOption {
  id: GoalDepositSource;
  label: string;
  sublabel: string;
  balance: number;
  icon: React.ReactNode;
  /** Disable nếu balance = 0 (trừ manual + bank). */
  alwaysEnabled?: boolean;
}

export default function GoalDepositModal({ goal, isOpen, onClose }: Props) {
  const { fireConfetti } = useConfetti();
  const addFundsToGoal = useGoalsStore((s) => s.addFundsToGoal);
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const emergencyBalance = useFinanceStore((s) => s.emergencyBalance);
  const dashboard = useDashboardStore((s) => s.accounts);

  const [source, setSource] = useState<GoalDepositSource>('main');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  if (!goal) return null;

  const goalsFundBalance = dashboard?.goals?.balance ?? 0;

  const sources: SourceOption[] = [
    {
      id: 'main',
      label: 'Tài khoản chính',
      sublabel: 'Từ thu nhập có sẵn',
      balance: mainBalance,
      icon: <Wallet size={18} />,
    },
    {
      id: 'reserve',
      label: 'Quỹ dự phòng',
      sublabel: 'Rút từ tiết kiệm khẩn cấp',
      balance: emergencyBalance,
      icon: <ShieldCheck size={18} />,
    },
    {
      id: 'goals-fund',
      label: 'Quỹ mục tiêu chung',
      sublabel: 'Chia từ "Mục tiêu" ở Tổng quan',
      balance: goalsFundBalance,
      icon: <Target size={18} />,
    },
    ...(goal.bankInfo
      ? [{
          id: 'bank' as GoalDepositSource,
          label: `${goal.bankInfo.bankName} •••${goal.bankInfo.accountNumber.slice(-4)}`,
          sublabel: 'Tài khoản ngân hàng đã liên kết',
          balance: goal.bankInfo.declaredBalance,
          icon: <Landmark size={18} />,
          alwaysEnabled: true,
        }]
      : []),
    {
      id: 'manual',
      label: 'Tiền mặt / Khác',
      sublabel: 'Ghi thủ công (quà, tiền mặt…)',
      balance: 0,
      icon: <Coins size={18} />,
      alwaysEnabled: true,
    },
  ];

  const numericAmount = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  const selectedSource = sources.find((s) => s.id === source);
  const exceedsBalance =
    !selectedSource?.alwaysEnabled &&
    selectedSource &&
    numericAmount > selectedSource.balance;
  const canSubmit = numericAmount > 0 && !exceedsBalance;

  const handleSubmit = () => {
    if (!canSubmit) return;
    addFundsToGoal(goal.id, numericAmount, source, note.trim() || undefined);
    fireConfetti('mission');
    setAmount('');
    setNote('');
    onClose();
  };

  const formatInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('vi-VN');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="gdm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="gdm-panel"
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="gdm-close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>

            <header className="gdm-header">
              <div className="gdm-goal-icon" style={{ background: goal.color }}>
                <span>{goal.icon}</span>
              </div>
              <div>
                <p className="gdm-label">Nạp vào</p>
                <h2 className="gdm-title">{goal.name}</h2>
                <p className="gdm-current">
                  {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                </p>
              </div>
            </header>

            <section className="gdm-section">
              <p className="gdm-section-label">Chọn nguồn nạp</p>
              <div className="gdm-source-list">
                {sources.map((opt) => {
                  const isActive = opt.id === source;
                  const isDisabled = !opt.alwaysEnabled && opt.balance <= 0;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`gdm-source ${isActive ? 'gdm-source--active' : ''} ${isDisabled ? 'gdm-source--disabled' : ''}`}
                      onClick={() => !isDisabled && setSource(opt.id)}
                      disabled={isDisabled}
                    >
                      <div className="gdm-source-icon">{opt.icon}</div>
                      <div className="gdm-source-body">
                        <p className="gdm-source-label">{opt.label}</p>
                        <p className="gdm-source-sub">{opt.sublabel}</p>
                      </div>
                      <div className="gdm-source-balance">
                        {opt.alwaysEnabled ? (
                          <span className="gdm-source-balance-na">—</span>
                        ) : (
                          formatCurrency(opt.balance)
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="gdm-section">
              <p className="gdm-section-label">Số tiền</p>
              <div className="gdm-amount-wrap">
                <input
                  className="gdm-amount-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={formatInput(amount)}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="gdm-currency">đ</span>
              </div>
              {exceedsBalance && (
                <p className="gdm-error">
                  Vượt quá số dư nguồn ({formatCurrency(selectedSource?.balance || 0)})
                </p>
              )}
              <div className="gdm-quick-amounts">
                {[100_000, 500_000, 1_000_000, 5_000_000].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="gdm-quick-btn"
                    onClick={() => setAmount(String((numericAmount || 0) + q))}
                  >
                    +{q >= 1_000_000 ? `${q / 1_000_000}tr` : `${q / 1_000}k`}
                  </button>
                ))}
              </div>
            </section>

            <section className="gdm-section">
              <p className="gdm-section-label">Ghi chú (tùy chọn)</p>
              <input
                className="gdm-note-input"
                placeholder="VD: Lương tháng 5, quà sinh nhật…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={80}
              />
            </section>

            <button
              type="button"
              className="gdm-submit"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              <span>Nạp {numericAmount > 0 ? formatCurrency(numericAmount) : ''}</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
