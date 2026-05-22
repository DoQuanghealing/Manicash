/* ═══ BankLinkModal — Liên kết tài khoản ngân hàng cho goal ═══
 *
 * Đề xuất riêng cho mục tiêu lớn (>100tr) — user nên có TK riêng để
 * không tiêu nhầm. App KHÔNG kết nối API ngân hàng — chỉ lưu info
 * như sticky note + số dư khai báo để user theo dõi.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Landmark, Info } from 'lucide-react';
import type { Goal } from '@/types/budget';
import { useGoalsStore } from '@/stores/useGoalsStore';
import './BankLinkModal.css';

interface Props {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_BANKS = [
  'Vietcombank', 'Techcombank', 'ACB', 'BIDV', 'MBBank',
  'TPBank', 'VPBank', 'Sacombank', 'VietinBank', 'VIB',
];

export default function BankLinkModal({ goal, isOpen, onClose }: Props) {
  const linkBank = useGoalsStore((s) => s.linkBankAccount);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [declaredBalance, setDeclaredBalance] = useState('');

  // Reset khi mở — defer setState ra ngoài effect body
  const lastOpenedGoalRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !goal) {
      lastOpenedGoalRef.current = null;
      return;
    }
    // Chỉ reset khi vừa mở (goal mới)
    if (lastOpenedGoalRef.current === goal.id) return;
    lastOpenedGoalRef.current = goal.id;
    queueMicrotask(() => {
      setBankName(goal.bankInfo?.bankName || '');
      setAccountNumber(goal.bankInfo?.accountNumber || '');
      setAccountHolder(goal.bankInfo?.accountHolder || '');
      setDeclaredBalance(
        goal.bankInfo?.declaredBalance != null
          ? String(goal.bankInfo.declaredBalance)
          : String(goal.currentAmount || 0)
      );
    });
  }, [isOpen, goal]);

  if (!goal) return null;

  const accountDigitsOnly = accountNumber.replace(/\D/g, '');
  const balanceNum = parseInt(declaredBalance.replace(/\D/g, ''), 10) || 0;
  const canSave =
    bankName.trim().length > 0 &&
    accountDigitsOnly.length >= 6 &&
    balanceNum > 0;

  const handleSave = () => {
    if (!canSave) return;
    linkBank(goal.id, {
      bankName: bankName.trim(),
      accountNumber: accountDigitsOnly,
      accountHolder: accountHolder.trim() || undefined,
      declaredBalance: balanceNum,
    });
    onClose();
  };

  const formatBalance = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('vi-VN');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="blm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="blm-panel"
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="blm-close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>

            <header className="blm-header">
              <div className="blm-header-icon">
                <Landmark size={22} />
              </div>
              <h2 className="blm-title">Liên kết tài khoản ngân hàng</h2>
              <p className="blm-sub">
                Cho mục tiêu <strong>{goal.name}</strong>
              </p>
            </header>

            <div className="blm-info">
              <Info size={13} />
              <span>
                App chỉ lưu thông tin như sticky note — KHÔNG kết nối API ngân
                hàng, KHÔNG tự động đồng bộ số dư. Bạn tự cập nhật khi cần.
              </span>
            </div>

            <section className="blm-field">
              <label className="blm-label">Tên ngân hàng</label>
              <input
                className="blm-input"
                placeholder="VD: Vietcombank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                list="bank-suggestions"
                maxLength={40}
              />
              <datalist id="bank-suggestions">
                {POPULAR_BANKS.map((b) => <option key={b} value={b} />)}
              </datalist>
              <div className="blm-quick-banks">
                {POPULAR_BANKS.slice(0, 6).map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`blm-quick-bank ${bankName === b ? 'blm-quick-bank--active' : ''}`}
                    onClick={() => setBankName(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </section>

            <section className="blm-field">
              <label className="blm-label">Số tài khoản</label>
              <input
                className="blm-input blm-input--mono"
                placeholder="VD: 0123456789"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                inputMode="numeric"
                maxLength={20}
              />
            </section>

            <section className="blm-field">
              <label className="blm-label">Chủ tài khoản (tùy chọn)</label>
              <input
                className="blm-input"
                placeholder="Tên trên thẻ"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                maxLength={60}
              />
            </section>

            <section className="blm-field">
              <label className="blm-label">Số tiền hiện có trong TK</label>
              <div className="blm-amount-wrap">
                <input
                  className="blm-amount-input"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatBalance(declaredBalance)}
                  onChange={(e) => setDeclaredBalance(e.target.value)}
                />
                <span className="blm-currency">đ</span>
              </div>
              <p className="blm-hint">
                Đây sẽ là số dư hiển thị trong nguồn &ldquo;Ngân hàng&rdquo; khi nạp tiền.
              </p>
            </section>

            <div className="blm-actions">
              <button className="blm-cancel" onClick={onClose}>
                Để sau
              </button>
              <button
                className="blm-save"
                onClick={handleSave}
                disabled={!canSave}
              >
                Liên kết
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
