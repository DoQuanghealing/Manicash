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
      text: `Tiền về ${formatVnd(input.amount)}! Đẹp đây. Bây giờ chia tiền trước khi dopamine rủ bạn đi mua thứ linh tinh.`,
      actionHint: nearestGoal
        ? `Gợi ý: chuyển ít nhất ${formatVnd(saveSuggestion)} vào mục tiêu "${nearestGoal.name}".`
        : `Gợi ý: cất riêng ít nhất ${formatVnd(saveSuggestion)} vào tiết kiệm trước khi chi.`,
    };
  }

  if (input.type === 'transfer') {
    return {
      tone: 'celebrate',
      severity: 'positive',
      relatedGoalName: nearestGoal?.name,
      text: `Đã chuyển ${formatVnd(input.amount)} vào quỹ. Đây là hành vi của người có kế hoạch, không phải người để tiền tự trôi.`,
      actionHint: nearestGoal
        ? `Mục tiêu "${nearestGoal.name}" vừa có thêm động lực.`
        : 'Hãy giữ nhịp này mỗi khi tiền về.',
    };
  }

  const isLarge = input.amount >= LARGE_EXPENSE_THRESHOLD;
  const isEmotionalCategory = EMOTIONAL_SPENDING_CATEGORIES.has(input.categoryId);
  const delayMonths = estimateDelayMonths(input.amount, nearestGoal);

  if (isLarge || isEmotionalCategory) {
    const goalPart = nearestGoal && delayMonths
      ? ` Mục tiêu "${nearestGoal.name}" vừa bị đẩy xa thêm khoảng ${delayMonths} tháng nếu thói quen này lặp lại.`
      : '';

    return {
      tone: isLarge ? 'discipline' : 'sarcastic',
      severity: isLarge ? 'warning' : 'watch',
      relatedGoalName: nearestGoal?.name,
      text: `Omg, ${formatVnd(input.amount)} bay màu.${goalPart} Bạn không nghe tiền tiết kiệm khóc à?`,
      actionHint: 'Lần sau nếu là mua theo cảm xúc, đẩy vào wishlist và đợi cooldown trước khi quyết.',
    };
  }

  return {
    tone: 'nudge',
    severity: 'neutral',
    relatedGoalName: nearestGoal?.name,
    text: `Đã ghi chi ${formatVnd(input.amount)}. Khoản này có thể cần thiết, nhưng vẫn là tiền rời khỏi tài sản của bạn.`,
    actionHint: nearestGoal
      ? `Nếu cắt được 10% các khoản tương tự, mục tiêu "${nearestGoal.name}" sẽ nhẹ hơn đáng kể.`
      : 'Cuối ngày nhìn lại tổng chi để không bị các khoản nhỏ cộng dồn.',
  };
}
