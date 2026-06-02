/* ═══ wipeAllData — Reset financial + gamification state to zero ═══
 *
 * Triggered from Profile → "Xóa toàn bộ dữ liệu". Keeps user identity
 * (uid/displayName/email/photoURL/yearOfBirth) so re-login is not required,
 * but resets every numeric/transaction artifact so the app is in a fresh
 * starter state.
 *
 * Caller is responsible for showing a confirmation prompt first. This is
 * destructive and not reversible.
 */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useAiMoneyMemoryStore } from '@/stores/useAiMoneyMemoryStore';
import { useBankSyncStore } from '@/stores/useBankSyncStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFinanceCoreStore } from '@/stores/useFinanceCoreStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useMissionStore } from '@/stores/useMissionStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useWishlistStore } from '@/stores/useWishlistStore';

/** Result returned for the UI to log/display. */
export interface WipeReport {
  resetAt: string;
  storesReset: string[];
}

export function wipeAllData(): WipeReport {
  const resetAt = new Date().toISOString();
  const storesReset: string[] = [];

  // ── Finance (legacy 3-wallet) ──
  useFinanceStore.setState((state) => ({
    transactions: [],
    mainBalance: 0,
    emergencyBalance: 0,
    billFundBalance: 0,
    fixedBills: state.fixedBills.map((b) => ({ ...b, isPaid: false })),
    billSnapshots: [],
  }));
  storesReset.push('useFinanceStore');

  // ── Finance Core (ledger engine) ──
  useFinanceCoreStore.getState().clear();
  storesReset.push('useFinanceCoreStore');

  // ── Budget (carry-over + categories + snapshots) ──
  useBudgetStore.setState((state) => ({
    carryOver: 0,
    categoryBudgets: state.categoryBudgets.map((b) => ({ ...b, spent: 0 })),
    monthlySnapshots: [],
    unviewedReportMonth: null,
    xpAtMonthStart: 0,
    rolloverNotified: false,
  }));
  storesReset.push('useBudgetStore');

  // ── Dashboard (6-account intelligence) ──
  useDashboardStore.setState({
    accounts: {
      income: { balance: 0, icon: 'Wallet' },
      spending: { balance: 0, limit: 0, icon: 'ShoppingBag' },
      fixed_bills: { balance: 0, pending_count: 0, icon: 'CreditCard' },
      reserve: { balance: 0, is_locked: true, icon: 'Lock' },
      goals: { balance: 0, target: 0, icon: 'Target' },
      investment: { balance: 0, growth: '0%', icon: 'TrendingUp' },
    },
    monthlyContributions: { reserve: [], goals: [], investment: [] },
  });
  storesReset.push('useDashboardStore');

  // ── Goals (long-term targets) ──
  useGoalsStore.setState({ goals: [] });
  storesReset.push('useGoalsStore');

  // ── Tasks (earning gigs) ──
  useTaskStore.setState({ tasks: [], xpPenalties: [] });
  storesReset.push('useTaskStore');

  // ── Missions (onboarding tutorials) ──
  useMissionStore.setState({ completedMissionIds: [] });
  storesReset.push('useMissionStore');

  // ── Wishlist (cooling-off items) ──
  useWishlistStore.setState({ items: [] });
  storesReset.push('useWishlistStore');

  // ── Bank sync timestamps ──
  useBankSyncStore.setState({ lastSyncedAt: null, snoozedUntil: null });
  storesReset.push('useBankSyncStore');

  // ── AI Money Chat local memory ──
  useAiMoneyMemoryStore.getState().clearMemory();
  storesReset.push('useAiMoneyMemoryStore');

  // ── Auth: KEEP identity, RESET gamification stats ──
  const auth = useAuthStore.getState();
  if (auth.user) {
    useAuthStore.setState({
      user: {
        ...auth.user,
        xp: 0,
        streak: 0,
        resistCount: 0,
        totalResistSaved: 0,
        rank: 'iron',
        lastActiveDate: new Date().toISOString().split('T')[0],
        updatedAt: resetAt,
      },
    });
    storesReset.push('useAuthStore(stats only)');
  }

  // ── Persisted localStorage (Zustand persist middleware) ──
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('manicash-bank-sync');
      window.localStorage.removeItem('manicash-ai-money-memory');
    } catch {
      /* localStorage quota / privacy mode — non-fatal */
    }
  }

  return { resetAt, storesReset };
}
