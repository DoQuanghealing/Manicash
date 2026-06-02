import type { TxnType } from '@/stores/useFinanceStore';

export type MoneyReactionTone = 'celebrate' | 'nudge' | 'sarcastic' | 'discipline' | 'calm';
export type MoneyReactionSeverity = 'positive' | 'neutral' | 'watch' | 'warning';

export interface MoneyReactionGoal {
  name: string;
  targetAmount: number;
  currentAmount: number;
}

export interface MoneyReactionInput {
  type: TxnType;
  amount: number;
  categoryId: string;
  note?: string;
  goals?: MoneyReactionGoal[];
}

export interface MoneyReaction {
  tone: MoneyReactionTone;
  severity: MoneyReactionSeverity;
  text: string;
  actionHint?: string;
  relatedGoalName?: string;
}

const EMOTIONAL_SPENDING_CATEGORIES = new Set(['shopping', 'cosmetics', 'entertain']);
const LARGE_EXPENSE_THRESHOLD = 1_000_000;

function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} VND`;
}

function findNearestGoal(goals: MoneyReactionGoal[] = []): MoneyReactionGoal | undefined {
  return goals
    .filter((goal) => goal.targetAmount > goal.currentAmount)
    .sort((a, b) => {
      const aGap = a.targetAmount - a.currentAmount;
      const bGap = b.targetAmount - b.currentAmount;
      return aGap - bGap;
    })[0];
}

function estimateDelayMonths(expenseAmount: number, goal?: MoneyReactionGoal): number | null {
  if (!goal || expenseAmount <= 0) return null;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) return null;
  const assumedMonthlySaving = Math.max(1_000_000, Math.round(goal.targetAmount * 0.01));
  return Math.max(1, Math.ceil(expenseAmount / assumedMonthlySaving));
}

export function createMoneyReaction(input: MoneyReactionInput): MoneyReaction {
  const nearestGoal = findNearestGoal(input.goals);

  if (input.type === 'income') {
    const saveSuggestion = Math.round(input.amount * 0.2);
    return {
      tone: 'celebrate',
      severity: 'positive',
      relatedGoalName: nearestGoal?.name,
      text: `Tien ve ${formatVnd(input.amount)}. Dep day. Bay gio chia tien truoc khi dopamine ru ban di mua thu linh tinh.`,
      actionHint: nearestGoal
        ? `Goi y: chuyen it nhat ${formatVnd(saveSuggestion)} vao muc tieu "${nearestGoal.name}".`
        : `Goi y: cat rieng it nhat ${formatVnd(saveSuggestion)} vao tiet kiem truoc khi chi.`,
    };
  }

  if (input.type === 'transfer') {
    return {
      tone: 'celebrate',
      severity: 'positive',
      relatedGoalName: nearestGoal?.name,
      text: `Da chuyen ${formatVnd(input.amount)} vao quy. Day la hanh vi cua nguoi co ke hoach, khong phai nguoi de tien tu troi.`,
      actionHint: nearestGoal ? `Muc tieu "${nearestGoal.name}" vua co them dong luc.` : 'Hay giu nhip nay moi khi tien ve.',
    };
  }

  const isLarge = input.amount >= LARGE_EXPENSE_THRESHOLD;
  const isEmotionalCategory = EMOTIONAL_SPENDING_CATEGORIES.has(input.categoryId);
  const delayMonths = estimateDelayMonths(input.amount, nearestGoal);

  if (isLarge || isEmotionalCategory) {
    const goalPart = nearestGoal && delayMonths
      ? ` Muc tieu "${nearestGoal.name}" vua bi day xa them khoang ${delayMonths} thang neu thoi quen nay lap lai.`
      : '';

    return {
      tone: isLarge ? 'discipline' : 'sarcastic',
      severity: isLarge ? 'warning' : 'watch',
      relatedGoalName: nearestGoal?.name,
      text: `Omg, ${formatVnd(input.amount)} bay mau.${goalPart} Ban khong nghe tien tiet kiem khoc ha?`,
      actionHint: 'Lan sau neu la mua theo cam xuc, day vao wishlist va doi cooldown truoc khi quyet.',
    };
  }

  return {
    tone: 'nudge',
    severity: 'neutral',
    relatedGoalName: nearestGoal?.name,
    text: `Da ghi chi ${formatVnd(input.amount)}. Khoan nay co the can thiet, nhung van la tien roi khoi tai san cua ban.`,
    actionHint: nearestGoal
      ? `Neu cat duoc 10% cac khoan tuong tu, muc tieu "${nearestGoal.name}" se nhe hon dang ke.`
      : 'Cuoi ngay nhin lai tong chi de khong bi cac khoan nho cong don.',
  };
}

