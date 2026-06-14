/* ═══ AI Money Chat — Snapshot Builder (Phase 2 + 3, Hybrid) ═══
 * getFinanceSnapshot(uid, options):
 *   1) Có clientSnapshot hợp lệ  -> build từ client (real-time) + cập nhật cache.
 *   2) Không có & cache còn hạn   -> trả cache (<5ms).
 *   3) Còn lại                    -> fallback đọc Firestore song song (Promise.all).
 *
 * Phase 3 mở rộng MonthlyFinancialSnapshot: cashflow, budget/safeToSpend,
 * categories (top/overspent), anomalies (z-score so với 3 tháng trước),
 * goals at risk, health score (computeHealthScore).
 *
 * Cache in-memory Map, TTL 5 phút, key = `${uid}:${monthKey}`.
 */

import {
  BILL_FUND_ACCOUNT_ID,
  EMERGENCY_FUND_ACCOUNT_ID,
  MAIN_BANK_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import { getAccountBalance } from '@/core/finance/selectors';
import type { LedgerEntry } from '@/core/finance/types';
import { computeHealthScore, getHealthTier } from '@/lib/cfoHealthScore';
import { computeSafeToSpendValue } from '@/lib/moneyBrain/safeToSpend';
import type {
  ClientSnapshotInput,
  GetSnapshotOptions,
  MonthlyFinancialSnapshot,
  SnapshotAnomaly,
  SnapshotBill,
  SnapshotBudget,
  SnapshotCashflow,
  SnapshotCategory,
  SnapshotGoal,
  SnapshotHealth,
  SnapshotTask,
  SnapshotTaskStatus,
} from './types';

export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
const ANOMALY_Z_THRESHOLD = 2.0;
const TOP_CATEGORIES_LIMIT = 5;
const MONTHS_PACE_CAP = 999;

interface CacheEntry {
  at: number;
  snap: MonthlyFinancialSnapshot;
}

const CACHE = new Map<string, CacheEntry>();

/* ─────────────── Generic helpers ─────────────── */

function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonthOf(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value: unknown): number {
  return Math.max(0, toFiniteNumber(value));
}

function round(value: number): number {
  return Math.round(value);
}

function deriveBillStatus(isPaid: boolean, dueDay: number, dayOfMonth: number): SnapshotBill['status'] {
  if (isPaid) return 'paid';
  if (dueDay > 0 && dayOfMonth > dueDay) return 'overdue';
  return 'due';
}

function deriveTaskStatus(
  task: NonNullable<ClientSnapshotInput['tasks']>[number],
  monthKey: string,
  now: Date,
): SnapshotTaskStatus | null {
  if (task.deletedAt) return null;
  if (task.completedAt) {
    return task.completedAt.slice(0, 7) === monthKey ? 'completed' : null;
  }
  if (task.endDate) {
    const end = new Date(task.endDate);
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) return 'overdue';
  }
  if (task.startDate) {
    const start = new Date(task.startDate);
    if (!Number.isNaN(start.getTime()) && start.getTime() <= now.getTime()) return 'active';
  }
  return 'pending';
}

/* ─────────────── Validation ─────────────── */

