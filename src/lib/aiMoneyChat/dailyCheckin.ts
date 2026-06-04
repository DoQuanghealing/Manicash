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
    return 'Cảnh báo: ngân sách chi tiêu tháng này đã hết. Từ giờ mỗi khoản chi nên có lý do rõ ràng.';
  }
  if (status === 'watch') {
    return slot === 'midday'
      ? 'Nửa ngày mà tốc độ chi hơi nhanh. Chiều nay cần phanh lại một chút.'
      : 'Hôm nay chi hơi mạnh tay. Tối nay đừng mua theo cảm xúc nữa.';
  }
  if (status === 'no-data') {
    return 'Chưa có dữ liệu đủ để đánh giá. Hãy ghi thu/chi trong ngày để báo cáo có ý nghĩa.';
  }
  return slot === 'midday'
    ? 'Đang ổn. Nửa ngày còn lại chỉ cần giữ nhịp này.'
    : 'Ngày này tạm ổn. Việc quan trọng là đối chiếu lại số dư trước khi ngủ.';
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

  const title = input.slot === 'midday' ? 'Báo cáo 12h' : 'Báo cáo 21h';
  const goalLine = nearestGoal
    ? `Mục tiêu gần nhất: "${nearestGoal.name}" còn thiếu ${formatVnd(nearestGoal.targetAmount - nearestGoal.currentAmount)}.`
    : 'Chưa có mục tiêu gần nhất để liên kết hành động.';
  const billLine = fixedBillsShortage > 0
    ? `Quỹ bill còn thiếu ${formatVnd(fixedBillsShortage)} cho các bill cố định.`
    : 'Quỹ bill cố định đang đủ theo dữ liệu hiện tại.';
  const closeLine = input.slot === 'midday'
    ? 'Gợi ý 12h: nếu chưa có thu nhập mới, giữ bữa chiều tối giản và tránh mua nhanh.'
    : 'Gợi ý 21h: đối chiếu số dư ngân hàng với ManiCash. Lệch 1 giao dịch là báo cáo ngày mai sẽ sai.';

  return {
    slot: input.slot,
    status,
    title,
    message: [
      `${title}: ${getStatusLine(status, input.slot)}`,
      `Hôm nay: thu ${formatVnd(todayIncome)}, chi ${formatVnd(todayExpense)}.`,
      `Tháng này: thu ${formatVnd(monthlyIncome)}, chi ${formatVnd(monthlyExpense)}, dòng tiền ròng ${formatVnd(monthlyNetCashflow)}.`,
      `Ngưỡng chi còn lại: ${formatVnd(monthlySpendingRemaining)} (~${formatVnd(dailyAllowanceRemaining)}/ngày).`,
      `Tiết kiệm ước tính tháng này: ${formatVnd(monthlySavingsEstimate)}.`,
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
