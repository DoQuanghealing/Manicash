/* ═══ AI Money Chat — Prompt Builder (Phase 3) ═══
 * Nén MonthlyFinancialSnapshot thành JSON tối giản (bóc ID thừa) để tiết kiệm
 * token, ghép System Prompt + (history) + câu hỏi user thành mảng messages.
 */

import { createHash } from 'crypto';
import type { MonthlyFinancialSnapshot } from '../aggregation/types';
import { LORD_DIAMOND_SYSTEM_PROMPT } from './systemPrompts';
import type { LLMMessage } from './types';

export interface ConversationTurn {
  userMessage: string;
  assistantMessage: string;
}

export interface BuildMessagesArgs {
  snapshot: MonthlyFinancialSnapshot;
  userMessage: string;
  intent: string;
  /** Lịch sử hội thoại ngắn (Phase 4 sẽ truyền vào). */
  history?: ConversationTurn[];
  /** Hồ sơ dài hạn (Phase 5) — nạp ở turn đầu. */
  longTermProfile?: string | null;
}

/**
 * Watermark ẩn truy vết nguồn (Phase 5). Chèn vào sâu system prompt — nếu prompt
 * bị leak ra log, ta truy ngược được uid gốc. Không ảnh hưởng ngữ cảnh AI.
 */
export function buildOriginWatermark(uid: string): string {
  if (!uid) return '';
  const hash = createHash('md5').update(uid).digest('hex').slice(0, 8);
  return `[origin-verify:manicash-${hash}]`;
}

/** Bóc snapshot xuống dạng nhẹ — bỏ uid, các id, field rỗng để LLM đọc nhanh. */
export function compactSnapshot(s: MonthlyFinancialSnapshot): Record<string, unknown> {
  const compact: Record<string, unknown> = {
    month: s.meta.monthKey,
    day: s.meta.dayOfMonth,
    daysLeft: Math.max(0, s.meta.daysInMonth - s.meta.dayOfMonth + 1),
    cashflow: {
      income: s.cashflow.income,
      expense: s.cashflow.expense,
      net: s.cashflow.net,
      savings: s.cashflow.savings,
      savingsRate: s.cashflow.savingsRate,
    },
    wallets: { main: s.wallets.main, emergency: s.wallets.emergency, billFund: s.wallets.billFund, total: s.wallets.total },
    budget: {
      total: s.budget.monthlyBudgetTotal,
      spent: s.budget.spentSoFar,
      safeToSpend: s.budget.safeToSpend,
      safeToSpendPerDay: s.budget.safeToSpendPerDay,
      overBudgetCount: s.budget.categoriesOverBudget,
    },
    health: { score: s.health.score, tier: s.health.tier },
  };

  const unpaidBills = s.bills.items.filter((b) => b.status !== 'paid');
  if (unpaidBills.length > 0) {
    compact.billsUnpaid = unpaidBills.map((b) => ({ name: b.name, amount: b.amount, status: b.status }));
  }
  if (s.categories.topBySpend.length > 0) {
    compact.topSpend = s.categories.topBySpend.map((c) => ({
      name: c.name,
      spent: c.spent,
      limit: c.limit,
      over: c.overBy,
    }));
  }
  if (s.categories.anomalies.length > 0) {
    compact.anomalies = s.categories.anomalies.map((a) => ({
      name: a.name,
      thisMonth: a.thisMonth,
      avg3mo: a.avgPrev,
      z: a.zScore,
    }));
  }
  if (s.goals.atRisk.length > 0) {
    compact.goalsAtRisk = s.goals.atRisk.map((g) => ({
      name: g.name,
      saved: g.savedAmount,
      target: g.targetAmount,
      pctDone: Math.round(g.percent * 100),
      monthsAtPace: g.monthsToCompleteAtPace,
    }));
  }
  if (s.tasks.activeCount > 0 || s.tasks.completedCount > 0) {
    compact.tasks = { active: s.tasks.activeCount, done: s.tasks.completedCount };
  }

  return compact;
}

export function buildLLMMessages(args: BuildMessagesArgs): LLMMessage[] {
  const compact = compactSnapshot(args.snapshot);

  const profileBlock = args.longTermProfile
    ? `\n\n# Hồ sơ dài hạn người dùng (tham khảo, có thể đã cũ):\n${args.longTermProfile}`
    : '';
  const watermark = buildOriginWatermark(args.snapshot.meta.uid);

  const messages: LLMMessage[] = [
    { role: 'system', content: LORD_DIAMOND_SYSTEM_PROMPT },
    {
      role: 'system',
      content:
        `# CONTEXT (dữ liệu tài chính tháng ${compact.month})\n` +
        '```json\n' +
        JSON.stringify(compact) +
        '\n```\n' +
        `\n# Intent người dùng: ${args.intent}` +
        profileBlock +
        (watermark ? `\n\n${watermark}` : ''),
    },
  ];

  for (const turn of args.history ?? []) {
    messages.push({ role: 'user', content: turn.userMessage });
    messages.push({ role: 'assistant', content: turn.assistantMessage });
  }

  messages.push({ role: 'user', content: args.userMessage });
  return messages;
}
