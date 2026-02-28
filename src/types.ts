export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
}

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

export enum ButlerType {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export enum UserGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER'
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

export interface Transaction {
  id: string;
  date: string;
  createdAt?: string;
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

export interface GoalRound {
  id: string;
  date: string;
  amount: number;
  contributorId: string;
  note: string;
}

export interface Goal {
  id: string;
  userId?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  rounds: GoalRound[];
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  gender?: UserGender;
  butlerPreference?: ButlerType;
  maleButlerName?: string;
  femaleButlerName?: string;
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
  allocatedAmount: number;
  nextDueDate: string;
  frequencyMonths: number;
  description?: string;
}

export interface Milestone {
  id: string;
  title: string;
  startDate: string;
  date: string;
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

export interface CompletedPlan {
  id: string;
  name: string;
  earnedAmount: number;
  completedAt: string;
  pointsAwarded: number;
}

export interface GamificationState {
  points: number;
  rank: Rank;
  lastUpdated: string;
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
  gamificationInsights: {
    rankVelocity: string;
    incomeVsGoals: string;
    domainExpertise: string;
  };
  cfoAdvice: string;
}

export interface ProsperityPlan {
  statusTitle: string;
  statusEmoji: string;
  healthScore: number;
  summary: string;
  savingsStrategies: string[];
  incomeStrategies: string[];
  badHabitToQuit: { habit: string; why: string };
  spendingVsIncomeFeedback: string;
  incomeRecognition: string;
  dailyTasks: { title: string; desc: string }[];
}

export interface AllocationSetting {
  itemId: string;
  type: 'COST' | 'GOAL';
  percentage: number;
  isEnabled: boolean;
}