export function validateClientSnapshot(raw: unknown): ClientSnapshotInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const hasWallets = r.wallets && typeof r.wallets === 'object';
  const hasBills = Array.isArray(r.bills);
  const hasTasks = Array.isArray(r.tasks);
  const hasTxns = Array.isArray(r.transactions);
  const hasBudgets = Array.isArray(r.budgets);
  const hasGoals = Array.isArray(r.goals);
  if (!hasWallets && !hasBills && !hasTasks && !hasTxns && !hasBudgets && !hasGoals) return null;

  const out: ClientSnapshotInput = {};

  if (typeof r.monthKey === 'string' && /^\d{4}-\d{2}$/.test(r.monthKey)) {
    out.monthKey = r.monthKey;
  }

  if (hasWallets) {
    const w = r.wallets as Record<string, unknown>;
    out.wallets = {
      main: nonNegative(w.main),
      emergency: nonNegative(w.emergency),
      billFund: nonNegative(w.billFund),
    };
  }

  if (hasBills) {
    out.bills = (r.bills as unknown[]).slice(0, 50).map((b) => {
      const bill = (b ?? {}) as Record<string, unknown>;
      return {
        id: typeof bill.id === 'string' ? bill.id : '',
        name: typeof bill.name === 'string' ? bill.name.slice(0, 60) : '',
        amount: nonNegative(bill.amount),
        dueDay: Math.min(31, Math.max(0, Math.floor(toFiniteNumber(bill.dueDay)))),
        isPaid: Boolean(bill.isPaid),
      };
    });
  }

  if (hasTasks) {
    out.tasks = (r.tasks as unknown[]).slice(0, 100).map((t) => {
      const task = (t ?? {}) as Record<string, unknown>;
      const subTasks = Array.isArray(task.subTasks)
        ? (task.subTasks as unknown[]).map((s) => ({
            isCompleted: Boolean((s as Record<string, unknown>)?.isCompleted),
          }))
        : [];
      return {
        id: typeof task.id === 'string' ? task.id : '',
        name: typeof task.name === 'string' ? task.name.slice(0, 80) : '',
        expectedAmount: nonNegative(task.expectedAmount),
        startDate: typeof task.startDate === 'string' ? task.startDate : undefined,
        endDate: typeof task.endDate === 'string' ? task.endDate : undefined,
        completedAt: typeof task.completedAt === 'string' ? task.completedAt : undefined,
        deletedAt: typeof task.deletedAt === 'string' ? task.deletedAt : undefined,
        subTasks,
      };
    });
  }

  if (hasTxns) {
    out.transactions = (r.transactions as unknown[]).slice(0, 1000).map((t) => {
      const txn = (t ?? {}) as Record<string, unknown>;
      return {
        type: typeof txn.type === 'string' ? txn.type : undefined,
        amount: nonNegative(txn.amount),
        categoryId: typeof txn.categoryId === 'string' ? txn.categoryId : undefined,
        toWallet: typeof txn.toWallet === 'string' ? txn.toWallet : undefined,
      };
    });
  }

  if (Array.isArray(r.history)) {
    out.history = (r.history as unknown[]).slice(0, 12).map((h) => {
      const entry = (h ?? {}) as Record<string, unknown>;
      const spendRaw = (entry.categorySpend ?? {}) as Record<string, unknown>;
      const categorySpend: Record<string, number> = {};
      for (const [k, v] of Object.entries(spendRaw)) categorySpend[k] = nonNegative(v);
      return {
        monthKey: typeof entry.monthKey === 'string' ? entry.monthKey : undefined,
        categorySpend,
      };
    });
  }

  if (hasBudgets) {
    out.budgets = (r.budgets as unknown[]).slice(0, 50).map((b) => {
      const budget = (b ?? {}) as Record<string, unknown>;
      return {
        categoryId: typeof budget.categoryId === 'string' ? budget.categoryId : '',
        name: typeof budget.name === 'string' ? budget.name.slice(0, 40) : '',
        limit: nonNegative(budget.limit),
      };
    });
  }

  if (hasGoals) {
    out.goals = (r.goals as unknown[]).slice(0, 30).map((g) => {
      const goal = (g ?? {}) as Record<string, unknown>;
      return {
        id: typeof goal.id === 'string' ? goal.id : '',
        name: typeof goal.name === 'string' ? goal.name.slice(0, 60) : '',
        targetAmount: nonNegative(goal.targetAmount),
        savedAmount: nonNegative(goal.savedAmount),
        deadline: typeof goal.deadline === 'string' ? goal.deadline : undefined,
        monthlyContribution:
          goal.monthlyContribution === undefined ? undefined : nonNegative(goal.monthlyContribution),
      };
    });
  }

  return out;
}

/* ─────────────── Section computations ─────────────── */

