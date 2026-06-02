'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Lock, MessageCircle, Plus, Send, ShieldCheck, Target, Trash2, X } from 'lucide-react';
import { INCOME_CATEGORIES, type CategoryItem } from '@/data/categories';
import { createBalanceReconciliationReport } from '@/lib/aiMoneyChat/balanceReconciliation';
import { requestAiMoneyFallback } from '@/lib/aiMoneyChat/clientFallback';
import { shouldRequestAiFallback } from '@/lib/aiMoneyChat/aiFallback';
import { createDailyCheckIn, type DailyCheckInSlot } from '@/lib/aiMoneyChat/dailyCheckin';
import { createMoneyReaction } from '@/lib/aiMoneyChat/moneyReaction';
import { parseMoneyText } from '@/lib/aiMoneyChat/parser';
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
import './ai-money-chat.css';

interface AiMoneyChatContentProps {
  enabled: boolean;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
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
  'di sieu thi het 1300k',
  'nhan luong 20tr',
  'lam freelance kiem 3tr trong 1 tuan',
];

function makeMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN');
}

function getTodayInputValue(): string {
  return new Date().toISOString().substring(0, 10);
}

function getDateConstraints() {
  const now = new Date();
  return {
    max: now.toISOString().substring(0, 10),
    min: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
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

function TypingIndicator() {
  return (
    <div className="ai-chat-typing">
      <div className="ai-chat-avatar ai-chat-avatar-ld" aria-hidden="true">LD</div>
      <div className="ai-chat-bubble ai-chat-bubble-typing">
        <span className="ai-typing-dot" />
        <span className="ai-typing-dot" />
        <span className="ai-typing-dot" />
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
  const transactions = useFinanceStore((s) => s.transactions);
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);
  const dashboardAccounts = useDashboardStore((s) => s.accounts);
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const currentBudgetMonth = useBudgetStore((s) => s.currentMonth);
  const carryOver = useBudgetStore((s) => s.carryOver);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Nhập một câu như "mua trà sữa 50k". Tôi sẽ tách số tiền, loại giao dịch và danh mục để bạn xác nhận trước khi lưu.',
    },
  ]);
  const [draftIntent, setDraftIntent] = useState<ParsedMoneyIntent | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [reconciliationForm, setReconciliationForm] = useState<ReconciliationForm | null>(null);
  const [earningDraft, setEarningDraft] = useState<EarningDraftForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAiFallbackLoading, setIsAiFallbackLoading] = useState(false);
  const addEarningTask = useTaskStore((s) => s.addTask);
  const threadRef = useRef<HTMLDivElement>(null);

  const dateConstraints = useMemo(() => getDateConstraints(), []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isAiFallbackLoading]);

  const categories: CategoryItem[] = useMemo(() => {
    if (!draftForm) return expenseCategories;
    return draftForm.type === 'income' ? INCOME_CATEGORIES : expenseCategories;
  }, [draftForm, expenseCategories]);

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

    const intent = applyMemoryToIntent(parseMoneyText(text));
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

  return (
    <div className="ai-chat-page">
      <section className="ai-chat-hero">
        <div className="ai-chat-hero-icon" aria-hidden="true">
          <Bot size={26} />
        </div>
        <div>
          <p className="ai-chat-kicker">Local parser beta</p>
          <h1>AI Money Chat</h1>
          <p className="ai-chat-lead">
            Nhập giao dịch bằng ngôn ngữ hàng ngày. ManiCash sẽ tách thông tin và cho bạn xác nhận trước khi lưu.
          </p>
          {memoryRuleCount > 0 && (
            <p className="ai-chat-memory-count">
              Trí nhớ local: {memoryRuleCount} quy tắc đã học
            </p>
          )}
        </div>
      </section>

      {!enabled && (
        <div className="ai-chat-disabled">
          <Lock size={18} />
          <span>Chat beta đang tắt trên môi trường này. Bật <code>NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true</code> để test.</span>
        </div>
      )}

      <section className="ai-chat-panel" aria-label="AI Money Chat beta">
        <div className="ai-chat-thread" ref={threadRef}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`ai-chat-message ai-chat-message-${message.role}`}
            >
              {message.role !== 'user' && (
                <div className={`ai-chat-avatar${message.role === 'assistant' ? ' ai-chat-avatar-ld' : ''}`}>
                  {message.role === 'assistant' ? <span>LD</span> : <Check size={14} />}
                </div>
              )}
              <div className="ai-chat-bubble">
                {message.role !== 'user' && (
                  <strong>{message.role === 'system' ? 'ManiCash' : 'Lord Diamond'}</strong>
                )}
                <p>{message.text}</p>
              </div>
            </div>
          ))}
          {isAiFallbackLoading && <TypingIndicator />}
        </div>

        <div className="ai-chat-examples" aria-label="Ví dụ">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" disabled={!enabled} onClick={() => handleExample(example)}>
              {example}
            </button>
          ))}
        </div>

        <div className="ai-chat-checkins" aria-label="Báo cáo nhanh">
          <span>Check-in nhanh</span>
          <button type="button" disabled={!enabled} onClick={() => handleDailyCheckIn('midday')}>
            Báo cáo trưa
          </button>
          <button type="button" disabled={!enabled} onClick={() => handleDailyCheckIn('evening')}>
            Tổng kết tối
          </button>
          <button type="button" disabled={!enabled} onClick={openReconciliationForm}>
            Đối chiếu số dư
          </button>
        </div>

        {draftIntent && draftForm && (
          <section className="ai-chat-confirm-card" aria-label="Xác nhận giao dịch">
            <div className="ai-chat-confirm-header">
              <div>
                <p className="ai-chat-kicker">Kiểm tra trước khi lưu</p>
                <h2>{draftForm.type === 'income' ? 'Thu nhập' : 'Chi tiêu'} mới</h2>
              </div>
              <span className={`ai-chat-confidence ai-chat-confidence-${draftIntent.confidence}`}>
                {draftIntent.confidence}
              </span>
            </div>

            {draftForm.amount && (
              <div className="ai-chat-amount-hero">
                <span className={`ai-chat-amount-value ${draftForm.type === 'income' ? 'is-income' : 'is-expense'}`}>
                  {draftForm.type === 'income' ? '+' : '−'}{draftForm.amount}
                </span>
                <span className="ai-chat-amount-currency">VND</span>
              </div>
            )}

            <div className="ai-chat-field-grid">
              <label>
                <span>Loại</span>
                <select
                  value={draftForm.type}
                  onChange={(event) => updateDraft({ type: event.target.value as TxnType })}
                >
                  <option value="expense">Chi tiêu</option>
                  <option value="income">Thu nhập</option>
                </select>
              </label>

              <label>
                <span>Số tiền</span>
                <input
                  value={draftForm.amount}
                  inputMode="numeric"
                  onChange={(event) => handleAmountChange(event.target.value)}
                />
              </label>

              <label>
                <span>Danh mục</span>
                <select
                  value={draftForm.categoryId}
                  onChange={(event) => updateDraft({ categoryId: event.target.value })}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Ví</span>
                <select
                  value={draftForm.wallet}
                  onChange={(event) => updateDraft({ wallet: event.target.value as WalletType })}
                >
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

              <label className="ai-chat-field-wide">
                <span>Ghi chú</span>
                <input
                  value={draftForm.note}
                  onChange={(event) => updateDraft({ note: event.target.value })}
                />
              </label>
            </div>

            {draftIntent.category?.alternatives && draftIntent.category.alternatives.length > 0 && (
              <div className="ai-chat-alternatives">
                <span>Gợi ý khác</span>
                {draftIntent.category.alternatives.map((alternative) => (
                  <button
                    key={alternative.categoryId}
                    type="button"
                    onClick={() => updateDraft({ categoryId: alternative.categoryId })}
                  >
                    {alternative.categoryName || alternative.categoryId}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="ai-chat-error">{error}</p>}

            <div className="ai-chat-confirm-actions">
              <button type="button" className="ai-chat-secondary-btn" onClick={handleCancelDraft}>
                <X size={16} />
                Huỷ
              </button>
              <button type="button" className="ai-chat-primary-btn" disabled={!canConfirm} onClick={handleConfirmDraft}>
                <Check size={16} />
                Xác nhận lưu
              </button>
            </div>
          </section>
        )}

        {reconciliationForm && (
          <section className="ai-chat-confirm-card" aria-label="Đối chiếu số dư">
            <div className="ai-chat-confirm-header">
              <div>
                <p className="ai-chat-kicker">Đối chiếu ngân hàng</p>
                <h2>Số dư 3 tài khoản</h2>
              </div>
              <span className="ai-chat-confidence ai-chat-confidence-medium">review</span>
            </div>

            <div className="ai-chat-reconcile-list">
              <label>
                <span>Tài khoản thu nhập</span>
                <small>ManiCash: {formatVnd(appAccountBalances.income)} VND</small>
                <input
                  value={reconciliationForm.income}
                  inputMode="numeric"
                  onChange={(event) => updateReconciliationForm('income', event.target.value)}
                />
              </label>

              <label>
                <span>Tài khoản chi tiêu</span>
                <small>ManiCash: {formatVnd(appAccountBalances.expense)} VND</small>
                <input
                  value={reconciliationForm.expense}
                  inputMode="numeric"
                  onChange={(event) => updateReconciliationForm('expense', event.target.value)}
                />
              </label>

              <label>
                <span>Tài khoản tiết kiệm</span>
                <small>ManiCash: {formatVnd(appAccountBalances.saving)} VND</small>
                <input
                  value={reconciliationForm.saving}
                  inputMode="numeric"
                  onChange={(event) => updateReconciliationForm('saving', event.target.value)}
                />
              </label>
            </div>

            <p className="ai-chat-reconcile-note">
              Bước này chỉ kiểm tra lệch số dư, chưa tự động sửa tiền trong app.
            </p>

            <div className="ai-chat-confirm-actions">
              <button type="button" className="ai-chat-secondary-btn" onClick={handleCancelReconciliation}>
                <X size={16} />
                Huỷ
              </button>
              <button type="button" className="ai-chat-primary-btn" onClick={handleConfirmReconciliation}>
                <Check size={16} />
                Kiểm tra lệch
              </button>
            </div>
          </section>
        )}

        {earningDraft && (
          <section className="ai-chat-confirm-card ai-chat-earning-card" aria-label="Tạo nhiệm vụ kiếm tiền">
            <div className="ai-chat-confirm-header">
              <div>
                <p className="ai-chat-kicker">Kế hoạch kiếm tiền</p>
                <h2>Nhiệm vụ mới</h2>
              </div>
              <span className={`ai-chat-confidence ai-chat-confidence-${earningDraft.confidence}`}>
                {earningDraft.confidence}
              </span>
            </div>

            <div className="ai-chat-field-grid">
              <label className="ai-chat-field-wide">
                <span>Tên nhiệm vụ</span>
                <input
                  value={earningDraft.name}
                  onChange={(event) => updateEarningDraft({ name: event.target.value })}
                />
              </label>

              <label>
                <span>Mục tiêu thu nhập</span>
                <input
                  value={earningDraft.amount}
                  inputMode="numeric"
                  onChange={(event) => handleEarningAmountChange(event.target.value)}
                />
              </label>

              <label>
                <span>Số ngày</span>
                <input
                  value={earningDraft.durationDays}
                  inputMode="numeric"
                  onChange={(event) =>
                    updateEarningDraft({ durationDays: event.target.value.replace(/\D/g, '') })
                  }
                />
              </label>
            </div>

            <div className="ai-chat-subtasks">
              <span className="ai-chat-subtasks-title">Các bước nhỏ</span>
              {earningDraft.subTasks.map((subTask, index) => (
                <div key={index} className="ai-chat-subtask-row">
                  <Check size={14} className="ai-chat-subtask-icon" />
                  <input
                    value={subTask}
                    placeholder="Mô tả bước này"
                    onChange={(event) => handleEarningSubTaskChange(index, event.target.value)}
                  />
                  <button
                    type="button"
                    className="ai-chat-subtask-remove"
                    aria-label="Xoá bước"
                    onClick={() => handleEarningSubTaskRemove(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="ai-chat-subtask-add" onClick={handleEarningSubTaskAdd}>
                <Plus size={14} />
                Thêm bước
              </button>
            </div>

            {error && <p className="ai-chat-error">{error}</p>}

            <div className="ai-chat-confirm-actions">
              <button type="button" className="ai-chat-secondary-btn" onClick={handleCancelEarning}>
                <X size={16} />
                Huỷ
              </button>
              <button
                type="button"
                className="ai-chat-primary-btn"
                disabled={!canConfirmEarning}
                onClick={handleConfirmEarning}
              >
                <Target size={16} />
                Tạo nhiệm vụ
              </button>
            </div>
          </section>
        )}

        <form className="ai-chat-input-row" onSubmit={handleSubmit}>
          <div className="ai-chat-input-shell">
            <MessageCircle size={18} />
            <input
              type="text"
              placeholder="Ví dụ: mua đậu hũ 20k"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={!enabled}
              aria-label="Nhập giao dịch bằng ngôn ngữ tự nhiên"
            />
          </div>
          <button type="submit" disabled={!enabled || !input.trim()}>
            <Send size={16} />
          </button>
        </form>

        <p className="ai-chat-footnote">
          Gợi ý: để ManiCash chính xác hơn, hãy tách 3 tài khoản ngân hàng cho Thu nhập,
          Chi tiêu và Tiết kiệm. Đối chiếu số dư định kỳ vì thiếu 1 giao dịch có thể làm lệch báo cáo.
        </p>
      </section>

      <section className="ai-chat-contract">
        <div>
          <ShieldCheck size={18} />
          <span>Phase 2 safety</span>
        </div>
        <p>
          Chat chỉ lưu khi bạn bấm xác nhận. Parser local xử lý trước, memory local ưu tiên các lần bạn đã sửa; AI sẽ thêm sau.
        </p>
      </section>
    </div>
  );
}
