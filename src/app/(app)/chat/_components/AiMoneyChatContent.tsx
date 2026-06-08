'use client';

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  Check,
  Lock,
  Moon,
  Plus,
  Scale,
  Send,
  Sun,
  Target,
  Trash2,
} from 'lucide-react';
import { INCOME_CATEGORIES, type CategoryItem } from '@/data/categories';
import { createBalanceReconciliationReport } from '@/lib/aiMoneyChat/balanceReconciliation';
import { requestAiMoneyFallback } from '@/lib/aiMoneyChat/clientFallback';
import { shouldRequestAiFallback } from '@/lib/aiMoneyChat/aiFallback';
import { createDailyCheckIn, type DailyCheckInSlot } from '@/lib/aiMoneyChat/dailyCheckin';
import { createMoneyReaction } from '@/lib/aiMoneyChat/moneyReaction';
import { parseMoneyText } from '@/lib/aiMoneyChat/parser';
import { classifyIntent } from '@/lib/aiMoneyChat/intent/intentClassifier';
import { buildClientSnapshot } from '@/lib/aiMoneyChat/clientSnapshot';
import { sendChatMessage } from '@/lib/aiMoneyChat/chatClient';
import {
  buildEarningTaskDates,
  detectEarningIntent,
  parseEarningPlan,
  type ParsedEarningPlan,
} from '@/lib/aiMoneyChat/earningPlanner';
import { recordConfirmedMoneyIntent } from '@/lib/aiMoneyChat/recordIntent';
import { trackEvent } from '@/lib/analytics/events';
import type { ConfirmedMoneyIntent, ParsedMoneyIntent } from '@/lib/aiMoneyChat/types';
import { useAiMoneyMemoryStore } from '@/stores/useAiMoneyMemoryStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useFinanceStore, type TxnType, type WalletType } from '@/stores/useFinanceStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import './ai-money-chat.css';

interface AiMoneyChatContentProps {
  enabled: boolean;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  /** True nếu text là markdown (báo cáo CFO từ /api/chat) -> render định dạng. */
  markdown?: boolean;
}

interface DraftForm {
  type: TxnType;
  amount: string;
  categoryId: string;
  wallet: WalletType;
  note: string;
  date: string;
}

interface ReconciliationForm {
  income: string;
  expense: string;
  saving: string;
}

interface EarningDraftForm {
  name: string;
  amount: string;
  durationDays: string;
  subTasks: string[];
  confidence: ParsedEarningPlan['confidence'];
}

const EXAMPLES = [
  'mua tra sua 50k',
  'nhan luong 20tr',
  'toi con bao nhieu tien',
  'tien dien dong chua',
  'len bao cao CFO thang nay',
];

function makeMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN');
}

/** Format a Date as YYYY-MM-DD in LOCAL time (not UTC). Avoids timezone off-by-one. */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayInputValue(): string {
  return toLocalISODate(new Date());
}

function getDateConstraints() {
  const now = new Date();
  return {
    max: toLocalISODate(now),
    min: toLocalISODate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
  };
}

function makeDraftFromIntent(intent: ParsedMoneyIntent): DraftForm {
  const type = intent.type && intent.type !== 'transfer' ? intent.type : 'expense';

  return {
    type,
    amount: intent.amount ? formatVnd(intent.amount.value) : '',
    categoryId: intent.category?.categoryId ?? (type === 'income' ? 'other-in' : 'other'),
    wallet: intent.accountMapping?.legacyWallet ?? 'main',
    note: intent.note ?? intent.rawText,
    date: intent.occurredAt ? intent.occurredAt.substring(0, 10) : getTodayInputValue(),
  };
}

function parseAmountInput(value: string): number {
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
}

/** Render inline **bold** trong 1 dòng. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

/** Markdown nhẹ cho báo cáo CFO: ## heading, - bullet, **bold**. */
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 6 }} aria-hidden="true" />;
        if (trimmed.startsWith('## ')) {
          return (
            <p key={i} style={{ fontWeight: 700, marginTop: i === 0 ? 0 : 8 }}>
              {renderInline(trimmed.slice(3))}
            </p>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <p key={i} style={{ paddingLeft: 10 }}>
              • {renderInline(trimmed.slice(2))}
            </p>
          );
        }
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="tg-msg tg-msg-assistant">
      <div className="tg-msg-avatar" aria-hidden="true">LD</div>
      <div className="tg-bubble tg-bubble-typing">
        <span className="tg-typing-dot" />
        <span className="tg-typing-dot" />
        <span className="tg-typing-dot" />
      </div>
    </div>
  );
}