function computeCashflow(
  transactions: NonNullable<ClientSnapshotInput['transactions']>,
  dayOfMonth: number,
): { cashflow: SnapshotCashflow; spendByCategory: Map<string, number> } {
  let income = 0;
  let expense = 0;
  let savings = 0;
  const spendByCategory = new Map<string, number>();

  for (const t of transactions) {
    const amount = nonNegative(t.amount);
    if (t.type === 'income') {
      income += amount;
    } else if (t.type === 'expense') {
      expense += amount;
      const cat = t.categoryId || 'other';
      spendByCategory.set(cat, (spendByCategory.get(cat) ?? 0) + amount);
    } else if (t.type === 'transfer' && t.toWallet && t.toWallet !== 'main') {
      savings += amount;
    }
  }

  const net = income - expense;
  const savingsRate = income > 0 ? net / income : 0;
  const avgDailyExpense = dayOfMonth > 0 ? expense / dayOfMonth : expense;

  return {
    cashflow: {
      income: round(income),
      expense: round(expense),
      net: round(net),
      savings: round(savings),
      savingsRate: Number(savingsRate.toFixed(4)),
      avgDailyExpense: round(avgDailyExpense),
    },
    spendByCategory,
  };
}

function computeCategories(
  spendByCategory: Map<string, number>,
  budgets: NonNullable<ClientSnapshotInput['budgets']>,
): { topBySpend: SnapshotCategory[]; overspent: SnapshotCategory[] } {
  const budgetMap = new Map(budgets.map((b) => [b.categoryId || b.name || '', b]));

  const all: SnapshotCategory[] = Array.from(spendByCategory.entries()).map(([categoryId, spent]) => {
    const budget = budgetMap.get(categoryId);
    const limit = nonNegative(budget?.limit);
    return {
      categoryId,
      name: budget?.name || categoryId,
      spent: round(spent),
      limit: round(limit),
      overBy: round(Math.max(0, spent - limit)),
      percentOfLimit: limit > 0 ? Number((spent / limit).toFixed(2)) : 0,
    };
  });

  const topBySpend = [...all].sort((a, b) => b.spent - a.spent).slice(0, TOP_CATEGORIES_LIMIT);
  const overspent = [...all].filter((c) => c.overBy > 0).sort((a, b) => b.overBy - a.overBy);

  return { topBySpend, overspent };
}

