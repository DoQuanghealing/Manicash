/* ═══ FinancialGrid — 6-Account Glassmorphism Grid ═══ */
'use client';

import { motion } from 'framer-motion';
import {
  Wallet,
  ShoppingBag,
  CreditCard,
  Lock,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useDashboardStore, type DashboardAccounts } from '@/stores/useDashboardStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './FinancialGrid.css';

interface AccountCardConfig {
  key: keyof DashboardAccounts;
  label: string;
  Icon: LucideIcon;
  accentColor: string;
  glowColor: string;
}

const ACCOUNT_CARDS: AccountCardConfig[] = [
  { key: 'income',      label: 'Thu nhập',    Icon: Wallet,      accentColor: '#10B981', glowColor: 'rgba(16,185,129,0.25)' },
  { key: 'spending',    label: 'Chi tiêu',    Icon: ShoppingBag,  accentColor: '#F59E0B', glowColor: 'rgba(245,158,11,0.25)' },
  { key: 'fixed_bills', label: 'Hoá đơn',     Icon: CreditCard,   accentColor: '#8B5CF6', glowColor: 'rgba(139,92,246,0.25)' },
  { key: 'reserve',     label: 'Dự phòng',    Icon: Lock,         accentColor: '#6366F1', glowColor: 'rgba(99,102,241,0.25)' },
  { key: 'goals',       label: 'Mục tiêu',    Icon: Target,       accentColor: '#EC4899', glowColor: 'rgba(236,72,153,0.25)' },
  { key: 'investment',  label: 'Đầu tư',      Icon: TrendingUp,   accentColor: '#14B8A6', glowColor: 'rgba(20,184,166,0.25)' },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function FinancialGrid() {
  const accounts = useDashboardStore((s) => s.accounts);
  const isOverLimit = useDashboardStore((s) => s.isSpendingOverLimit());

  return (
    <motion.div
      className="fin-grid"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {ACCOUNT_CARDS.map((card) => (
        <AccountCard
          key={card.key}
          config={card}
          accounts={accounts}
          isOverLimit={isOverLimit}
        />
      ))}
    </motion.div>
  );
}

function AccountCard({
  config,
  accounts,
  isOverLimit,
}: {
  config: AccountCardConfig;
  accounts: DashboardAccounts;
  isOverLimit: boolean;
}) {
  const { key, label, Icon, accentColor, glowColor } = config;
  const account = accounts[key];
  const isSpending = key === 'spending';
  const isOverBudget = isSpending && isOverLimit;

  // Spending-specific data
  const spendingProgress = isSpending
    ? Math.min(100, (account.balance / (accounts.spending as { limit: number }).limit) * 100)
    : 0;

  // Goals progress
  const isGoals = key === 'goals';
  const goalsProgress = isGoals
    ? Math.min(100, (account.balance / (accounts.goals as { target: number }).target) * 100)
    : 0;

  // Investment growth
  const isInvestment = key === 'investment';

  // Fixed bills pending
  const isFixedBills = key === 'fixed_bills';

  // Reserve locked
  const isReserve = key === 'reserve';

  return (
    <motion.div
      className={`fin-card ${isOverBudget ? 'fin-card--danger fin-card--shake' : ''}`}
      variants={cardVariants}
      style={{
        '--card-accent': accentColor,
        '--card-glow': glowColor,
      } as React.CSSProperties}
    >
      {/* Icon + Label row */}
      <div className="fin-card-header">
        <div className="fin-card-icon-wrap" style={{ background: glowColor }}>
          <Icon size={16} color={accentColor} strokeWidth={2.2} />
        </div>
        <span className="fin-card-label">{label}</span>

        {/* Status badges */}
        {isReserve && (accounts.reserve as { is_locked: boolean }).is_locked && (
          <span className="fin-card-badge fin-card-badge--locked">🔒</span>
        )}
        {isInvestment && (
          <span className="fin-card-badge fin-card-badge--growth">
            {(accounts.investment as { growth: string }).growth}
          </span>
        )}
        {isFixedBills && (
          <span className="fin-card-badge fin-card-badge--pending">
            {(accounts.fixed_bills as { pending_count: number }).pending_count} chờ
          </span>
        )}
      </div>

      {/* Balance */}
      <p className={`fin-card-balance ${isOverBudget ? 'fin-card-balance--danger' : ''}`}>
        {formatCurrency(account.balance)}
      </p>

      {/* Spending progress bar */}
      {isSpending && (
        <div className="fin-card-progress-wrap">
          <div className="fin-card-progress-bar">
            <div
              className={`fin-card-progress-fill ${isOverBudget ? 'fin-card-progress-fill--danger' : ''}`}
              style={{ width: `${Math.min(spendingProgress, 100)}%` }}
            />
          </div>
          <span className={`fin-card-progress-text ${isOverBudget ? 'fin-card-progress-text--danger' : ''}`}>
            {formatCurrencyShort(account.balance)} / {formatCurrencyShort((accounts.spending as { limit: number }).limit)}
          </span>
        </div>
      )}

      {/* Goals progress */}
      {isGoals && (
        <div className="fin-card-progress-wrap">
          <div className="fin-card-progress-bar">
            <div
              className="fin-card-progress-fill fin-card-progress-fill--goals"
              style={{ width: `${goalsProgress}%` }}
            />
          </div>
          <span className="fin-card-progress-text">
            {goalsProgress.toFixed(1)}% mục tiêu
          </span>
        </div>
      )}
    </motion.div>
  );
}
