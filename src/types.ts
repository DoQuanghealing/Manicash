// src/types.ts
export enum Category {
  FOOD = 'FOOD',
  TRANSPORT = 'TRANSPORT',
  SHOPPING = 'SHOPPING',
  BILLS = 'BILLS',
  ENTERTAINMENT = 'ENTERTAINMENT',
  INVESTMENT = 'INVESTMENT',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER'
}

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export enum ButlerType {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: Category;
  walletId: string;
  description: string;
  timestamp: number;
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  balance: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  butlerPreference?: ButlerType;
  maleButlerName?: string;
  femaleButlerName?: string;
}

export interface Budget {
  category: Category;
  limit: number;
  spent: number;
}

export interface FixedCost {
  title: string;
  amount: number;
  nextDueDate: string;
  frequencyMonths: number;
  allocatedAmount: number;
}

export interface Goal {
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
}

export interface ProsperityPlan {
  statusTitle: string;
  statusEmoji: string;
  healthScore: number;
  summary: string;
  savingsStrategies: Array<{ title: string; desc: string }>;
  incomeStrategies: Array<{ title: string; desc: string }>;
  badHabitToQuit: { habit: string; why: string };
}

export interface FinancialReport {
  healthScore: number;
  healthAnalysis: string;
  cfoAdvice: string;
  // Các trường khác tương ứng với AI response...
}