export default function AiMoneyChatContent({ enabled }: AiMoneyChatContentProps) {
  const expenseCategories = useCategoryStore((s) => s.expenseCategories);
  const memoryRuleCount = useAiMoneyMemoryStore((s) => s.rules.length);
  const applyMemoryToIntent = useAiMoneyMemoryStore((s) => s.applyMemoryToIntent);
  const addMemoryCorrection = useAiMoneyMemoryStore((s) => s.addCorrection);
  const goals = useGoalsStore((s) => s.goals);
  const userProfile = useAuthStore((s) => s.user);
  const transactions = useFinanceStore((s) => s.transactions);
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const emergencyBalance = useFinanceStore((s) => s.emergencyBalance);
  const earningTasks = useTaskStore((s) => s.tasks);
  const dashboardAccounts = useDashboardStore((s) => s.accounts);
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const currentBudgetMonth = useBudgetStore((s) => s.currentMonth);
  const carryOver = useBudgetStore((s) => s.carryOver);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Tôi là Lord Diamond. Hãy nhập giao dịch ("mua trà sữa 50k"), hỏi số liệu ("tôi còn bao nhiêu tiền", "tiền điện đóng chưa") hay yêu cầu phân tích ("lên báo cáo CFO tháng này").',
    },
  ]);
  const [draftIntent, setDraftIntent] = useState<ParsedMoneyIntent | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [reconciliationForm, setReconciliationForm] = useState<ReconciliationForm | null>(null);
  const [earningDraft, setEarningDraft] = useState<EarningDraftForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAiFallbackLoading, setIsAiFallbackLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const addEarningTask = useTaskStore((s) => s.addTask);
  const threadRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  // Session ID ổn định cho hội thoại CFO follow-up (Phase 4 conversation state).
  const sessionIdRef = useRef<string>(makeMessageId('sess'));

  const dateConstraints = useMemo(() => getDateConstraints(), []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isAiFallbackLoading, isChatLoading]);

  const categories: CategoryItem[] = useMemo(() => {
    if (!draftForm) return expenseCategories;
    return draftForm.type === 'income' ? INCOME_CATEGORIES : expenseCategories;
  }, [draftForm, expenseCategories]);

  // Map categoryId -> tên hiển thị (gộp expense + income) cho clientSnapshot.
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of expenseCategories) map.set(c.id, c.name);
    for (const c of INCOME_CATEGORIES) map.set(c.id, c.name);
    return map;
  }, [expenseCategories]);

  const monthlySpendingLimit = useMemo(() => {
    return categoryBudgets
      .filter((budget) => budget.month === currentBudgetMonth)
      .reduce((sum, budget) => sum + budget.monthlyLimit, 0);
  }, [categoryBudgets, currentBudgetMonth]);

  const fixedBillsTotal = useMemo(() => {
    return fixedBills.reduce((sum, bill) => sum + bill.amount, 0);
  }, [fixedBills]);

  const appAccountBalances = useMemo(() => {
    const saving =
      dashboardAccounts.reserve.balance +
      dashboardAccounts.goals.balance +
      dashboardAccounts.investment.balance;

    return {
      income: dashboardAccounts.income.balance,
      expense: dashboardAccounts.spending.balance + dashboardAccounts.fixed_bills.balance,
      saving,
    };
  }, [dashboardAccounts]);

  const canConfirm = Boolean(
    enabled &&
    draftIntent &&
    draftForm &&
    draftForm.type !== 'transfer' &&
    parseAmountInput(draftForm.amount) > 0 &&
    draftForm.categoryId,
  );

  function appendMessages(nextMessages: ChatMessage[]) {
    setMessages((current) => [...current, ...nextMessages]);
  }

  function buildAssistantText(intent: ParsedMoneyIntent): string {
    if (!intent.amount) {
      return 'Tôi chưa thấy số tiền trong câu này. Hãy thử lại với ví dụ: mua đậu hũ 20k.';
    }

    const typeLabel = intent.type === 'income' ? 'thu nhập' : intent.type === 'transfer' ? 'chuyển quỹ' : 'chi tiêu';
    const categoryLabel = intent.category?.categoryName || intent.category?.categoryId || 'chưa rõ';
    const sourceLabel = intent.source === 'memory' ? ' Tôi dùng trí nhớ local từ lần sửa trước.' : '';
    const aiLabel = intent.source === 'ai_fallback' ? ' Tôi đã dùng AI fallback vì local parser không chắc.' : '';
    return `Tôi đọc được: ${typeLabel}, ${formatVnd(intent.amount.value)} VND, danh mục ${categoryLabel}.${sourceLabel}${aiLabel} Hãy kiểm tra lại trước khi lưu.`;
  }

  function setDraftFromIntent(intent: ParsedMoneyIntent) {
    setEarningDraft(null);
    if (intent.amount && intent.type !== 'transfer') {
      setDraftIntent(intent);
      setDraftForm(makeDraftFromIntent(intent));
    } else {
      setDraftIntent(null);
      setDraftForm(null);
    }
  }

  async function maybeApplyAiFallback(text: string, localIntent: ParsedMoneyIntent) {
    if (!shouldRequestAiFallback(localIntent)) return;

    setIsAiFallbackLoading(true);
    const result = await requestAiMoneyFallback(text, localIntent);
    setIsAiFallbackLoading(false);
    trackEvent('ai_fallback', { source: result.source, applied: result.intent != null });

    if (result.intent) {
      appendMessages([
        { id: makeMessageId('assistant'), role: 'assistant', text: buildAssistantText(result.intent) },
      ]);
      setDraftFromIntent(result.intent);
      return;
    }

    appendMessages([
      {
        id: makeMessageId('system'),
        role: 'system',
        text: `AI fallback không dùng được (${result.source}). Tôi giữ bản nhập local để bạn tự xác nhận.`,
      },
    ]);
  }

  function currentClientSnapshot() {
    return buildClientSnapshot({
      wallets: { main: mainBalance, emergency: emergencyBalance, billFund: billFundBalance },
      transactions,
      fixedBills,
      tasks: earningTasks,
      goals,
      categoryBudgets,
      categoryName: (id) => categoryNameMap.get(id) ?? id,
      carryOver,
      user: userProfile
        ? {
            rank: userProfile.rank,
            xp: userProfile.xp,
            streak: userProfile.streak,
            streakShields: userProfile.streakShields,
          }
        : undefined,
    });
  }

  /** Gửi câu truy vấn/phân tích sang /api/chat (số dư, hóa đơn, nhiệm vụ, CFO...). */
  async function askAssistant(text: string) {
    appendMessages([{ id: makeMessageId('user'), role: 'user', text }]);
    setInput('');
    setError(null);
    setIsChatLoading(true);

    const result = await sendChatMessage({
      message: text,
      sessionId: sessionIdRef.current,
      clientSnapshot: currentClientSnapshot(),
    });

    setIsChatLoading(false);
    trackEvent('chat_parse', {
      mode: 'assistant',
      intent: result.intentType ?? 'unknown',
      source: result.reply?.meta.source ?? result.error ?? 'error',
    });

    if (result.ok && result.reply) {
      appendMessages([
        { id: makeMessageId('assistant'), role: 'assistant', text: result.reply.message, markdown: true },
      ]);
      return;
    }

    const errorText =
      result.error === 'unauthorized'
        ? 'Bạn cần đăng nhập lại để dùng trợ lý tài chính.'
        : result.error === 'license'
          ? 'Dịch vụ tạm thời khoá. Vui lòng thử lại sau.'
          : result.reply?.message ?? 'Trợ lý tạm thời bận. Bạn thử lại sau nhé.';
    appendMessages([{ id: makeMessageId('system'), role: 'system', text: errorText }]);
  }

  function parseInput(rawText: string) {
    const text = rawText.trim();
    if (!text) return;

    // Earning-plan intent takes priority over transaction parsing.
    if (detectEarningIntent(text)) {
      const plan = parseEarningPlan(text);
      trackEvent('chat_parse', { mode: 'earning', confidence: plan.confidence, hasAmount: plan.expectedAmount != null });
      setReconciliationForm(null);
      setDraftIntent(null);
      setDraftForm(null);
      setEarningDraft({
        name: plan.name,
        amount: plan.expectedAmount ? formatVnd(plan.expectedAmount) : '',
        durationDays: String(plan.durationDays),
        subTasks: plan.suggestedSubTasks,
        confidence: plan.confidence,
      });
      appendMessages([
        { id: makeMessageId('user'), role: 'user', text },
        {
          id: makeMessageId('assistant'),
          role: 'assistant',
          text: `Nghe như một kế hoạch kiếm tiền! Tôi đã phác thảo nhiệm vụ "${plan.name}"${
            plan.expectedAmount ? ` mục tiêu ${formatVnd(plan.expectedAmount)} VND` : ''
          } trong ${plan.durationDays} ngày, kèm ${plan.suggestedSubTasks.length} bước nhỏ. Chỉnh lại rồi bấm tạo nhé.`,
        },
      ]);
      setInput('');
      setError(null);
      return;
    }

    // Phân loại: chỉ NHẬP LIỆU giao dịch mới chạy local (confirm card + memory);
    // còn lại (truy vấn số dư/hóa đơn/nhiệm vụ, báo cáo CFO, follow-up) -> /api/chat.
    // Điều kiện LOG: classifier nói LOG_TRANSACTION VÀ parser bóc được số tiền thật
    // (tránh số lẻ như "1 tháng" bị nhận nhầm là giao dịch).
    const intent = applyMemoryToIntent(parseMoneyText(text));
    const isLogTransaction = classifyIntent(text).type === 'LOG_TRANSACTION' && intent.amount != null;
    if (!isLogTransaction) {
      void askAssistant(text);
      return;
    }

    trackEvent('chat_parse', {
      mode: 'money',
      confidence: intent.confidence,
      hasAmount: intent.amount != null,
      source: intent.source,
      type: intent.type ?? 'unknown',
    });
    appendMessages([
      { id: makeMessageId('user'), role: 'user', text },
      { id: makeMessageId('assistant'), role: 'assistant', text: buildAssistantText(intent) },
    ]);

    setDraftFromIntent(intent);
    void maybeApplyAiFallback(text, intent);

    setInput('');
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    parseInput(input);
  }

  function handleExample(example: string) {
    if (!enabled) return;
    parseInput(example);
  }

  function handleDailyCheckIn(slot: DailyCheckInSlot) {
    if (!enabled) return;

    const checkIn = createDailyCheckIn({
      slot,
      transactions,
      monthlySpendingLimit,
      carryOver,
      fixedBillsTotal,
      billFundBalance,
      goals: goals.map((goal) => ({
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
      })),
    });

    appendMessages([
      {
        id: makeMessageId('assistant'),
        role: 'assistant',
        text: checkIn.message,
      },
    ]);
  }

  function updateDraft(updates: Partial<DraftForm>) {
    setDraftForm((current) => {
      if (!current) return current;
      const next = { ...current, ...updates };
      if (updates.type) {
        const nextCategories = updates.type === 'income' ? INCOME_CATEGORIES : expenseCategories;
        const exists = nextCategories.some((category) => category.id === next.categoryId);
        if (!exists) {
          next.categoryId = updates.type === 'income' ? 'other-in' : 'other';
        }
      }
      return next;
    });
  }

  function handleAmountChange(value: string) {
    const raw = value.replace(/\D/g, '');
    updateDraft({ amount: raw ? formatVnd(parseInt(raw, 10)) : '' });
  }

  function openReconciliationForm() {
    if (!enabled) return;
    setDraftIntent(null);
    setDraftForm(null);
    setEarningDraft(null);
    setError(null);
    setReconciliationForm({
      income: formatVnd(appAccountBalances.income),
      expense: formatVnd(appAccountBalances.expense),
      saving: formatVnd(appAccountBalances.saving),
    });
    appendMessages([
      {
        id: makeMessageId('assistant'),
        role: 'assistant',
        text: 'Nhập số dư thực tế trên ngân hàng cho 3 tài khoản. Tôi sẽ so với số đang lưu trong ManiCash và báo lệch ở đâu.',
      },
    ]);
  }

  function updateReconciliationForm(key: keyof ReconciliationForm, value: string) {
    const raw = value.replace(/\D/g, '');
    setReconciliationForm((current) => {
      if (!current) return current;
      return { ...current, [key]: raw ? formatVnd(parseInt(raw, 10)) : '' };
    });
  }

  function handleCancelReconciliation() {
    setReconciliationForm(null);
    setError(null);
    appendMessages([
      { id: makeMessageId('system'), role: 'system', text: 'Đã huỷ đối chiếu số dư.' },
    ]);
  }

  function handleConfirmReconciliation() {
    if (!reconciliationForm) return;

    const report = createBalanceReconciliationReport([
      {
        id: 'income',
        label: 'Tài khoản thu nhập',
        appBalance: appAccountBalances.income,
        bankBalance: parseAmountInput(reconciliationForm.income),
      },
      {
        id: 'expense',
        label: 'Tài khoản chi tiêu',
        appBalance: appAccountBalances.expense,
        bankBalance: parseAmountInput(reconciliationForm.expense),
      },
      {
        id: 'saving',
        label: 'Tài khoản tiết kiệm',
        appBalance: appAccountBalances.saving,
        bankBalance: parseAmountInput(reconciliationForm.saving),
      },
    ]);

    trackEvent('reconciliation_check', { status: report.status });
    appendMessages([
      {
        id: makeMessageId('assistant'),
        role: 'assistant',
        text: report.message,
      },
    ]);
    setReconciliationForm(null);
    setError(null);
  }

  function handleCancelDraft() {
    setDraftIntent(null);
    setDraftForm(null);
    setError(null);
    appendMessages([
      { id: makeMessageId('system'), role: 'system', text: 'Đã huỷ bản nhập này.' },
    ]);
  }

  function handleConfirmDraft() {
    if (!draftIntent || !draftForm) return;

    const amount = parseAmountInput(draftForm.amount);
    if (!amount || !draftForm.categoryId) {
      setError('Hãy kiểm tra lại số tiền và danh mục trước khi lưu.');
      return;
    }

    const confirmed: ConfirmedMoneyIntent = {
      parsedIntentId: draftIntent.id,
      type: draftForm.type,
      amount,
      categoryId: draftForm.categoryId,
      note: draftForm.note.trim() || draftIntent.rawText,
      wallet: draftForm.wallet,
      occurredAt: new Date(`${draftForm.date}T12:00:00`).toISOString(),
      tags: draftIntent.tags,
    };

    try {
      const result = recordConfirmedMoneyIntent(confirmed);
      const reaction = createMoneyReaction({
        type: confirmed.type,
        amount: confirmed.amount,
        categoryId: confirmed.categoryId,
        note: confirmed.note,
        goals: goals.map((goal) => ({
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
        })),
      });
      const originalCategoryId = draftIntent.category?.categoryId;
      const corrected = Boolean(
        confirmed.type !== 'transfer' &&
        originalCategoryId &&
        confirmed.categoryId !== originalCategoryId,
      );
      if (corrected && confirmed.type !== 'transfer') {
        addMemoryCorrection({
          rawText: draftIntent.rawText,
          type: confirmed.type,
          categoryId: confirmed.categoryId,
        });
        trackEvent('chat_correction', { from: originalCategoryId ?? 'none', to: confirmed.categoryId });
      }
      trackEvent('chat_confirm', { type: confirmed.type, corrected });
      const typeLabel = confirmed.type === 'income' ? 'thu nhập' : 'chi tiêu';
      appendMessages([
        {
          id: makeMessageId('system'),
          role: 'system',
          text: `Đã lưu ${typeLabel} ${formatVnd(confirmed.amount)} VND vào sổ sách. Mã giao dịch: ${result.transaction.id}.`,
        },
        {
          id: makeMessageId('assistant'),
          role: 'assistant',
          text: reaction.actionHint ? `${reaction.text} ${reaction.actionHint}` : reaction.text,
        },
      ]);
      setDraftIntent(null);
      setDraftForm(null);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được giao dịch.');
    }
  }

  function updateEarningDraft(updates: Partial<EarningDraftForm>) {
    setEarningDraft((current) => (current ? { ...current, ...updates } : current));
  }

  function handleEarningAmountChange(value: string) {
    const raw = value.replace(/\D/g, '');
    updateEarningDraft({ amount: raw ? formatVnd(parseInt(raw, 10)) : '' });
  }

  function handleEarningSubTaskChange(index: number, value: string) {
    setEarningDraft((current) => {
      if (!current) return current;
      const subTasks = [...current.subTasks];
      subTasks[index] = value;
      return { ...current, subTasks };
    });
  }

  function handleEarningSubTaskRemove(index: number) {
    setEarningDraft((current) => {
      if (!current) return current;
      return { ...current, subTasks: current.subTasks.filter((_, i) => i !== index) };
    });
  }

  function handleEarningSubTaskAdd() {
    setEarningDraft((current) => {
      if (!current) return current;
      return { ...current, subTasks: [...current.subTasks, ''] };
    });
  }

  function handleCancelEarning() {
    setEarningDraft(null);
    setError(null);
    appendMessages([
      { id: makeMessageId('system'), role: 'system', text: 'Đã huỷ kế hoạch kiếm tiền này.' },
    ]);
  }

  function handleConfirmEarning() {
    if (!earningDraft) return;

    const name = earningDraft.name.trim();
    const expectedAmount = parseAmountInput(earningDraft.amount);
    const durationDays = Math.max(1, parseInt(earningDraft.durationDays, 10) || 7);

    if (!name) {
      setError('Hãy đặt tên cho nhiệm vụ kiếm tiền.');
      return;
    }
    if (expectedAmount <= 0) {
      setError('Hãy nhập mục tiêu thu nhập (lớn hơn 0).');
      return;
    }

    const { startDate, endDate } = buildEarningTaskDates(durationDays);
    const subTasks = earningDraft.subTasks
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ({ name: title }));

    addEarningTask({ name, expectedAmount, startDate, endDate, subTasks });
    trackEvent('earning_task_created', { durationDays, subTaskCount: subTasks.length, expectedAmount });

    appendMessages([
      {
        id: makeMessageId('system'),
        role: 'system',
        text: `Đã tạo nhiệm vụ "${name}" — mục tiêu ${formatVnd(expectedAmount)} VND trong ${durationDays} ngày, ${subTasks.length} bước. Xem ở tab Money.`,
      },
      {
        id: makeMessageId('assistant'),
        role: 'assistant',
        text: 'Tuyệt vời, cậu chủ! Cứ tick từng bước nhỏ, hoàn thành sớm còn được thưởng XP. Ta tin cậu sẽ cán mốc này. 💎',
      },
    ]);
    setEarningDraft(null);
    setError(null);
  }

  const canConfirmEarning = Boolean(
    enabled &&
    earningDraft &&
    earningDraft.name.trim() &&
    parseAmountInput(earningDraft.amount) > 0,
  );

  const activePanel: 'confirm' | 'reconcile' | 'earning' | null =
    draftIntent && draftForm ? 'confirm' : reconciliationForm ? 'reconcile' : earningDraft ? 'earning' : null;
  const panelOpen = activePanel !== null;
  const panelTitle =
    activePanel === 'confirm'
      ? draftForm?.type === 'income' ? 'Xác nhận thu nhập' : 'Xác nhận chi tiêu'
      : activePanel === 'reconcile'
        ? 'Đối chiếu số dư'
        : activePanel === 'earning'
          ? 'Tạo nhiệm vụ kiếm tiền'
          : '';

  function handlePanelBack() {
    if (activePanel === 'confirm') handleCancelDraft();
    else if (activePanel === 'reconcile') handleCancelReconciliation();
    else if (activePanel === 'earning') handleCancelEarning();
  }

  const ease = [0.16, 1, 0.3, 1] as const;
  const baseTransition = { duration: prefersReduced ? 0 : 0.32, ease };
  const panelTransition = { duration: prefersReduced ? 0 : 0.34, ease };

  return (
    <div className="tg-chat">
      <motion.div
        className="tg-base"
        animate={{ x: panelOpen ? '-16%' : '0%' }}
        transition={baseTransition}
        style={{ pointerEvents: panelOpen ? 'none' : 'auto' }}
      >
        <header className="tg-header">
          <div className="tg-header-avatar" aria-hidden="true">LD</div>
          <div className="tg-header-meta">
            <strong>Lord Diamond</strong>
            <span className="tg-header-sub">
              <i className="tg-status-dot" aria-hidden="true" />
              Quản gia tài chính{memoryRuleCount > 0 ? ` · nhớ ${memoryRuleCount} thói quen` : ''}
            </span>
          </div>
        </header>

        {!enabled && (
          <div className="tg-disabled">
            <Lock size={15} />
            <span>Chat đang tắt. Bật <code>NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true</code> để dùng.</span>
          </div>
        )}

        <div className="tg-thread" ref={threadRef}>
          {messages.map((message) => (
            <div key={message.id} className={`tg-msg tg-msg-${message.role}`}>
              {message.role !== 'user' && (
                <div className="tg-msg-avatar" aria-hidden="true">
                  {message.role === 'assistant' ? 'LD' : <Check size={13} />}
                </div>
              )}
              <div className="tg-bubble">
                {message.markdown ? <FormattedText text={message.text} /> : <p>{message.text}</p>}
              </div>
            </div>
          ))}
          {(isAiFallbackLoading || isChatLoading) && <TypingIndicator />}
        </div>

        <div className="tg-quick" aria-label="Hành động nhanh">
          <button type="button" className="tg-chip tg-chip-action" disabled={!enabled} onClick={() => handleDailyCheckIn('midday')}>
            <Sun size={14} /> Báo cáo trưa
          </button>
          <button type="button" className="tg-chip tg-chip-action" disabled={!enabled} onClick={() => handleDailyCheckIn('evening')}>
            <Moon size={14} /> Tổng kết tối
          </button>
          <button type="button" className="tg-chip tg-chip-action" disabled={!enabled} onClick={openReconciliationForm}>
            <Scale size={14} /> Đối chiếu số dư
          </button>
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="tg-chip" disabled={!enabled} onClick={() => handleExample(example)}>
              {example}
            </button>
          ))}
        </div>

        <form className="tg-composer" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nhập giao dịch, vd: mua đậu hũ 20k"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!enabled}
            aria-label="Nhập giao dịch bằng ngôn ngữ tự nhiên"
          />
          <button type="submit" className="tg-send" disabled={!enabled || !input.trim()} aria-label="Gửi">
            <Send size={18} />
          </button>
        </form>
      </motion.div>

      <AnimatePresence>
        {panelOpen && (
          <motion.section
            key={activePanel}
            className="tg-panel"
            aria-label={panelTitle}
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={panelTransition}
          >
            <header className="tg-panel-header">
              <button type="button" className="tg-back" onClick={handlePanelBack}>
                <ChevronLeft size={20} />
                <span>Quay lại</span>
              </button>
              <h2>{panelTitle}</h2>
              {activePanel === 'confirm' && draftIntent && (
                <span className={`tg-confidence tg-confidence-${draftIntent.confidence}`}>{draftIntent.confidence}</span>
              )}
            </header>

            <div className="tg-panel-body">
              {activePanel === 'confirm' && draftIntent && draftForm && (
                <>
                  {draftForm.amount && (
                    <div className="tg-amount">
                      <span className={`tg-amount-value ${draftForm.type === 'income' ? 'is-income' : 'is-expense'}`}>
                        {draftForm.type === 'income' ? '+' : '−'}{draftForm.amount}
                      </span>
                      <span className="tg-amount-cur">VND</span>
                    </div>
                  )}

                  <div className="tg-fields">
                    <label>
                      <span>Loại</span>
                      <select value={draftForm.type} onChange={(event) => updateDraft({ type: event.target.value as TxnType })}>
                        <option value="expense">Chi tiêu</option>
                        <option value="income">Thu nhập</option>
                      </select>
                    </label>

                    <label>
                      <span>Số tiền</span>
                      <input value={draftForm.amount} inputMode="numeric" onChange={(event) => handleAmountChange(event.target.value)} />
                    </label>

                    <label>
                      <span>Danh mục</span>
                      <select value={draftForm.categoryId} onChange={(event) => updateDraft({ categoryId: event.target.value })}>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Ví</span>
                      <select value={draftForm.wallet} onChange={(event) => updateDraft({ wallet: event.target.value as WalletType })}>
                        <option value="main">Ví chính</option>
                        <option value="emergency">Quỹ dự phòng</option>
                      </select>
                    </label>

                    <label>
                      <span>Ngày</span>
                      <input
                        type="date"
                        value={draftForm.date}
                        min={dateConstraints.min}
                        max={dateConstraints.max}
                        onChange={(event) => updateDraft({ date: event.target.value })}
                      />
                    </label>

                    <label className="tg-field-wide">
                      <span>Ghi chú</span>
                      <input value={draftForm.note} onChange={(event) => updateDraft({ note: event.target.value })} />
                    </label>
                  </div>

                  {draftIntent.category?.alternatives && draftIntent.category.alternatives.length > 0 && (
                    <div className="tg-alts">
                      <span>Gợi ý khác</span>
                      {draftIntent.category.alternatives.map((alternative) => (
                        <button key={alternative.categoryId} type="button" onClick={() => updateDraft({ categoryId: alternative.categoryId })}>
                          {alternative.categoryName || alternative.categoryId}
                        </button>
                      ))}
                    </div>
                  )}

                  {error && <p className="tg-error">{error}</p>}
                </>
              )}

              {activePanel === 'reconcile' && reconciliationForm && (
                <>
                  <div className="tg-reconcile">
                    <label>
                      <span>Tài khoản thu nhập</span>
                      <small>ManiCash: {formatVnd(appAccountBalances.income)} VND</small>
                      <input value={reconciliationForm.income} inputMode="numeric" onChange={(event) => updateReconciliationForm('income', event.target.value)} />
                    </label>
                    <label>
                      <span>Tài khoản chi tiêu</span>
                      <small>ManiCash: {formatVnd(appAccountBalances.expense)} VND</small>
                      <input value={reconciliationForm.expense} inputMode="numeric" onChange={(event) => updateReconciliationForm('expense', event.target.value)} />
                    </label>
                    <label>
                      <span>Tài khoản tiết kiệm</span>
                      <small>ManiCash: {formatVnd(appAccountBalances.saving)} VND</small>
                      <input value={reconciliationForm.saving} inputMode="numeric" onChange={(event) => updateReconciliationForm('saving', event.target.value)} />
                    </label>
                  </div>
                  <p className="tg-note">Bước này chỉ kiểm tra lệch số dư, chưa tự động sửa tiền trong app.</p>
                </>
              )}

              {activePanel === 'earning' && earningDraft && (
                <>
                  <div className="tg-fields">
                    <label className="tg-field-wide">
                      <span>Tên nhiệm vụ</span>
                      <input value={earningDraft.name} onChange={(event) => updateEarningDraft({ name: event.target.value })} />
                    </label>
                    <label>
                      <span>Mục tiêu thu nhập</span>
                      <input value={earningDraft.amount} inputMode="numeric" onChange={(event) => handleEarningAmountChange(event.target.value)} />
                    </label>
                    <label>
                      <span>Số ngày</span>
                      <input value={earningDraft.durationDays} inputMode="numeric" onChange={(event) => updateEarningDraft({ durationDays: event.target.value.replace(/\D/g, '') })} />
                    </label>
                  </div>

                  <div className="tg-subtasks">
                    <span className="tg-subtasks-title">Các bước nhỏ</span>
                    {earningDraft.subTasks.map((subTask, index) => (
                      <div key={index} className="tg-subtask-row">
                        <Check size={14} className="tg-subtask-icon" />
                        <input value={subTask} placeholder="Mô tả bước này" onChange={(event) => handleEarningSubTaskChange(index, event.target.value)} />
                        <button type="button" className="tg-subtask-remove" aria-label="Xoá bước" onClick={() => handleEarningSubTaskRemove(index)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="tg-subtask-add" onClick={handleEarningSubTaskAdd}>
                      <Plus size={14} /> Thêm bước
                    </button>
                  </div>

                  {error && <p className="tg-error">{error}</p>}
                </>
              )}
            </div>

            <footer className="tg-panel-footer">
              {activePanel === 'confirm' && (
                <button type="button" className="tg-primary" disabled={!canConfirm} onClick={handleConfirmDraft}>
                  <Check size={18} /> Xác nhận lưu
                </button>
              )}
              {activePanel === 'reconcile' && (
                <button type="button" className="tg-primary" onClick={handleConfirmReconciliation}>
                  <Scale size={18} /> Kiểm tra lệch
                </button>
              )}
              {activePanel === 'earning' && (
                <button type="button" className="tg-primary" disabled={!canConfirmEarning} onClick={handleConfirmEarning}>
                  <Target size={18} /> Tạo nhiệm vụ
                </button>
              )}
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
