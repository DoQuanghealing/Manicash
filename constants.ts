import { Category, User, Wallet, Budget } from './types';

export const USERS: User[] = [
  { id: 'u1', name: 'Alex', avatar: '🦊' },
  { id: 'u2', name: 'Sam', avatar: '🐼' },
];

export const INITIAL_WALLETS: Wallet[] = [
  { id: 'w1', userId: 'u1', name: "Alex's Stash", balance: 2450 },
  { id: 'w2', userId: 'u2', name: "Sam's Vault", balance: 3100 },
];

export const INITIAL_BUDGETS: Budget[] = [
  { category: Category.FOOD, limit: 600, spent: 0 },
  { category: Category.SHOPPING, limit: 300, spent: 0 },
  { category: Category.ENTERTAINMENT, limit: 200, spent: 0 },
  { category: Category.TRANSPORT, limit: 150, spent: 0 },
];

export const CATEGORY_COLORS: Record<Category, string> = {
  [Category.FOOD]: '#ef4444',
  [Category.TRANSPORT]: '#f59e0b',
  [Category.SHOPPING]: '#ec4899',
  [Category.BILLS]: '#6366f1',
  [Category.ENTERTAINMENT]: '#8b5cf6',
  [Category.INVESTMENT]: '#10b981',
  [Category.INCOME]: '#10b981',
  [Category.TRANSFER]: '#94a3b8',
  [Category.OTHER]: '#64748b',
};

// ===== Settings storage keys =====
export const LS_KEYS = {
  USERS: 'duocash_users_v1',
  WALLETS: 'duocash_wallets_v1',
  CURRENCY: 'duocash_currency_v1', // dự phòng
} as const;

// ===== Money formatting (VND) =====
export function formatVnd(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(safe);
}
