/* ═══ Ledger Content — Dual-Tab: Daily Expenses | Fixed Bills ═══ */
'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/utils/formatCurrency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/data/categories';
import { useFinanceStore } from '@/stores/useFinanceStore';
import TabSwitcher from '@/components/ui/TabSwitcher';
import CalendarModal from '@/components/ui/CalendarModal';
import '@/components/ui/CalendarModal.css';
import FixedBillsPanel from '@/components/ui/FixedBillsPanel';
import BudgetSettingsModal from './BudgetSettingsModal';
import './ledger.css';

type FilterType = 'all' | 'income' | 'expense';
type LedgerTab = 'daily' | 'bills';

const LEDGER_TABS = [
  { key: 'daily', label: 'Chi tiêu', icon: '💸' },
  { key: 'bills', label: 'Bill cố định', icon: '📋' },
];

export default function LedgerContent() {
  const [activeTab, setActiveTab] = useState<LedgerTab>('daily');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);

  const transactions = useFinanceStore((s) => s.transactions);
  const totalIncome = useFinanceStore((s) => s.getTotalIncome());
  const totalExpense = useFinanceStore((s) => s.getTotalExpense());

  const allCategories = useMemo(() => [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES], []);
  const getCategory = (id: string) => allCategories.find((c) => c.id === id);

  const filtered = useMemo(() => {
    let txns = transactions;
    if (selectedDateKey) txns = txns.filter((t) => t.dateKey === selectedDateKey);
    if (filter === 'all') return txns;
    return txns.filter((t) => t.type === filter);
  }, [transactions, filter, selectedDateKey]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, typeof filtered>>((acc, t) => {
      if (!acc[t.dateLabel]) acc[t.dateLabel] = [];
      acc[t.dateLabel].push(t);
      return acc;
    }, {});
  }, [filtered]);

  const handleCalendarSelectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setShowCalendar(false);
  };

  const clearDateFilter = () => setSelectedDateKey(null);

  const selectedDateLabel = selectedDateKey
    ? new Date(selectedDateKey).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <div className="stack stack-sm">
      {/* Header with Calendar button */}
      <div className="ledger-top-row">
        <h1 className="heading-md">📒 Sổ sách</h1>
        {activeTab === 'daily' && (
          <button className="ledger-calendar-btn" onClick={() => setShowCalendar(true)} id="ledger-calendar-btn">
            📅 Lịch
          </button>
        )}
      </div>

      {/* Summary cards — show on both tabs */}
      <div className="ledger-summary">
        <div className="ledger-summary-card income">
          <p className="ledger-summary-label">Thu nhập</p>
          <p className="ledger-summary-amount" style={{ color: 'var(--c-success)' }}>
            +{formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="ledger-summary-card expense">
          <p className="ledger-summary-label">Chi tiêu</p>
          <p className="ledger-summary-amount" style={{ color: 'var(--c-orange)' }}>
            -{formatCurrency(totalExpense)}
          </p>
        </div>
      </div>

      {/* Dual Tab Switcher */}
      <TabSwitcher
        tabs={LEDGER_TABS}
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as LedgerTab)}
      />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'daily' ? (
          <motion.div
            key="daily"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Date filter badge */}
            {selectedDateKey && (
              <div className="ledger-date-badge">
                <span>📅 Xem ngày: {selectedDateLabel}</span>
                <button className="ledger-date-clear" onClick={clearDateFilter}>✕ Xóa lọc</button>
              </div>
            )}

            {/* Filter tabs + Budget settings button */}
            <div className="ledger-filter-row">
              <div className="ledger-filter-tabs">
                {([
                  { key: 'all' as const, label: 'Tất cả' },
                  { key: 'income' as const, label: '💰 Thu' },
                  { key: 'expense' as const, label: '💸 Chi' },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    className={`ledger-filter-tab ${filter === tab.key ? 'active' : ''}`}
                    onClick={() => setFilter(tab.key)}
                    id={`ledger-filter-${tab.key}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                className="ledger-budget-btn"
                onClick={() => setShowBudgetSettings(true)}
                id="ledger-budget-settings-btn"
                title="Cài đặt ngưỡng chi tiêu"
              >
                ⚙️ Ngưỡng
              </button>
            </div>

            {/* Transaction list grouped by date */}
            {Object.entries(grouped).length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                <p style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📝</p>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {selectedDateKey ? 'Không có giao dịch ngày này' : 'Chưa có giao dịch'}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)', marginTop: 4 }}>
                  {selectedDateKey ? 'Chọn ngày khác trên lịch' : 'Bấm nút + để nhập liệu'}
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([dateLabel, txns]) => {
                const dayTotal = txns.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
                return (
                  <div key={dateLabel} className="ledger-day-group">
                    <div className="ledger-day-header">
                      <span className="ledger-day-date">{dateLabel}</span>
                      <span className="ledger-day-total" style={{ color: dayTotal >= 0 ? 'var(--c-success)' : 'var(--c-orange)' }}>
                        {dayTotal >= 0 ? '+' : ''}{formatCurrency(dayTotal)}
                      </span>
                    </div>
                    <div className="ledger-txn-list">
                      {txns.map((txn) => {
                        const cat = getCategory(txn.categoryId);
                        return (
                          <div key={txn.id} className="ledger-txn-item" id={`txn-${txn.id}`}>
                            <div className="ledger-txn-icon" style={{ background: `${cat?.color || '#6B7280'}15` }}>
                              {cat?.icon || '📦'}
                            </div>
                            <div className="ledger-txn-info">
                              <p className="ledger-txn-category">{cat?.name || 'Khác'}</p>
                              <p className="ledger-txn-note">{txn.note}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p className="ledger-txn-amount" style={{ color: txn.type === 'income' ? 'var(--c-success)' : 'var(--c-orange)' }}>
                                {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                              </p>
                              <p className="ledger-txn-time">{txn.time}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        ) : (
          <motion.div
            key="bills"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <FixedBillsPanel />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Modal */}
      <CalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectDate={handleCalendarSelectDate}
      />

      {/* Budget Settings Modal */}
      <BudgetSettingsModal
        isOpen={showBudgetSettings}
        onClose={() => setShowBudgetSettings(false)}
      />
    </div>
  );
}
