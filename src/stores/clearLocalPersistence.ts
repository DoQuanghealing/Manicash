/* ═══ Clear Local Money Persistence (Phase 6B-1.5) ═══
 * Dùng cho LOGOUT / RESET / local debug. Xóa toàn bộ dữ liệu tài chính local để
 * user kế tiếp trên cùng browser KHÔNG thấy data của user trước (account boundary).
 *
 * KHÔNG tự gọi Firebase signOut (chỉ local clear). KHÔNG xóa app settings không liên quan.
 * KHÔNG namespace theo UID ở phase này (để Phase 6B-2).
 */
'use client';

import { STORE_KEYS } from '@/stores/persistConfig';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useWalletBankStore, DEFAULT_WALLETS } from '@/stores/useWalletBankStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import { useChatHistoryStore, CHAT_HISTORY_STORAGE_KEY } from '@/stores/useChatHistoryStore';
import { useTransactionHabitStore, TRANSACTION_HABIT_STORAGE_KEY } from '@/stores/useTransactionHabitStore';
import { useCapacitySurveyStore, CAPACITY_SURVEY_STORAGE_KEY } from '@/stores/useCapacitySurveyStore';
import { useCoachSuggestionStore, COACH_SUGGESTION_STORAGE_KEY } from '@/stores/useCoachSuggestionStore';
import { useCareStore, CARE_STORAGE_KEY } from '@/stores/useCareStore';
import { useSovereignMigrationStore, SOVEREIGN_MIGRATION_STORAGE_KEY } from '@/stores/useSovereignMigrationStore';
import { useFinancialDnaStore, FINANCIAL_DNA_STORAGE_KEY } from '@/stores/useFinancialDnaStore';
import { useHydrationStore } from '@/stores/useHydrationStore';
import { getCurrentMonthKey } from '@/lib/dateHelpers';
import { resetMoneySyncRuntime } from '@/lib/moneySync/clientRuntime';
import { stopProductionSync } from '@/lib/moneySync/syncController';
import { clearAllSyncCursors } from '@/lib/moneySync/outboxPersistence';

export function clearLocalMoneyPersistence(): void {
  // 0) Dừng money sync runtime + production sync + xóa outbox/metadata/cursor
  //    TRƯỚC khi reset store — để (a) không enqueue nhiễu khi reset state,
  //    (b) outbox/cursor user cũ không leak sang user kế tiếp.
  stopProductionSync();
  resetMoneySyncRuntime();
  clearAllSyncCursors();

  // 1) Reset in-memory về EMPTY (KHÔNG seed) — bảo vệ phiên hiện tại.
  useFinanceStore.setState({
    transactions: [],
    mainBalance: 0,
    emergencyBalance: 0,
    billFundBalance: 0,
    fixedBills: [],
    billSnapshots: [],
  });
  useBudgetStore.setState({
    carryOver: 0,
    currentMonth: getCurrentMonthKey(),
    categoryBudgets: [],
    rolloverNotified: false,
    flaggedCategories: [],
    flaggedTransactionIds: [],
    monthlySnapshots: [],
    unviewedReportMonth: null,
    xpAtMonthStart: 0,
  });
  useGoalsStore.setState({ goals: [] });
  // Dashboard giờ đã persist → phải reset in-memory để user kế tiếp cùng browser
  // KHÔNG thấy quỹ tiết kiệm của user trước (persisted key được xóa ở bước 2).
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
  // WalletBank giờ đã persist → reset tên/số tài khoản ngân hàng (dữ liệu nhạy cảm)
  // về mặc định để không lộ sang user kế tiếp cùng browser.
  useWalletBankStore.setState({ wallets: DEFAULT_WALLETS });
  useTaskStore.setState({ tasks: [], xpPenalties: [] });
  useAuthStore.setState({ user: null });
  useActionAuditStore.setState({ records: [] });
  // Phase I: xóa lịch sử chat (chống rò rỉ hội thoại sang user kế tiếp cùng browser).
  useChatHistoryStore.getState().clearAll();
  // P3: xóa trí nhớ giao dịch lặp lại (account boundary).
  useTransactionHabitStore.getState().clearAll();
  // P6a: xóa khảo sát năng lực (account boundary).
  useCapacitySurveyStore.getState().clearAll();
  // PV-2: xóa đề xuất chủ động đã bỏ qua (account boundary).
  useCoachSuggestionStore.getState().clearAll();
  // T4 Care: xóa lịch sử kịch bản chăm sóc đã xử lý (account boundary).
  useCareStore.getState().clearAll();
  // PV-5: xóa mốc báo trước migration (user kế tiếp đếm lại từ đầu).
  useSovereignMigrationStore.getState().clearAll();
  // PV-3: xóa Financial DNA (persona + báo cáo — dữ liệu nhạy cảm, account boundary).
  useFinancialDnaStore.getState().clearAll();

  // 2) Xóa hẳn persisted keys (sau reset để bản ghi cuối của persist là rỗng,
  //    rồi removeItem -> localStorage sạch hẳn; lần mở app sau seed lại theo design).
  if (typeof localStorage !== 'undefined') {
    for (const key of Object.values(STORE_KEYS)) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    localStorage.removeItem(TRANSACTION_HABIT_STORAGE_KEY);
    localStorage.removeItem(CAPACITY_SURVEY_STORAGE_KEY);
    localStorage.removeItem(COACH_SUGGESTION_STORAGE_KEY);
    localStorage.removeItem(CARE_STORAGE_KEY);
    localStorage.removeItem(SOVEREIGN_MIGRATION_STORAGE_KEY);
    localStorage.removeItem(FINANCIAL_DNA_STORAGE_KEY);
  }

  // 3) Stores coi như đã "hydrate" (state rỗng đã ổn định) — marker không treo.
  useHydrationStore.setState({ finance: true, budget: true, goals: true, tasks: true, auth: true });
}
