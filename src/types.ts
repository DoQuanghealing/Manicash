// src/types.ts

/**
 * ENUMS - Các danh mục cố định
 */
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

export enum UserGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export enum Rank {
  IRON = 'IRON',
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  EMERALD = 'EMERALD',
  DIAMOND = 'DIAMOND'
}

/**
 * INTERFACES - Cấu trúc dữ liệu
 */

export interface User {
  id: string;
  name: string;
  avatar: string;
  gender?: UserGender;
  butlerPreference: ButlerType; // Chọn Lord hay Queen
  maleButlerName?: string;      // Tên tùy chỉnh cho Lord
  femaleButlerName?: string;    // Tên tùy chỉnh cho Queen
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  balance: number;
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
  createdAt?: string;
}

export interface Budget {
  category: Category;
  limit: number;
  spent: number;
  carryoverDebt?: number;
}

export interface FixedCost {
  id: string;
  title: string;
  amount: number;
  nextDueDate: string;
  frequencyMonths: number;
  allocatedAmount: number;
  description?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  rounds?: Array<{
    id: string;
    date: string;
    amount: number;
    contributorId: string;
    note: string;
  }>;
}

export interface IncomeProject {
  id: string;
  name: string;
  expectedIncome: number;
  milestones: Array<{
    id: string;
    title: string;
    isCompleted: boolean;
  }>;
}

export interface GamificationState {
  points: number;
  rank: Rank;
  lastUpdated: number;
}

export interface CompletedPlan {
  id: string;
  title: string;
  completedDate: string;
}

export interface AllocationSetting {
  itemId: string;
  type: 'COST' | 'GOAL';
  percentage: number;
  isEnabled: boolean;
}

/**
 * AI & REPORTS - Các cấu trúc phản hồi từ AI
 */

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
  incomeEfficiency: any;
  budgetDiscipline: any;
  wealthVelocity: any;
  gamificationInsights: any;
  cfoAdvice: string;
}
