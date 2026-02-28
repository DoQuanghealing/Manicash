// src/utils/dataGuard.ts
import { Rank } from '../types';

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
    if (!w) return { id: "", name: "", balance: 0 };
    return {
      ...w,
      id: String(w.id ?? ""),
      name: String(w.name ?? w.title ?? "Ví"),
      balance: DataGuard.asNumber(w.balance ?? w.amount ?? 0),
    };
  },

  sanitizeTransaction(t: any) {
    if (!t) return null as any;
    return {
      ...t,
      id: String(t.id ?? `tx_${Date.now()}`),
      date: String(t.date ?? new Date().toISOString()),
      amount: DataGuard.asNumber(t.amount ?? 0),
      timestamp: DataGuard.asNumber(t.timestamp ?? Date.now()),
      description: String(t.description ?? ""),
      walletId: String(t.walletId ?? ""),
    };
  },

  sanitizeGoal(g: any) {
    if (!g) return null as any;
    return {
      ...g,
      id: String(g.id ?? `goal_${Date.now()}`),
      targetAmount: DataGuard.asNumber(g.targetAmount ?? g.target ?? 0),
      currentAmount: DataGuard.asNumber(g.currentAmount ?? g.current ?? 0),
      title: String(g.title ?? g.name ?? "Mục tiêu"),
    };
  },

  sanitizeBudget(b: any) {
    if (!b) return null as any;
    return {
      ...b,
      id: String(b.id ?? `budget_${Date.now()}`),
      limit: DataGuard.asNumber(b.limit ?? 0),
    };
  },

  sanitizeFixedCost(c: any) {
    if (!c) return null as any;
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
    if (!p) return null as any;
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
    if (!cp) return null as any;
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