/** Z-score = (current - mean_prev) / std_prev, dùng 3 tháng gần nhất trong history. */
function computeAnomalies(
  spendByCategory: Map<string, number>,
  history: NonNullable<ClientSnapshotInput['history']>,
  categoryNameOf: (id: string) => string,
): SnapshotAnomaly[] {
  const prev3 = history.slice(-3);
  if (prev3.length < 2) return []; // không đủ dữ liệu để tính std có nghĩa

  const anomalies: SnapshotAnomaly[] = [];

  for (const [categoryId, thisMonth] of spendByCategory.entries()) {
    const prevValues = prev3.map((h) => nonNegative(h.categorySpend?.[categoryId]));
    const n = prevValues.length;
    const mean = prevValues.reduce((s, v) => s + v, 0) / n;
    const variance = prevValues.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    if (std <= 0) continue; // không biến thiên -> bỏ qua (tránh chia 0)

    const zScore = (thisMonth - mean) / std;
    if (zScore > ANOMALY_Z_THRESHOLD) {
      anomalies.push({
        categoryId,
        name: categoryNameOf(categoryId),
        thisMonth: round(thisMonth),
        avgPrev: round(mean),
        zScore: Number(zScore.toFixed(2)),
      });
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

function computeGoals(
  goals: NonNullable<ClientSnapshotInput['goals']>,
  monthlySavingsProxy: number,
  now: Date,
): { items: SnapshotGoal[]; atRisk: SnapshotGoal[] } {
  const items: SnapshotGoal[] = goals.map((g) => {
    const target = nonNegative(g.targetAmount);
    const saved = nonNegative(g.savedAmount);
    const remaining = Math.max(0, target - saved);
    const pace = g.monthlyContribution !== undefined ? nonNegative(g.monthlyContribution) : Math.max(0, monthlySavingsProxy);

    let monthsToComplete: number;
    if (remaining <= 0) monthsToComplete = 0;
    else if (pace <= 0) monthsToComplete = MONTHS_PACE_CAP;
    else monthsToComplete = Math.min(MONTHS_PACE_CAP, Math.ceil(remaining / pace));

    let atRisk = false;
    if (remaining > 0 && g.deadline) {
      const deadlineTime = new Date(g.deadline).getTime();
      if (!Number.isNaN(deadlineTime)) {
        const monthsAvailable = (deadlineTime - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
        atRisk = pace <= 0 || monthsToComplete > monthsAvailable;
      }
    }

    return {
      id: g.id || g.name || 'goal',
      name: g.name || 'Mục tiêu',
      targetAmount: round(target),
      savedAmount: round(saved),
      percent: target > 0 ? Number((saved / target).toFixed(2)) : 0,
      deadline: g.deadline,
      monthsToCompleteAtPace: monthsToComplete,
      atRisk,
    };
  });

  return { items, atRisk: items.filter((g) => g.atRisk) };
}

function buildHealth(params: {
  income: number;
  expense: number;
  safeToSpend: number;
  emergencyBalance: number;
  categoriesTotal: number;
  categoriesOverBudget: number;
  billsDueByNow: number;
  billsPaidOfDue: number;
  dayOfMonth: number;
}): SnapshotHealth {
  const breakdown = computeHealthScore({
    monthlyIncome: params.income,
    monthlyExpense: params.expense,
    safeToSpend: params.safeToSpend,
    emergencyBalance: params.emergencyBalance,
    categoriesTotal: params.categoriesTotal,
    categoriesOverBudget: params.categoriesOverBudget,
    billsDueByNow: params.billsDueByNow,
    billsPaidOfDue: params.billsPaidOfDue,
    dayOfMonth: params.dayOfMonth,
  });

  return {
    score: breakdown.total,
    tier: getHealthTier(breakdown.total),
    breakdown: {
      savingsRate: breakdown.savingsRateScore,
      budgetAdherence: breakdown.budgetAdherenceScore,
      billsOnTime: breakdown.billsOnTimeScore,
      emergencyFund: breakdown.emergencyFundScore,
      safeToSpend: breakdown.safeToSpendScore,
    },
  };
}

/* ─────────────── Builders ─────────────── */

function buildFromClient(
  uid: string,
  monthKey: string,
  input: ClientSnapshotInput,
  now: Date,
): MonthlyFinancialSnapshot {
  const dayOfMonth = now.getDate();
  const daysInMonth = daysInMonthOf(now);

  // Wallets
  const main = nonNegative(input.wallets?.main);
  const emergency = nonNegative(input.wallets?.emergency);
  const billFund = nonNegative(input.wallets?.billFund);

  // Bills
  const billItems: SnapshotBill[] = (input.bills ?? [])
    .filter((b) => b.name)
    .map((b) => {
      const dueDay = Math.floor(toFiniteNumber(b.dueDay));
      return {
        id: b.id || b.name || 'bill',
        name: b.name as string,
        amount: nonNegative(b.amount),
        dueDay,
        status: deriveBillStatus(Boolean(b.isPaid), dueDay, dayOfMonth),
      };
    });
  const totalDue = round(billItems.filter((b) => b.status !== 'paid').reduce((s, b) => s + b.amount, 0));
  const totalPaid = round(billItems.filter((b) => b.status === 'paid').reduce((s, b) => s + b.amount, 0));

  // Tasks
  const taskItems: SnapshotTask[] = [];
  for (const t of input.tasks ?? []) {
    const status = deriveTaskStatus(t, monthKey, now);
    if (!status) continue;
    const subTasksTotal = t.subTasks?.length ?? 0;
    const subTasksDone = t.subTasks?.filter((s) => s.isCompleted).length ?? 0;
    taskItems.push({
      id: t.id || t.name || 'task',
      name: t.name || 'Nhiệm vụ',
      expectedAmount: nonNegative(t.expectedAmount),
      status,
      dueDate: t.endDate,
      subTasksDone,
      subTasksTotal,
    });
  }

  // Cashflow + categories
  const { cashflow, spendByCategory } = computeCashflow(input.transactions ?? [], dayOfMonth);
  const budgets = input.budgets ?? [];
  const { topBySpend, overspent } = computeCategories(spendByCategory, budgets);

  const categoryNameOf = (id: string): string => {
    const b = budgets.find((x) => (x.categoryId || x.name) === id);
    return b?.name || id;
  };
  const anomalies = computeAnomalies(spendByCategory, input.history ?? [], categoryNameOf);

  // Budget
  const monthlyBudgetTotal = round(budgets.reduce((s, b) => s + nonNegative(b.limit), 0));
  // B-01: safe-to-spend dùng CÔNG THỨC CHUNG (computeSafeToSpendValue) — income + carryOver
  // − budget − bill chưa trả − góp goal đều/tháng. Trước đây bỏ qua carryOver & goalContributions
  // (chỉ budget − expense − dueBills) → lệch với getSafeToSpendBreakdown của UI.
  const carryOver = toFiniteNumber(input.carryOver ?? 0);
  const plannedGoalContributions = round(
    (input.goals ?? []).reduce((s, g) => s + nonNegative(g.monthlyContributionTarget), 0),
  );
  const safeToSpend = round(
    computeSafeToSpendValue({
      monthlyIncome: cashflow.income,
      carryOver,
      plannedMonthlyBudget: monthlyBudgetTotal,
      totalUnpaidBills: totalDue,
      plannedMonthlyGoalContributions: plannedGoalContributions,
    }),
  );
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth + 1);
  const budget: SnapshotBudget = {
    monthlyBudgetTotal,
    spentSoFar: cashflow.expense,
    safeToSpend,
    safeToSpendPerDay: daysRemaining > 0 ? round(safeToSpend / daysRemaining) : safeToSpend,
    daysRemaining,
    categoriesTotal: budgets.length,
    categoriesOverBudget: overspent.length,
  };

  // Goals
  const goals = computeGoals(input.goals ?? [], cashflow.savings, now);

  // Health
  const billsDueByNow = billItems.filter((b) => b.dueDay && b.dueDay <= dayOfMonth).length;
  const billsPaidOfDue = billItems.filter((b) => b.dueDay && b.dueDay <= dayOfMonth && b.status === 'paid').length;
  const health = buildHealth({
    income: cashflow.income,
    expense: cashflow.expense,
    safeToSpend,
    emergencyBalance: emergency,
    categoriesTotal: budgets.length,
    categoriesOverBudget: overspent.length,
    billsDueByNow,
    billsPaidOfDue,
    dayOfMonth,
  });

  return {
    meta: { uid, monthKey, generatedAt: now.toISOString(), dayOfMonth, daysInMonth, source: 'client', warnings: [] },
    wallets: { main, emergency, billFund, total: round(main + emergency + billFund) },
    cashflow,
    budget,
    bills: { items: billItems, totalDue, totalPaid },
    categories: { topBySpend, overspent, anomalies },
    goals,
    tasks: {
      items: taskItems,
      activeCount: taskItems.filter((t) => t.status === 'pending' || t.status === 'active').length,
      completedCount: taskItems.filter((t) => t.status === 'completed').length,
    },
    health,
  };
}

/** Snapshot zero cho các section Phase 3 (dùng cho empty/firestore). */
function zeroSections(emergency = 0): {
  cashflow: SnapshotCashflow;
  budget: SnapshotBudget;
  categories: MonthlyFinancialSnapshot['categories'];
  goals: MonthlyFinancialSnapshot['goals'];
  health: SnapshotHealth;
} {
  return {
    cashflow: { income: 0, expense: 0, net: 0, savings: 0, savingsRate: 0, avgDailyExpense: 0 },
    budget: {
      monthlyBudgetTotal: 0,
      spentSoFar: 0,
      safeToSpend: 0,
      safeToSpendPerDay: 0,
      daysRemaining: 0,
      categoriesTotal: 0,
      categoriesOverBudget: 0,
    },
    categories: { topBySpend: [], overspent: [], anomalies: [] },
    goals: { items: [], atRisk: [] },
    health: buildHealth({
      income: 0,
      expense: 0,
      safeToSpend: 0,
      emergencyBalance: emergency,
      categoriesTotal: 0,
      categoriesOverBudget: 0,
      billsDueByNow: 0,
      billsPaidOfDue: 0,
      dayOfMonth: 1,
    }),
  };
}

function emptySnapshot(uid: string, monthKey: string, now: Date, warnings: string[]): MonthlyFinancialSnapshot {
  return {
    meta: {
      uid,
      monthKey,
      generatedAt: now.toISOString(),
      dayOfMonth: now.getDate(),
      daysInMonth: daysInMonthOf(now),
      source: 'empty',
      warnings,
    },
    wallets: { main: 0, emergency: 0, billFund: 0, total: 0 },
    bills: { items: [], totalDue: 0, totalPaid: 0 },
    tasks: { items: [], activeCount: 0, completedCount: 0 },
    ...zeroSections(0),
  };
}

async function buildFromFirestore(uid: string, monthKey: string, now: Date): Promise<MonthlyFinancialSnapshot> {
  const warnings: string[] = [];

  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin');
    const db = getAdminDb();

    const [coreDoc, billsSnap, tasksSnap] = await Promise.all([
      db.doc(`users/${uid}/finance_core/state`).get(),
      db.collection(`users/${uid}/bills`).get().catch(() => null),
      db.collection(`users/${uid}/tasks`).get().catch(() => null),
    ]);

    let main = 0;
    let emergency = 0;
    let billFund = 0;

    if (coreDoc.exists) {
      const data = coreDoc.data() as { ledgerEntries?: LedgerEntry[] } | undefined;
      const ledger = Array.isArray(data?.ledgerEntries) ? data!.ledgerEntries! : [];
      main = getAccountBalance(ledger, MAIN_BANK_ACCOUNT_ID) + getAccountBalance(ledger, SPENDING_ACCOUNT_ID);
      emergency = getAccountBalance(ledger, EMERGENCY_FUND_ACCOUNT_ID);
      billFund = getAccountBalance(ledger, BILL_FUND_ACCOUNT_ID);
    } else {
      warnings.push('Không tìm thấy finance_core/state trên Firestore.');
    }

    if (!billsSnap || billsSnap.empty) {
      warnings.push('Hóa đơn chưa được đồng bộ lên server — gửi clientSnapshot để có dữ liệu bill.');
    }
    if (!tasksSnap || tasksSnap.empty) {
      warnings.push('Nhiệm vụ chưa được đồng bộ lên server — gửi clientSnapshot để có dữ liệu task.');
    }
    warnings.push('Cashflow/ngân sách/mục tiêu cần clientSnapshot để phân tích đầy đủ.');

    const m = Math.max(0, round(main));
    const e = Math.max(0, round(emergency));
    const b = Math.max(0, round(billFund));

    return {
      meta: {
        uid,
        monthKey,
        generatedAt: now.toISOString(),
        dayOfMonth: now.getDate(),
        daysInMonth: daysInMonthOf(now),
        source: 'firestore',
        warnings,
      },
      wallets: { main: m, emergency: e, billFund: b, total: round(m + e + b) },
      bills: { items: [], totalDue: 0, totalPaid: 0 },
      tasks: { items: [], activeCount: 0, completedCount: 0 },
      ...zeroSections(e),
    };
  } catch (error) {
    console.error('[snapshotBuilder] Firestore fallback failed:', error);
    warnings.push('Không đọc được dữ liệu server. Vui lòng thử lại.');
    return emptySnapshot(uid, monthKey, now, warnings);
  }
}

/* ─────────────── Public API ─────────────── */

export async function getFinanceSnapshot(
  uid: string,
  options: GetSnapshotOptions = {},
): Promise<MonthlyFinancialSnapshot> {
  const now = new Date();
  const monthKey = options.monthKey ?? currentMonthKey(now);
  const cacheKey = `${uid}:${monthKey}`;

  const validated = validateClientSnapshot(options.clientSnapshot);
  if (validated) {
    const snap = buildFromClient(uid, validated.monthKey ?? monthKey, validated, now);
    CACHE.set(`${uid}:${snap.meta.monthKey}`, { at: now.getTime(), snap });
    return snap;
  }

  if (!options.forceRefresh) {
    const cached = CACHE.get(cacheKey);
    if (cached && now.getTime() - cached.at < CACHE_TTL_MS) {
      return cached.snap;
    }
  }

  const snap = await buildFromFirestore(uid, monthKey, now);
  CACHE.set(cacheKey, { at: now.getTime(), snap });
  return snap;
}

export function invalidateSnapshotCache(uid: string, monthKey?: string): void {
  if (monthKey) {
    CACHE.delete(`${uid}:${monthKey}`);
    return;
  }
  for (const key of Array.from(CACHE.keys())) {
    if (key.startsWith(`${uid}:`)) CACHE.delete(key);
  }
}

/** Test helper — xóa toàn bộ cache. */
export function __clearSnapshotCacheForTest(): void {
  CACHE.clear();
}
