import { getDateKey, getMonthKeyFromDate } from '@/lib/dateHelpers';
import type { Transaction } from '@/stores/useFinanceStore';

export type DailyCheckInSlot = 'midday' | 'evening';
export type DailyCheckInStatus = 'on-track' | 'watch' | 'overspent' | 'no-data';

export interface DailyCheckInGoal {
  name: string;
  targetAmount: number;
  currentAmount: number;
}

export interface DailyCheckInInput {
  slot: DailyCheckInSlot;
  now?: Date;
  transactions: Transaction[];
  monthlySpendingLimit?: number;
  carryOver?: number;
  fixedBillsTotal?: number;
  billFundBalance?: number;
  goals?: DailyCheckInGoal[];
}

export interface DailyCheckIn {
  slot: DailyCheckInSlot;
  status: DailyCheckInStatus;
  title: string;
  message: string;
  metrics: {
    todayIncome: number;
    todayExpense: number;
    monthlyIncome: number;
    monthlyExpense: number;
    monthlyNetCashflow: number;
    monthlySavingsEstimate: number;
    monthlySpendingLimit: number;
    monthlySpendingRemaining: number;
    dailyAllowanceRemaining: number;
    fixedBillsShortage: number;
  };
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
}

function getDaysRemainingInMonth(now: Date): number {
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.max(1, lastDay - now.getUTCDate() + 1);
}

function sumByType(transactions: Transaction[], type: 'income' | 'expense'): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function findNearestGoal(goals: DailyCheckInGoal[] = []): DailyCheckInGoal | undefined {
  return goals
    .filter((goal) => goal.targetAmount > goal.currentAmount)
    .sort((a, b) => {
      const aGap = a.targetAmount - a.currentAmount;
      const bGap = b.targetAmount - b.currentAmount;
      return aGap - bGap;
    })[0];
}

function getStatus(todayExpense: number, dailyAllowance: number, monthlyRemaining: number): DailyCheckInStatus {
  if (todayExpense === 0 && monthlyRemaining === 0) return 'no-data';
  if (monthlyRemaining <= 0) return 'overspent';
  if (dailyAllowance > 0 && todayExpense > dailyAllowance * 1.25) return 'watch';
  return 'on-track';
}

function getStatusLine(status: DailyCheckInStatus, slot: DailyCheckInSlot): string {
  if (status === 'overspent') {
    return 'Canh bao: ngan sach chi tieu thang nay da het. Tu gio moi khoan chi nen co ly do ro rang.';
  }
  if (status === 'watch') {
    return slot === 'midday'
      ? 'Nua ngay ma toc do chi hoi nhanh. Chieu nay can phanh lai mot chut.'
      : 'Hom nay chi hoi manh tay. Toi nay dung mua theo cam xuc nua.';
  }
  if (status === 'no-data') {
    return 'Chua co du lieu du de danh gia. Hay ghi thu/chi trong ngay de bao cao co y nghia.';
  }
  return slot === 'midday'
    ? 'Dang on. Nua ngay con lai chi can giu nhip nay.'
    : 'Ngay nay tam on. Viec quan trong la doi chieu lai so du truoc khi ngu.';
}

export function createDailyCheckIn(input: DailyCheckInInput): DailyCheckIn {
  const now = input.now ?? new Date();
  const todayKey = getDateKey(now);
  const monthKey = getMonthKeyFromDate(now);
  const todayTransactions = input.transactions.filter((transaction) => transaction.dateKey === todayKey);
  const monthTransactions = input.transactions.filter((transaction) => getMonthKeyFromDate(transaction.date) === monthKey);

  const todayIncome = sumByType(todayTransactions, 'income');
  const todayExpense = sumByType(todayTransactions, 'expense');
  const monthlyIncome = sumByType(monthTransactions, 'income');
  const monthlyExpense = sumByType(monthTransactions, 'expense');
  const monthlyNetCashflow = monthlyIncome - monthlyExpense;
  const monthlySavingsEstimate = Math.max(0, monthlyNetCashflow);
  const monthlySpendingLimit = Math.max(0, input.monthlySpendingLimit ?? 0);
  const monthlySpendingRemaining = monthlySpendingLimit > 0
    ? Math.max(0, monthlySpendingLimit - monthlyExpense)
    : Math.max(0, monthlyIncome + (input.carryOver ?? 0) - monthlyExpense - (input.fixedBillsTotal ?? 0));
  const dailyAllowanceRemaining = Math.floor(monthlySpendingRemaining / getDaysRemainingInMonth(now));
  const fixedBillsShortage = Math.max(0, (input.fixedBillsTotal ?? 0) - (input.billFundBalance ?? 0));
  const status = getStatus(todayExpense, dailyAllowanceRemaining, monthlySpendingRemaining);
  const nearestGoal = findNearestGoal(input.goals);

  const title = input.slot === 'midday' ? 'Bao cao 12h' : 'Bao cao 21h';
  const goalLine = nearestGoal
    ? `Muc tieu gan nhat: "${nearestGoal.name}" con thieu ${formatVnd(nearestGoal.targetAmount - nearestGoal.currentAmount)}.`
    : 'Chua co muc tieu gan nhat de lien ket hanh dong.';
  const billLine = fixedBillsShortage > 0
    ? `Quy bill con thieu ${formatVnd(fixedBillsShortage)} cho cac bill co dinh.`
    : 'Quy bill co dinh dang du theo du lieu hien tai.';
  const closeLine = input.slot === 'midday'
    ? 'Goi y 12h: neu chua co thu nhap moi, giu bua chieu toi gian va tranh mua nhanh.'
    : 'Goi y 21h: doi chieu so du ngan hang voi ManiCash. Lech 1 giao dich la bao cao ngay mai se sai.';

  return {
    slot: input.slot,
    status,
    title,
    message: [
      `${title}: ${getStatusLine(status, input.slot)}`,
      `Hom nay: thu ${formatVnd(todayIncome)}, chi ${formatVnd(todayExpense)}.`,
      `Thang nay: thu ${formatVnd(monthlyIncome)}, chi ${formatVnd(monthlyExpense)}, dong tien rong ${formatVnd(monthlyNetCashflow)}.`,
      `Nguong chi con lai: ${formatVnd(monthlySpendingRemaining)} (~${formatVnd(dailyAllowanceRemaining)}/ngay).`,
      `Tiet kiem uoc tinh thang nay: ${formatVnd(monthlySavingsEstimate)}.`,
      billLine,
      goalLine,
      closeLine,
    ].join('\n'),
    metrics: {
      todayIncome,
      todayExpense,
      monthlyIncome,
      monthlyExpense,
      monthlyNetCashflow,
      monthlySavingsEstimate,
      monthlySpendingLimit,
      monthlySpendingRemaining,
      dailyAllowanceRemaining,
      fixedBillsShortage,
    },
  };
}
