/* ═══ TransactionInput — Income/Expense/Transfer + Store + Celebration ═══ */
'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { INCOME_CATEGORIES, type CategoryItem } from '@/data/categories';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { getButlerMessage } from '@/data/butlerMessages';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAudio } from '@/hooks/useAudio';
import { useFinanceStore, type TxnType, type WalletType } from '@/stores/useFinanceStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { calculateXP } from '@/lib/xpEngine';
import type { SplitResult } from '@/stores/useDashboardStore';
import BreathGate from './BreathGate';
import CelebrationModal from './CelebrationModal';
import BillFundReminder from './BillFundReminder';
import SplitSuccessPopup from './SplitSuccessPopup';
import './TransactionInput.css';

const BREATHGATE_THRESHOLD = 3_000_000;

export default function TransactionInput() {
  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [note, setNote] = useState('');
  const [wallet, setWallet] = useState<WalletType>('main');
  const [showBreathGate, setShowBreathGate] = useState(false);
  const [butlerComment, setButlerComment] = useState<string | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBillReminder, setShowBillReminder] = useState(false);
  const [lastIncomeAmount, setLastIncomeAmount] = useState(0);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [celebrationData, setCelebrationData] = useState({
    type: 'expense' as TxnType,
    amount: 0,
    categoryName: '',
    xpEarned: 0,
  });

  const { play } = useAudio();
  const router = useRouter();
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const butlerName = useSettingsStore((s) => s.butlerName);

  const expenseCategories = useCategoryStore((s) => s.expenseCategories);

  const categories: CategoryItem[] = useMemo(() => {
    return type === 'income' ? INCOME_CATEGORIES : expenseCategories;
  }, [type, expenseCategories]);

  const numericAmount = parseInt(amount.replace(/\D/g, ''), 10) || 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length <= 12) {
      setAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
    }
  };

  const processTransaction = useCallback(() => {
    // 1. Save to Finance Store → updates balances + Ledger auto-renders
    const txn = addTransaction({
      type,
      amount: numericAmount,
      categoryId: selectedCategory || 'other',
      note: note || categories.find((c) => c.id === selectedCategory)?.name || '',
      wallet,
    });

    // 2. Calculate XP — calculateXP cho hiển thị ngay trong CelebrationModal.
    //    Đồng thời awardXP để persist vào userProfile + emit toast.
    const xpAction = type === 'income'
      ? { type: 'INCOME_LOGGED' as const, earnedAmount: numericAmount }
      : { type: 'EXPENSE_LOGGED' as const };
    const xpEarned = calculateXP(xpAction);
    useAuthStore.getState().awardXP(xpAction);

    // 3. Get category name for celebration
    const catName = categories.find((c) => c.id === selectedCategory)?.name || 'Giao dịch';

    // 4. Show Celebration Modal with confetti + audio
    setCelebrationData({ type, amount: numericAmount, categoryName: catName, xpEarned });
    setShowCelebration(true);

    // 5. Show butler sarcastic comment for expenses
    if (type === 'expense') {
      const msg = getButlerMessage('expense_small', butlerName);
      setButlerComment(msg.text);
    }

    // 6. Reset form
    setAmount('');
    setSelectedCategory('');
    setNote('');
  }, [type, numericAmount, selectedCategory, note, wallet, addTransaction, categories, butlerName]);

  const handleSubmit = useCallback(() => {
    if (!numericAmount || (type !== 'transfer' && !selectedCategory)) return;

    // BreathGate for large expenses
    if (type === 'expense' && numericAmount >= BREATHGATE_THRESHOLD) {
      setShowBreathGate(true);
      return;
    }

    processTransaction();
  }, [numericAmount, selectedCategory, type, processTransaction]);

  const handleBreathGateConfirm = useCallback(() => {
    setShowBreathGate(false);
    processTransaction();
  }, [processTransaction]);

  const isValid = numericAmount > 0 && (type === 'transfer' || selectedCategory);

  return (
    <div className="txn-input-page">
      {/* Type Tabs */}
      <div className="txn-type-tabs">
        {([
          { key: 'income' as const, label: '💰 Thu nhập' },
          { key: 'expense' as const, label: '💸 Chi tiêu' },
          { key: 'transfer' as const, label: '🔄 Chuyển' },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`txn-type-tab ${type === tab.key ? `active-${tab.key}` : ''}`}
            onClick={() => {
              setType(tab.key);
              setSelectedCategory('');
              setButlerComment(null);
            }}
            id={`txn-tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Wallet Selector */}
      <div className="txn-wallet-selector">
        <button
          className={`txn-wallet-btn ${wallet === 'main' ? 'active' : ''}`}
          onClick={() => setWallet('main')}
          id="txn-wallet-main"
        >
          💳 Ví chính
        </button>
        <button
          className={`txn-wallet-btn ${wallet === 'emergency' ? 'active' : ''}`}
          onClick={() => setWallet('emergency')}
          id="txn-wallet-emergency"
        >
          🛡️ Quỹ dự phòng
        </button>
      </div>

      {/* Amount */}
      <div className="txn-amount-section">
        <p className="txn-amount-label">Số tiền</p>
        <div className="txn-amount-input-wrapper">
          <input
            className="txn-amount-input"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={handleAmountChange}
            autoFocus
            id="txn-amount"
          />
          <span className="txn-amount-currency">đ</span>
        </div>
        <div
          className="txn-amount-underline"
          style={{
            background:
              type === 'income'
                ? 'var(--gradient-success)'
                : type === 'expense'
                  ? 'linear-gradient(90deg, #F97316, #EA580C)'
                  : 'var(--gradient-primary)',
          }}
        />
      </div>

      {/* Category Grid */}
      {type !== 'transfer' && (
        <div className="txn-category-section">
          <p className="txn-section-title">Danh mục</p>
          <div className="txn-category-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`txn-category-item ${selectedCategory === cat.id ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
                id={`txn-cat-${cat.id}`}
              >
                <span className="txn-category-icon">{cat.icon}</span>
                <span className="txn-category-name">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <input
        className="txn-note-input"
        type="text"
        placeholder="Ghi chú (tùy chọn)..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        id="txn-note"
      />

      {/* Submit */}
      <button
        className={`txn-submit-btn txn-submit-${type}`}
        onClick={handleSubmit}
        disabled={!isValid}
        id="txn-submit"
      >
        {type === 'income' && '💰 Ghi thu nhập'}
        {type === 'expense' && '💸 Ghi chi tiêu'}
        {type === 'transfer' && '🔄 Chuyển tiền'}
      </button>

      {/* Butler Comment */}
      <AnimatePresence>
        {butlerComment && (
          <motion.div
            className="txn-butler-comment"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span>🎩</span>
            <p className="txn-butler-comment-text">{butlerComment}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BreathGate Modal */}
      <BreathGate
        amount={numericAmount}
        isOpen={showBreathGate}
        onConfirm={handleBreathGateConfirm}
        onCancel={() => {
          // Cancel TRƯỚC khi timer xong — chỉ dismiss, KHÔNG grant XP.
          setShowBreathGate(false);
        }}
        onResist={() => {
          // Cancel SAU khi timer xong — user đã chờ 30s suy nghĩ rồi quyết định không mua.
          // RESIST_SPENDING XP: reward cho kỷ luật tài chính.
          useAuthStore.getState().awardXP({
            type: 'RESIST_SPENDING',
            savedAmount: numericAmount,
          });
          setShowBreathGate(false);
        }}
      />

      {/* Celebration Modal — Dopamine popup */}
      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => {
          setShowCelebration(false);
          setButlerComment(null);
          // If income, show bill fund reminder before navigating
          if (celebrationData.type === 'income') {
            setLastIncomeAmount(celebrationData.amount);
            setShowBillReminder(true);
          } else {
            router.push('/ledger');
          }
        }}
        type={celebrationData.type}
        amount={celebrationData.amount}
        categoryName={celebrationData.categoryName}
        xpEarned={celebrationData.xpEarned}
      />

      {/* Bill Fund Reminder — Galaxy popup after income */}
      <BillFundReminder
        isOpen={showBillReminder}
        onClose={() => {
          setShowBillReminder(false);
          router.push('/ledger');
        }}
        incomeAmount={lastIncomeAmount}
        onSplitComplete={(result) => {
          setSplitResult(result);
          setShowBillReminder(false);
        }}
      />

      {/* Split Success Popup */}
      <SplitSuccessPopup
        isOpen={!!splitResult}
        result={splitResult}
        onClose={() => {
          setSplitResult(null);
          router.push('/ledger');
        }}
      />
    </div>
  );
}
