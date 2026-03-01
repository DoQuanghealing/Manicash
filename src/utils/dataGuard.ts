// src/utils/dataGuard.ts
import { Rank, TransactionType, Category } from '../types';

export const DataGuard = {
  asNumber(value: any, fallback = 0): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    if (typeof value === "string") {
      // Strip everything except digits and minus sign
      const cleaned = value.replace(/[^\d-]/g, "");
      const n = parseInt(cleaned, 10);
      return isNaN(n) ? fallback : n;
    }
    return fallback;
  },

  sanitizeWallet(w: any) {
    if (!w) return { id: "", name: "", balance: 0, userId: "" };
    return {
      ...w,
      id: String(w.id ?? ""),
      userId: String(w.userId ?? ""),
      name: String(w.name ?? w.title ?? "Ví"),
      balance: DataGuard.asNumber(w.balance ?? w.amount ?? 0),
    };
  },

  sanitizeTransaction(t: any) {
    if (!t) {
      return {
        id: `tx_${Date.now()}`,
        date: new Date().toISOString(),
        amount: 0,
        type: TransactionType.EXPENSE,
        category: Category.OTHER,
        walletId: "",
        description: "",
        timestamp: Date.now()
      };
    }
    return {
      ...t,
      id: String(t.id ?? `tx_${Date.now()}`),
      date: String(t.date ?? new Date().toISOString()),
      amount: DataGuard.asNumber(t.amount ?? 0),
      timestamp: DataGuard.asNumber(t.timestamp ?? Date.now()),
      description: String(t.description ?? ""),
      walletId: String(t.walletId ?? ""),
      type: t.type || TransactionType.EXPENSE,
      category: t.category || Category.OTHER,
    };
  },

  sanitizeGoal(g: any) {
    if (!g) {
      return {
        id: `goal_${Date.now()}`,
        name: "Mục tiêu",
        targetAmount: 0,
        currentAmount: 0,
        deadline: new Date().toISOString(),
        rounds: []
      };
    }

    return {
      ...g,
      id: String(g.id ?? `goal_${Date.now()}`),
      name: String(g.name ?? g.title ?? "Mục tiêu"),
      targetAmount: DataGuard.asNumber(g.targetAmount ?? g.target ?? 0),
      currentAmount: DataGuard.asNumber(g.currentAmount ?? g.current ?? 0),
      deadline: String(g.deadline ?? new Date().toISOString()),
      rounds: Array.isArray(g.rounds) ? g.rounds : []
    };
  },

  sanitizeBudget(b: any) {
    if (!b) return { category: Category.OTHER, limit: 0, spent: 0 };
    return {
      ...b,
      category: b.category || Category.OTHER,
      limit: DataGuard.asNumber(b.limit ?? 0),
      spent: DataGuard.asNumber(b.spent ?? 0),
    };
  },

  sanitizeFixedCost(c: any) {
    if (!c) return {
      id: `cost_${Date.now()}`,
      title: "Chi phí cố định",
      amount: 0,
      allocatedAmount: 0,
      nextDueDate: new Date().toISOString().slice(0, 10),
      frequencyMonths: 1
    };
    return {
      ...c,
      id: String(c.id ?? `cost_${Date.now()}`),
      amount: DataGuard.asNumber(c.amount ?? 0),
      frequencyMonths: DataGuard.asNumber(c.frequencyMonths ?? 1, 1),
      allocatedAmount: DataGuard.asNumber(c.allocatedAmount ?? 0),
      nextDueDate: String(c.nextDueDate ?? new Date().toISOString().slice(0, 10)),
      title: String(c.title ?? "Chi phí cố định"),
    };
  },

  sanitizeProject(p: any) {
    if (!p) return {
      id: `proj_${Date.now()}`,
      userId: "",
      name: "",
      description: "",
      expectedIncome: 0,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      status: 'planning',
      milestones: []
    };
    return {
      ...p,
      id: String(p.id ?? `proj_${Date.now()}`),
      name: String(p.name ?? ""),
      expectedIncome: DataGuard.asNumber(p.expectedIncome ?? 0),
      milestones: Array.isArray(p.milestones) ? p.milestones.map((m: any) => ({
        ...m,
        id: String(m.id ?? `m_${Date.now()}`),
        title: String(m.title ?? ""),
        isCompleted: Boolean(m.isCompleted)
      })) : []
    };
  },

  sanitizeCompletedPlan(cp: any) {
    if (!cp) return {
      id: `cp_${Date.now()}`,
      name: "",
      earnedAmount: 0,
      pointsAwarded: 0,
      completedAt: new Date().toISOString()
    };
    return {
      ...cp,
      id: String(cp.id ?? `cp_${Date.now()}`),
      name: String(cp.name ?? ""),
      earnedAmount: DataGuard.asNumber(cp.earnedAmount ?? 0),
      pointsAwarded: DataGuard.asNumber(cp.pointsAwarded ?? 0),
      completedAt: String(cp.completedAt ?? new Date().toISOString())
    };
  },

  sanitizeGamification(g: any) {
    if (!g) return { points: 0, rank: Rank.IRON, lastUpdated: new Date().toISOString() };
    return {
      points: DataGuard.asNumber(g.points ?? 0),
      rank: (g.rank as Rank) || Rank.IRON,
      lastUpdated: String(g.lastUpdated ?? new Date().toISOString())
    };
  }
};
