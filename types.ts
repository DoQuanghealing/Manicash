
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum Category {
  FOOD = 'Food & Dining',
  TRANSPORT = 'Transport',
  SHOPPING = 'Shopping',
  BILLS = 'Bills & Utilities',
  ENTERTAINMENT = 'Entertainment',
  INVESTMENT = 'Investment',
  INCOME = 'Income',
  TRANSFER = 'Transfer',
  OTHER = 'Other',
}

export enum ButlerType {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum UserGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export interface User {
  id: string;
  name: string;
  avatar: string; // Emoji
  gender?: UserGender;
  butlerPreference?: ButlerType;
  maleButlerName?: string;
  femaleButlerName?: string;
  butlerAvatarUrl?: string; // Base64 or URL of the 3D Mascot
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  balance: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO Date string
  createdAt?: string; // Thời gian chính xác lưu lên server
  amount: number;
  type: TransactionType;
  category: Category;
  walletId: string;
  description: string;
  timestamp: number;
}

export interface Budget {
  category: Category;
  limit: number;
  spent: number;
}

export interface FixedCost {
  id: string;
  title: string;
  amount: number;
  allocatedAmount: number;
  nextDueDate: string;
  frequencyMonths: number;
  description?: string;
}

export interface InvestmentRound {
  id: string;
  date: string;
  amount: number;
  contributorId: string;
  note: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  rounds: InvestmentRound[];
  deadline: string;
}

export interface Milestone {
  id: string;
  title: string;
  startDate: string;
  date: string; // Đây là ngày hoàn thành
  completedAt?: string;
  isCompleted: boolean;
}

export interface IncomeProject {
  id: string;
  userId: string;
  name: string;
  description: string;
  expectedIncome: number;
  startDate: string;
  endDate: string;
  status: 'planning' | 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  milestones: Milestone[];
}

export interface ProsperityPlan {
  statusTitle: string;
  statusEmoji: string;
  healthScore: number;
  summary: string;
  savingsStrategies: { title: string; desc: string }[];
  incomeStrategies: { title: string; desc: string }[];
  badHabitToQuit: { habit: string; why: string };
}

export interface FinancialReport {
  healthScore: number;
  healthAnalysis: string;
  incomeEfficiency: {
    score: number;
    bestSource: string;
    forecast: string;
    analysis: string;
  };
  budgetDiscipline: {
    status: string;
    trashSpending: string[];
    varianceAnalysis: string;
    warningMessage?: string;
  };
  wealthVelocity: {
    status: string;
    goalForecasts: { name: string; estimatedDate: string }[];
    cutSuggestions: string[];
  };
  cfoAdvice: string;
}

export interface AllocationSetting {
  itemId: string;
  type: 'GOAL' | 'COST';
  percentage: number;
  isEnabled: boolean;
}
