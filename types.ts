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

export interface User {
  id: string;
  name: string;
  avatar: string; // Emoji
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
  spent: number; // Calculated dynamically usually, but good for caching
}

export interface FixedCost {
  id: string;
  title: string;
  amount: number;
  allocatedAmount: number; // Money set aside/saved for this bill so far
  nextDueDate: string; // ISO Date string (The absolute deadline)
  frequencyMonths: number; // 1 = Monthly, 6 = Every 6 months
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
  date: string; // Date for specific session/task
  isCompleted: boolean;
}

export interface IncomeProject {
  id: string;
  userId: string; // Owner of the project
  name: string; // e.g., "Gói Coaching Chị Phượng"
  description: string;
  expectedIncome: number;
  startDate: string;
  endDate: string;
  status: 'planning' | 'in_progress' | 'completed';
  milestones: Milestone[];
}

export interface AIInsight {
  type: 'insight' | 'badge' | 'reflection';
  content: string;
  icon?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'sarcastic';
}

export interface AllocationSetting {
  itemId: string;
  type: 'GOAL' | 'COST';
  percentage: number;
  isEnabled: boolean;
}

export interface FinancialReport {
  healthScore: number; // 0-100
  incomeTrend: {
    status: 'higher' | 'lower' | 'stable';
    percentage: number;
    message: string;
  };
  projectVelocity: {
    rating: 'High' | 'Medium' | 'Low';
    completedProjects: number;
    message: string;
  };
  goalForecast: {
    canMeetFixedCosts: boolean;
    majorGoalPrediction: string; // e.g., "Buying house delayed by 2 months"
    advice: string;
  };
}