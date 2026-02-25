// src/utils/dataGuard.ts
import { 
  Transaction, Budget, Wallet, Goal, FixedCost, IncomeProject, 
  Category, TransactionType, CompletedPlan, GamificationState, Rank 
} from '../types';

export const DataGuard = {
  // Ép kiểu số an toàn
  asNumber: (val: any, fallback: number = 0): number => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  },

  // Làm sạch Giao dịch
  sanitizeTransaction: (tx: any): Transaction => ({
    id: String(tx?.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
    date: tx?.date || new Date().toISOString(),
    // Lưu ý: types.ts của bạn đang dùng timestamp thay vì createdAt, hãy giữ nhất quán
    amount: Math.max(0, DataGuard.asNumber(tx?.amount)),
    type: tx?.type || TransactionType.EXPENSE,
    category: tx?.category || Category.OTHER,
    walletId: tx?.walletId || 'w1',
    description: String(tx?.description || ''),
    timestamp: DataGuard.asNumber(tx?.timestamp, Date.now()),
  }),

  // Làm sạch Ngân sách
  sanitizeBudget: (b: any): Budget => ({
    category: b?.category || Category.OTHER,
    limit: Math.max(0, DataGuard.asNumber(b?.limit)),
    spent: Math.max(0, DataGuard.asNumber(b?.spent)),
    carryoverDebt: DataGuard.asNumber(b?.carryoverDebt, 0),
  }),

  // Làm sạch Ví
  sanitizeWallet: (w: any): Wallet => ({
    id: String(w?.id || 'w_unknown'),
    userId: String(w?.userId || 'u1'),
    name: String(w?.name || 'Ví không tên'),
    balance: DataGuard.asNumber(w?.balance),
  }),

  // Làm sạch Mục tiêu
  sanitizeGoal: (g: any): Goal => ({
    id: String(g?.id || `g_${Date.now()}`),
    name: String(g?.name || 'Mục tiêu mới'),
    targetAmount: Math.max(1, DataGuard.asNumber(g?.targetAmount, 1)),
    currentAmount: Math.max(0, DataGuard.asNumber(g?.currentAmount)),
    deadline: g?.deadline || new Date().toISOString().split('T')[0],
  }),

  // Làm sạch Hóa đơn cố định
  sanitizeFixedCost: (c: any): FixedCost => ({
    id: String(c?.id || `fc_${Date.now()}`),
    title: String(c?.title || 'Hóa đơn'),
    amount: Math.max(0, DataGuard.asNumber(c?.amount)),
    allocatedAmount: Math.max(0, DataGuard.asNumber(c?.allocatedAmount)),
    nextDueDate: c?.nextDueDate || new Date().toISOString().split('T')[0],
    frequencyMonths: Math.max(1, DataGuard.asNumber(c?.frequencyMonths, 1)),
    description: String(c?.description || '')
  }),

  // Làm sạch Dự án thu nhập
  sanitizeProject: (p: any): IncomeProject => ({
    id: String(p?.id || `p_${Date.now()}`),
    name: String(p?.name || 'Dự án mới'),
    expectedIncome: Math.max(0, DataGuard.asNumber(p?.expectedIncome)),
    milestones: Array.isArray(p?.milestones) ? p.milestones.map((m: any) => ({
      id: String(m?.id || `m_${Math.random()}`),
      title: String(m?.title || ''),
      isCompleted: Boolean(m?.isCompleted)
    })) : []
  }),

  // Làm sạch Kế hoạch đã hoàn thành
  sanitizeCompletedPlan: (cp: any): CompletedPlan => ({
    id: String(cp?.id || `cp_${Date.now()}`),
    title: String(cp?.title || cp?.name || 'Kế hoạch đã xong'), // Đồng bộ key với types.ts
    completedDate: cp?.completedDate || cp?.completedAt || new Date().toISOString(),
  }),

  // Làm sạch Trạng thái Gamification
  sanitizeGamification: (gs: any): GamificationState => ({
    points: Math.max(0, DataGuard.asNumber(gs?.points)),
    rank: gs?.rank || Rank.IRON,
    lastUpdated: DataGuard.asNumber(gs?.lastUpdated, Date.now()) // Ép về number cho đúng types.ts
  })
};
