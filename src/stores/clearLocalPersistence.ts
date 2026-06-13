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
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import { useHydrationStore } from '@/stores/useHydrationStore';
import { getCurrentMonthKey } from '@/lib/dateHelpers';

export function clearLocalMoneyPersistence(): void {
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
  useTaskStore.setState({ tasks: [], xpPenalties: [] });
  useAuthStore.setState({ user: null });
  useActionAuditStore.setState({ records: [] });

  // 2) Xóa hẳn persisted keys (sau reset để bản ghi cuối của persist là rỗng,
  //    rồi removeItem -> localStorage sạch hẳn; lần mở app sau seed lại theo design).
  if (typeof localStorage !== 'undefined') {
    for (const key of Object.values(STORE_KEYS)) {
      localStorage.removeItem(key);
    }
  }

  // 3) Stores coi như đã "hydrate" (state rỗng đã ổn định) — marker không treo.
  useHydrationStore.setState({ finance: true, budget: true, goals: true, tasks: true, auth: true });
}
