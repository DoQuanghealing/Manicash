/* ═══ Handler — QUERY_BUDGET_STATUS / QUERY_CATEGORY_SPENDING (deterministic) ═══
 * "danh mục nào vượt ngân sách"        -> tổng ngân sách + danh mục cần chú ý
 * "ăn uống tháng này xài bao nhiêu"    -> chi tiết 1 danh mục
 * Dùng Money Brain budgetMetrics (spent recompute từ transactions).
 */

import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { extractSlots } from '../intent/slotExtractor';
import { buildMoneySnapshot, deterministicReply, NEED_SYNC_MESSAGE } from './engineContext';
import { formatVND, formatPercent, bulletList } from '../response/formatMoney';
import {
  getBudgetCategoryProgress,
  getBudgetProgressForCategory,
  getTotalBudgetSpent,
  getTotalBudgetRemaining,
  getPlannedMonthlyBudget,
  computeBudgetSpentByCategory,
  getSavingsPotentialForCategory,
} from '@/lib/moneyBrain/budgetMetrics';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

const CUT_PERCENT = 0.2;

/** Tên hiển thị cho 1 categoryId: ưu tiên tên trong budgets snapshot, rồi slot. */
function resolveCategoryName(
  money: MoneySnapshotV1,
  categoryId: string,
  fallbackName?: string,
): string {
  const budget = money.budgets.find((b) => b.categoryId === categoryId);
  if (budget?.categoryName) return budget.categoryName;
  const txn = money.transactions.find((t) => t.categoryId === categoryId && t.categoryName);
  if (txn?.categoryName) return txn.categoryName;
  return fallbackName ?? categoryId;
}

function categoryDetail(
  money: MoneySnapshotV1,
  categoryId: string,
  intent: ChatIntent,
  fallbackName?: string,
): ChatReply {
  const name = resolveCategoryName(money, categoryId, fallbackName);
  const progress = getBudgetProgressForCategory(money, categoryId);

  // Có đặt ngân sách cho danh mục này.
  if (progress && progress.monthlyLimit > 0) {
    const lines = [
      `**${name}** tháng này đã dùng **${formatVND(progress.spent)}** / ${formatVND(progress.monthlyLimit)}.`,
      '',
      `Còn lại: **${formatVND(progress.remaining)}** · Tiến độ: **${formatPercent(progress.progress)}**.`,
    ];
    if (progress.isOverBudget) {
      const overBy = progress.spent - progress.monthlyLimit;
      lines.push(
        '',
        `⚠️ Đã **vượt ngân sách** ${formatVND(overBy)}. Nên khóa chi tự do ở danh mục này đến cuối tháng.`,
      );
    } else {
      const saving = getSavingsPotentialForCategory(money, categoryId, CUT_PERCENT);
      if (saving > 0) {
        lines.push('', `Nếu cắt ${formatPercent(CUT_PERCENT * 100)} phần đã chi, ngài giữ thêm ~${formatVND(saving)}.`);
      }
    }
    return deterministicReply(lines.join('\n'), intent);
  }

  // Chưa đặt ngân sách -> chỉ báo số đã chi (recompute từ transactions).
  const spent = computeBudgetSpentByCategory(money)[categoryId] ?? 0;
  if (spent <= 0) {
    return deterministicReply(`**${name}** tháng này ngài chưa ghi nhận khoản chi nào.`, intent);
  }
  return deterministicReply(
    `**${name}** tháng này đã chi **${formatVND(spent)}** (ngài chưa đặt ngân sách cho danh mục này).`,
    intent,
  );
}

function budgetStatus(money: MoneySnapshotV1, intent: ChatIntent): ChatReply {
  const planned = getPlannedMonthlyBudget(money);

  if (planned <= 0) {
    return deterministicReply(
      'Ngài chưa đặt ngân sách danh mục nào tháng này. Hãy đặt hạn mức ở tab Sổ sách để mình theo dõi nhé.',
      intent,
    );
  }

  const spent = getTotalBudgetSpent(money);
  const remaining = getTotalBudgetRemaining(money);

  const lines = [
    `Tháng này ngài đã dùng **${formatVND(spent)}** / ${formatVND(planned)} ngân sách.`,
    '',
    `Còn lại: **${formatVND(remaining)}**.`,
  ];

  // Danh mục cần chú ý: vượt ngân sách trước, rồi gần chạm hạn mức (>= 80%).
  const watch = getBudgetCategoryProgress(money)
    .filter((c) => c.monthlyLimit > 0 && (c.isOverBudget || c.progress >= 80))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  if (watch.length > 0) {
    lines.push('', 'Danh mục cần chú ý:');
    lines.push(
      bulletList(
        watch.map((c) => {
          const name = resolveCategoryName(money, c.categoryId);
          const tag = c.isOverBudget ? ' (đã vượt)' : '';
          return `${name} — ${formatPercent(c.progress)}${tag}`;
        }),
      ),
    );
  } else {
    lines.push('', 'Tất cả danh mục đều trong hạn mức. Tuyệt vời.');
  }

  return deterministicReply(lines.join('\n'), intent);
}

export async function handleQueryBudget(
  _uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const money = buildMoneySnapshot(ctx);
  if (!money) {
    return deterministicReply(NEED_SYNC_MESSAGE, intent);
  }

  const slots = extractSlots(intent.rawText);
  if (slots.categoryId) {
    return categoryDetail(money, slots.categoryId, intent, slots.categoryName);
  }
  return budgetStatus(money, intent);
}
