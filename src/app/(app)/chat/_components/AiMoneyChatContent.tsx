'use client';

import { Fragment, FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  Check,
  Lock,
  Moon,
  Plus,
  Scale,
  Send,
  Sparkles,
  Sun,
  Target,
  Trash2,
} from 'lucide-react';
import { INCOME_CATEGORIES, type CategoryItem } from '@/data/categories';
import { createBalanceReconciliationReport } from '@/lib/aiMoneyChat/balanceReconciliation';
import { requestAiMoneyFallback } from '@/lib/aiMoneyChat/clientFallback';
import { shouldRequestAiFallback } from '@/lib/aiMoneyChat/aiFallback';
import { createDailyCheckIn, type DailyCheckInSlot } from '@/lib/aiMoneyChat/dailyCheckin';
import { parseMoneyText } from '@/lib/aiMoneyChat/parser';
import { classifyIntent } from '@/lib/aiMoneyChat/intent/intentClassifier';
import { buildClientSnapshot } from '@/lib/aiMoneyChat/clientSnapshot';
import { sendChatMessage } from '@/lib/aiMoneyChat/chatClient';
import { dispatchPrism } from '@/lib/aiMoneyChat/prism/prismDispatch';
import {
  suggestForIntent,
  filterSlashCommands,
  resolveSlashCommand,
  SPECIAL_SLASH_COMMANDS,
} from '@/lib/aiMoneyChat/prism/prismSuggestions';
import { computeCapacity, classifyCapacity } from '@/lib/aiMoneyChat/prism/capacity/capacityEngine';
import { buildCapacityComponents, type CapacityRawSignals } from '@/lib/aiMoneyChat/prism/capacity/buildCapacity';
import { surveyToSignals } from '@/lib/aiMoneyChat/prism/capacity/capacitySurvey';
import { useCapacitySurveyStore } from '@/stores/useCapacitySurveyStore';
import CapacityCard from './CapacityCard';
import CapacitySurveyCard from './CapacitySurveyCard';
import { useTransactionHabitStore } from '@/stores/useTransactionHabitStore';
import { topHabits, type TransactionHabit } from '@/lib/aiMoneyChat/prism/transactionMemory';
import { toMoneySnapshotV1, getBudgetCategoryProgress } from '@/lib/moneyBrain';
import { detectGuardianAlerts, type GuardianAlert } from '@/lib/aiMoneyChat/prism/guardian';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
import { executeMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import { undoMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionUndoExecutor';
import { getActionConfirmTitle, getActionRiskLabel } from '@/lib/aiMoneyChat/actions/actionCopy';
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';
import { useChatHistoryStore } from '@/stores/useChatHistoryStore';
import type { ChatMessage } from '@/types/chat';
import { areCoreStoresHydrated } from '@/stores/useHydrationStore';
import {
  buildEarningTaskDates,
  detectEarningIntent,
  parseEarningPlan,
  type ParsedEarningPlan,
} from '@/lib/aiMoneyChat/earningPlanner';
import { recordConfirmedMoneyIntent } from '@/lib/aiMoneyChat/recordIntent';
import { getDateKey } from '@/lib/dateHelpers';
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

/** Phiếu ghi nhận thu/chi gọn + tổng thu/chi trong ngày — badge màu. */
function TransactionReceipt({ receipt }: { receipt: NonNullable<ChatMessage['receipt']> }) {
  const isIncome = receipt.txnType === 'income';
  return (
    <div className={`tg-receipt tg-receipt--${receipt.txnType}`}>
      <div className="tg-receipt-head">
        <span className="tg-receipt-verb">{isIncome ? 'Xác nhận đã thu' : 'Xác nhận đã chi'}</span>
        <span className="tg-receipt-amount">
          {isIncome ? '+' : '−'}{formatVnd(receipt.amount)}đ
        </span>
      </div>
      <span
        className="tg-receipt-cat"
        style={{
          background: `${receipt.categoryColor}22`,
          borderColor: `${receipt.categoryColor}55`,
          color: receipt.categoryColor,
        }}
      >
        <span aria-hidden>{receipt.categoryIcon}</span> {receipt.categoryName}
      </span>
      {receipt.description && (
        <span className="tg-receipt-desc">Nội dung: {receipt.description}</span>
      )}
      <div className="tg-receipt-today">
        <span className="tg-receipt-today-label">Hôm nay</span>
        <span className="tg-receipt-pill tg-receipt-pill--in">↑ {formatVnd(receipt.todayIncome)}đ</span>
        <span className="tg-receipt-pill tg-receipt-pill--out">↓ {formatVnd(receipt.todayExpense)}đ</span>
      </div>
    </div>
  );
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
      text: 'Tôi là Lord Diamond. Hãy nhập giao dịch ("mua trà sữa 50k"), hỏi số liệu ("tôi còn bao nhiêu tiền", "tiền điện đóng chưa") hay yêu cầu phân tích ("lên báo cáo CFO tháng này"). 🕒 Lịch sử chat được lưu 7 ngày.',
    },
  ]);
  const historyLoadedRef = useRef(false);
  const [draftIntent, setDraftIntent] = useState<ParsedMoneyIntent | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [reconciliationForm, setReconciliationForm] = useState<ReconciliationForm | null>(null);
  const [earningDraft, setEarningDraft] = useState<EarningDraftForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAiFallbackLoading, setIsAiFallbackLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  // Phase 4A: action protocol — chỉ 1 pending action tại một thời điểm.
  const [pendingAction, setPendingAction] = useState<MoneyActionRequest | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  // Phase 5: audit history + undo.
  const [showHistory, setShowHistory] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const auditRecords = useActionAuditStore((s) => s.records);
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

  // Map categoryId -> { name, icon, color } cho receipt badge.
  const categoryMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; color: string }>();
    for (const c of [...expenseCategories, ...INCOME_CATEGORIES]) {
      const color = (c as CategoryItem & { color?: string }).color ?? '#7C3AED';
      map.set(c.id, { name: c.name, icon: c.icon, color });
    }
    return map;
  }, [expenseCategories]);

  // P3 — top giao dịch lặp lại (trí nhớ) -> chip ghi nhanh.
  const habits = useTransactionHabitStore((s) => s.habits);
  const habitChips = useMemo(() => topHabits(habits, { limit: 4, minCount: 2 }), [habits]);

  // P6a — câu trả lời khảo sát năng lực (cho thẻ khảo sát + đo lại).
  const surveyAnswers = useCapacitySurveyStore((s) => s.answers);

  // P4 — Người Gác: cảnh báo chủ động (offline) khi mở chat.
  const [guardianDismissed, setGuardianDismissed] = useState(false);
  const [idleDays, setIdleDays] = useState(0);
  const guardianAlerts = useMemo<GuardianAlert[]>(() => {
    if (!enabled) return [];
    try {
      return detectGuardianAlerts(toMoneySnapshotV1(currentClientSnapshot()), { idleDays });
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    idleDays,
    transactions,
    fixedBills,
    categoryBudgets,
    goals,
    earningTasks,
    userProfile,
    mainBalance,
    emergencyBalance,
    billFundBalance,
    carryOver,
  ]);

  // P4 — đo số ngày user không mở chat (idle) để Người Gác nhắc tái tương tác.
  useEffect(() => {
    const KEY = 'manicash.prism.lastOpen';
    try {
      const prev = localStorage.getItem(KEY);
      if (prev) {
        const days = Math.floor((Date.now() - new Date(prev).getTime()) / 86_400_000);
        if (Number.isFinite(days) && days > 0) setIdleDays(days);
      }
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      /* localStorage không khả dụng -> bỏ qua idle */
    }
  }, []);

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
    // Phase I: lưu lịch sử theo ngày (localStorage) để không mất khi tắt/đóng tab.
    useChatHistoryStore.getState().addMessages(nextMessages);
  }

  // Phase I: nạp lịch sử chat đã lưu (1 lần) + dọn đoạn cũ hơn 7 ngày; báo nếu vừa dọn.
  useEffect(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    const removed = useChatHistoryStore.getState().prune();
    const history = useChatHistoryStore.getState().messages;
    setMessages((current) => {
      const cleanedNote: ChatMessage[] =
        removed > 0
          ? [{ id: 'cleaned-note', role: 'system', text: `🧹 Đã dọn ${removed} tin nhắn cũ hơn 7 ngày.` }]
          : [];
      return [...current, ...history, ...cleanedNote];
    });
  }, []);

  function buildAssistantText(intent: ParsedMoneyIntent): string {
    if (!intent.amount) {
      return 'Tôi chưa thấy số tiền trong câu này. Hãy thử lại với ví dụ: mua đậu hũ 20k.';
    }

    const typeLabel = intent.type === 'income' ? 'thu' : intent.type === 'transfer' ? 'chuyển quỹ' : 'chi';
    const categoryLabel = intent.category?.categoryName || intent.category?.categoryId || 'chưa rõ';
    return `${formatVnd(intent.amount.value)}đ — ${typeLabel} · ${categoryLabel}. Kiểm tra rồi xác nhận nhé.`;
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

    // AI fallback không khả dụng — giữ yên, bản draft local vẫn hiện để user xác nhận.
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

    // Phase 6B-1: không build/gửi snapshot từ seed trước khi persisted data hydrate.
    if (!areCoreStoresHydrated()) {
      appendMessages([
        { id: makeMessageId('system'), role: 'system', text: 'Đang tải dữ liệu của bạn, vui lòng thử lại sau giây lát.' },
      ]);
      return;
    }

    const snapshot = currentClientSnapshot();

    // PRISM (Lõi Kim Cương) — thử trả lời OFFLINE ngay tại client trước.
    // Câu tra cứu (số dư, bill, safe-to-spend, mục tiêu, sức khỏe...) -> trả lời
    // tức thì, 0đ, không cần mạng. Chỉ câu khó (CFO/tư vấn/follow-up) mới lên server.
    try {
      const prism = await dispatchPrism(text, { uid: userProfile?.uid, clientSnapshot: snapshot });
      if (prism) {
        appendMessages([
          {
            id: makeMessageId('assistant'),
            role: 'assistant',
            text: prism.message,
            markdown: true,
            suggestions: suggestForIntent(prism.meta.intent),
          },
        ]);
        trackEvent('chat_parse', { mode: 'prism', intent: prism.meta.intent, source: 'prism-offline' });
        return;
      }
    } catch {
      /* PRISM lỗi bất ngờ -> rơi xuống server như cũ */
    }

    setIsChatLoading(true);

    const result = await sendChatMessage({
      message: text,
      sessionId: sessionIdRef.current,
      clientSnapshot: snapshot,
    });

    setIsChatLoading(false);
    trackEvent('chat_parse', {
      mode: 'assistant',
      intent: result.intentType ?? 'unknown',
      source: result.reply?.meta.source ?? result.error ?? 'error',
    });

    if (result.ok && result.reply) {
      appendMessages([
        {
          id: makeMessageId('assistant'),
          role: 'assistant',
          text: result.reply.message,
          markdown: true,
          suggestions: suggestForIntent(result.intentType),
        },
      ]);
      // Phase 4A: nếu có actionRequest, hiển thị card confirm (không auto-execute).
      const action = result.reply.actionRequest;
      if (action) {
        if (pendingAction) {
          appendMessages([
            { id: makeMessageId('system'), role: 'system', text: 'Bạn đang có một thao tác chờ xác nhận. Hãy xử lý thao tác đó trước nhé.' },
          ]);
        } else {
          useActionAuditStore.getState().addRequested(action);
          setPendingAction(action);
        }
      }
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

  async function handleConfirmAction() {
    if (!pendingAction || isExecutingAction) return;
    const { requestId } = pendingAction;
    const audit = useActionAuditStore.getState();
    setIsExecutingAction(true);
    audit.markConfirmed(requestId);
    const result = await executeMoneyActionOnClient(pendingAction);
    setIsExecutingAction(false);
    trackEvent('chat_parse', { mode: 'action', intent: pendingAction.action, source: result.ok ? 'executed' : 'rejected' });
    if (result.ok) {
      audit.markExecuted(requestId, {
        message: result.message,
        undoable: result.undoable,
        undoReason: result.undoReason,
        undoSnapshot: result.undoSnapshot,
      });
    } else {
      audit.markFailed(requestId, result.message);
    }
    appendMessages([
      { id: makeMessageId(result.ok ? 'assistant' : 'system'), role: result.ok ? 'assistant' : 'system', text: result.message },
    ]);
    setPendingAction(null);
  }

  function handleCancelAction() {
    if (!pendingAction) return;
    useActionAuditStore.getState().markCancelled(pendingAction.requestId, 'User cancelled');
    setPendingAction(null);
    appendMessages([{ id: makeMessageId('system'), role: 'system', text: 'Đã hủy thao tác.' }]);
  }

  async function handleUndo(record: MoneyActionAuditRecord) {
    if (undoingId) return;
    const audit = useActionAuditStore.getState();
    setUndoingId(record.requestId);
    audit.markUndoRequested(record.requestId);
    const result = await undoMoneyActionOnClient(record);
    setUndoingId(null);
    if (result.ok) audit.markUndone(record.requestId, result.message);
    else audit.markUndoFailed(record.requestId, result.message);
    appendMessages([
      { id: makeMessageId(result.ok ? 'assistant' : 'system'), role: result.ok ? 'assistant' : 'system', text: result.message },
    ]);
  }

  function parseInput(rawText: string) {
    let text = rawText.trim();
    if (!text) return;

    // P2/P5 — lệnh "/": lệnh đặc biệt (đo năng lực) xử lý riêng tại client;
    // còn lại ánh xạ sang câu hỏi tự nhiên rồi xử lý như bình thường.
    if (text.startsWith('/')) {
      const token = text.split(/\s+/)[0].toLowerCase();
      if (SPECIAL_SLASH_COMMANDS.has(token)) {
        if (token === '/khaosat') handleStartSurvey();
        else handleShowCapacity();
        setInput('');
        return;
      }
      const resolved = resolveSlashCommand(text);
      if (resolved) text = resolved;
    }

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

  /** P3 — ghi nhanh từ thói quen: mở nháp đã điền sẵn (không cần gõ lại). */
  function handleHabitQuickAdd(h: TransactionHabit) {
    if (!enabled) return;
    const label = h.label || h.keyword;
    const text = `${label} ${formatVnd(h.typicalAmount)}`;
    const parsed = parseMoneyText(text);
    const intent: ParsedMoneyIntent = {
      ...parsed,
      type: h.type,
      confidence: 'high',
      needsConfirmation: false,
      category: {
        categoryId: h.categoryId,
        categoryName: categoryMetaMap.get(h.categoryId)?.name ?? h.categoryId,
        confidence: 'high',
      },
    };
    appendMessages([
      { id: makeMessageId('user'), role: 'user', text },
      { id: makeMessageId('assistant'), role: 'assistant', text: buildAssistantText(intent) },
    ]);
    setDraftFromIntent(intent);
    setInput('');
    setError(null);
  }

  /** P5 — đo La Bàn Năng Lực (offline) từ dữ liệu local hiện có. */
  function handleShowCapacity() {
    if (!enabled) return;
    const now = new Date();
    // Dùng getDateKey (UTC) để KHỚP với t.dateKey của transaction (cũng UTC) — tránh
    // lệch ngày/tháng ở ranh giới khi so chuỗi với key local.
    const monthPrefix = getDateKey(now).slice(0, 7);
    const cutoff = getDateKey(new Date(now.getTime() - 30 * 86_400_000));

    const loggedDays = new Set<string>();
    let monthlyExpense = 0;
    for (const t of transactions) {
      const dk = t.dateKey;
      if (dk && dk >= cutoff) loggedDays.add(dk);
      if (t.type === 'expense' && dk && dk.startsWith(monthPrefix)) monthlyExpense += t.amount;
    }

    let budgetTotal = 0;
    let budgetWithin = 0;
    try {
      const snap = toMoneySnapshotV1(currentClientSnapshot());
      const prog = getBudgetCategoryProgress(snap).filter((b) => b.monthlyLimit > 0);
      budgetTotal = prog.length;
      budgetWithin = prog.filter((b) => !b.isOverBudget).length;
    } catch {
      /* không có ngân sách -> adapter dùng default */
    }

    const chatUserMessages = messages.filter((m) => m.role === 'user').length;
    const earningTasksCompleted = earningTasks.filter((t) => !!t.completedAt).length;
    const featuresUsed = [
      categoryBudgets.length > 0,
      goals.length > 0,
      earningTasks.length > 0,
      fixedBills.length > 0,
      chatUserMessages > 0,
    ].filter(Boolean).length;

    // P6a — bổ sung tín hiệu từ khảo sát (nếu đã khai) để bỏ "đo sơ bộ".
    const survey = surveyToSignals(useCapacitySurveyStore.getState().answers);

    const raw: CapacityRawSignals = {
      daysLoggedLast30: loggedDays.size,
      budgetTotal,
      budgetWithin,
      goalsTotal: goals.length,
      goalsFunded: goals.filter((g) => (g.currentAmount ?? 0) > 0).length,
      streakDays: userProfile?.streak ?? 0,
      chatUserMessages,
      featuresUsed,
      featuresTotal: 5,
      onboardingDone: -1,
      onboardingTotal: 7,
      skillsDeclared: survey.skillsDeclared,
      earningTasksTotal: earningTasks.length,
      earningTasksCompleted,
      freeTimeHoursPerWeek: survey.freeTimeHoursPerWeek,
      emergencyFundMonths: monthlyExpense > 0 ? emergencyBalance / monthlyExpense : -1,
      cfoReportViews: 0,
    };

    const { components, pending } = buildCapacityComponents(raw);
    const scores = computeCapacity(components);
    const classification = classifyCapacity(scores);

    appendMessages([
      { id: makeMessageId('user'), role: 'user', text: 'Đo năng lực của tôi ⚡' },
      {
        id: makeMessageId('assistant'),
        role: 'assistant',
        text: 'Đây là **Bản đồ năng lực** của ngài (đo offline từ dữ liệu hiện có):',
        markdown: true,
        capacity: { scores, classification, pending },
      },
    ]);
    setInput('');
    setError(null);
  }

  /** P6a — mở thẻ khảo sát năng lực (kỹ năng + thời gian rảnh). */
  function handleStartSurvey() {
    if (!enabled) return;
    appendMessages([
      { id: makeMessageId('user'), role: 'user', text: 'Khảo sát năng lực 📝' },
      {
        id: makeMessageId('assistant'),
        role: 'assistant',
        text: 'Khai vài nét về thế mạnh để tôi đo năng lực chính xác hơn nhé:',
        survey: true,
      },
    ]);
    setInput('');
    setError(null);
  }

  /** P6a — lưu khảo sát rồi đo lại năng lực ngay. */
  function handleSaveSurvey(input: { skills: string[]; freeTimeHoursPerWeek: number }) {
    useCapacitySurveyStore.getState().save(input);
    appendMessages([
      { id: makeMessageId('system'), role: 'system', text: '✓ Đã lưu khảo sát. Đang đo lại năng lực…' },
    ]);
    handleShowCapacity();
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
      // recordConfirmedMoneyIntent emit moneyEvents → MoneyReactionHost lo
      // popup chúc mừng (thu) / cằn nhằn (chi). Chat chỉ hiện phiếu ghi nhận gọn.
      recordConfirmedMoneyIntent(confirmed);

      // P3 — học giao dịch lặp lại để gợi ý ghi nhanh lần sau (offline).
      if (confirmed.type !== 'transfer') {
        useTransactionHabitStore.getState().record({
          text: draftForm.note.trim() || draftIntent.rawText,
          type: confirmed.type,
          categoryId: confirmed.categoryId,
          amount: confirmed.amount,
        });
      }

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

      const meta = categoryMetaMap.get(confirmed.categoryId);
      const todayKey = getDateKey(new Date());
      const today = useFinanceStore.getState().getDailySummary()[todayKey] ?? { income: 0, expense: 0 };
      const txnType: 'income' | 'expense' = confirmed.type === 'income' ? 'income' : 'expense';

      appendMessages([
        {
          id: makeMessageId('system'),
          role: 'system',
          text: `Đã ghi ${txnType === 'income' ? 'thu' : 'chi'} ${formatVnd(confirmed.amount)}đ`,
          receipt: {
            txnType,
            amount: confirmed.amount,
            categoryName: meta?.name ?? categoryNameMap.get(confirmed.categoryId) ?? confirmed.categoryId,
            categoryIcon: meta?.icon ?? (txnType === 'income' ? '💰' : '🧾'),
            categoryColor: meta?.color ?? (txnType === 'income' ? '#22C55E' : '#F97316'),
            todayIncome: today.income,
            todayExpense: today.expense,
            description: confirmed.note || undefined,
          },
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

        {!guardianDismissed && guardianAlerts.length > 0 && (
          <div className="tg-guardian" role="status" aria-label="Cảnh báo từ Lord Diamond">
            <div className="tg-guardian-head">
              <span className="tg-guardian-avatar" aria-hidden>🛡️</span>
              <span className="tg-guardian-title">Lord Diamond để ý thấy</span>
              <button
                type="button"
                className="tg-guardian-close"
                onClick={() => setGuardianDismissed(true)}
                aria-label="Đóng cảnh báo"
              >
                ×
              </button>
            </div>
            {guardianAlerts.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`tg-guardian-item tg-guardian-${a.severity}`}
                disabled={!a.query}
                onClick={() => a.query && parseInput(a.query)}
              >
                <span className="tg-guardian-icon" aria-hidden>{a.icon}</span>
                <span className="tg-guardian-body">
                  <span className="tg-guardian-item-title">{a.title}</span>
                  <span className="tg-guardian-item-msg">{a.message}</span>
                </span>
                {a.query && <span className="tg-guardian-cta" aria-hidden>›</span>}
              </button>
            ))}
          </div>
        )}

        <div className="tg-thread" ref={threadRef}>
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const showSuggestions = isLast && message.suggestions && message.suggestions.length > 0;
            return (
              <Fragment key={message.id}>
                <div className={`tg-msg tg-msg-${message.role}`}>
                  {message.role !== 'user' && (
                    <div className="tg-msg-avatar" aria-hidden="true">
                      {message.role === 'assistant' ? 'LD' : <Check size={13} />}
                    </div>
                  )}
                  <div className={`tg-bubble${message.capacity || message.survey ? ' tg-bubble--wide' : ''}`}>
                    {message.survey ? (
                      <>
                        <p>{message.text}</p>
                        <CapacitySurveyCard initial={surveyAnswers} onSave={handleSaveSurvey} />
                      </>
                    ) : message.capacity ? (
                      <>
                        {message.markdown ? <FormattedText text={message.text} /> : <p>{message.text}</p>}
                        <CapacityCard result={message.capacity} />
                      </>
                    ) : message.receipt ? (
                      <TransactionReceipt receipt={message.receipt} />
                    ) : message.markdown ? (
                      <FormattedText text={message.text} />
                    ) : (
                      <p>{message.text}</p>
                    )}
                  </div>
                </div>
                {showSuggestions && (
                  <div className="tg-suggest" role="group" aria-label="Gợi ý tiếp theo">
                    {message.suggestions!.map((s) => (
                      <button
                        key={s.query}
                        type="button"
                        className="tg-suggest-chip"
                        disabled={!enabled}
                        onClick={() => parseInput(s.query)}
                      >
                        {s.icon && <span aria-hidden>{s.icon}</span>} {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
          {(isAiFallbackLoading || isChatLoading) && <TypingIndicator />}

          {pendingAction && (
            <div className="tg-action-card" role="group" aria-label="Xác nhận thao tác">
              <p className="tg-action-title">{getActionConfirmTitle(pendingAction)}</p>
              <p className="tg-action-preview">{pendingAction.preview}</p>
              <p className={`tg-action-risk tg-action-risk-${pendingAction.riskLevel}`}>
                {getActionRiskLabel(pendingAction)}
              </p>
              <div className="tg-action-buttons">
                <button
                  type="button"
                  className="tg-action-confirm"
                  disabled={isExecutingAction}
                  onClick={handleConfirmAction}
                >
                  {isExecutingAction ? 'Đang xử lý…' : 'Xác nhận'}
                </button>
                <button
                  type="button"
                  className="tg-action-cancel"
                  disabled={isExecutingAction}
                  onClick={handleCancelAction}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {showHistory && (
            <div className="tg-history" role="region" aria-label="Lịch sử thao tác">
              <p className="tg-history-title">Lịch sử thao tác (gần nhất)</p>
              {auditRecords.length === 0 && <p className="tg-history-empty">Chưa có thao tác nào.</p>}
              {auditRecords.slice(0, 20).map((rec) => (
                <div key={rec.id} className="tg-history-item">
                  <div className="tg-history-row">
                    <span className="tg-history-preview">{rec.preview}</span>
                    <span className={`tg-history-status tg-history-status-${rec.status}`}>{rec.status}</span>
                  </div>
                  {rec.resultMessage && <p className="tg-history-msg">{rec.resultMessage}</p>}
                  {rec.errorMessage && <p className="tg-history-msg tg-history-err">{rec.errorMessage}</p>}
                  {rec.status === 'executed' && rec.undoable && (
                    <button
                      type="button"
                      className="tg-history-undo"
                      disabled={undoingId === rec.requestId}
                      onClick={() => handleUndo(rec)}
                    >
                      {undoingId === rec.requestId ? 'Đang hoàn tác…' : 'Hoàn tác'}
                    </button>
                  )}
                  {rec.status === 'executed' && !rec.undoable && rec.undoReason && (
                    <p className="tg-history-note">{rec.undoReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tg-quick" aria-label="Hành động nhanh">
          <Link href="/input" className="tg-chip tg-chip-action tg-chip--purple" aria-label="Mở form nhập tiền thủ công">
            <Plus size={14} /> Nhập thủ công
          </Link>
          <button type="button" className="tg-chip tg-chip-action tg-chip--amber" disabled={!enabled} onClick={() => handleDailyCheckIn('midday')}>
            <Sun size={14} /> Báo cáo trưa
          </button>
          <button type="button" className="tg-chip tg-chip-action tg-chip--indigo" disabled={!enabled} onClick={() => handleDailyCheckIn('evening')}>
            <Moon size={14} /> Tổng kết tối
          </button>
          <button type="button" className="tg-chip tg-chip-action tg-chip--green" disabled={!enabled} onClick={openReconciliationForm}>
            <Scale size={14} /> Đối chiếu số dư
          </button>
          <button type="button" className="tg-chip tg-chip-action tg-chip--purple" onClick={() => setShowHistory((v) => !v)} aria-pressed={showHistory}>
            <Scale size={14} /> Lịch sử thao tác
          </button>
          {habitChips.map((h) => (
            <button
              key={`${h.type}:${h.keyword}`}
              type="button"
              className="tg-chip tg-chip--habit"
              disabled={!enabled}
              onClick={() => handleHabitQuickAdd(h)}
              title={`Ghi nhanh: ${h.label} ${formatVnd(h.typicalAmount)}đ`}
            >
              <span aria-hidden>{categoryMetaMap.get(h.categoryId)?.icon ?? (h.type === 'income' ? '💰' : '🧾')}</span>
              {h.label} · {formatVnd(h.typicalAmount)}đ
            </button>
          ))}
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="tg-chip tg-chip--example" disabled={!enabled} onClick={() => handleExample(example)}>
              <Sparkles size={13} /> {example}
            </button>
          ))}
        </div>

        {enabled && input.startsWith('/') && filterSlashCommands(input).length > 0 && (
          <div className="tg-slash" role="listbox" aria-label="Lệnh nhanh">
            {filterSlashCommands(input).map((c) => (
              <button
                key={c.cmd}
                type="button"
                className="tg-slash-item"
                role="option"
                aria-selected="false"
                onClick={() => {
                  setInput('');
                  parseInput(c.query);
                }}
              >
                <span className="tg-slash-icon" aria-hidden>{c.icon}</span>
                <span className="tg-slash-cmd">{c.cmd}</span>
                <span className="tg-slash-label">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        <form className="tg-composer" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nhập giao dịch hoặc gõ / để xem lệnh nhanh"
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

                  {/* Bill suggestion — hiện khi danh mục là bills/housing và user có bill cố định chưa đóng */}
                  {draftForm.type === 'expense' && (() => {
                    const isBillCat = ['bills', 'housing', 'education'].includes(draftForm.categoryId);
                    if (!isBillCat) return null;
                    const draftAmt = parseAmountInput(draftForm.amount);
                    const noteNorm = draftForm.note.toLowerCase();
                    const matchedBills = fixedBills.filter((b) => {
                      if (b.isPaid) return false;
                      const billNorm = b.name.toLowerCase();
                      const nameMatch = noteNorm && billNorm.split(/\s+/).some((w) => noteNorm.includes(w) && w.length > 2);
                      const amtMatch = draftAmt > 0 && Math.abs(b.amount - draftAmt) / b.amount < 0.25;
                      return nameMatch || amtMatch;
                    }).slice(0, 3);
                    // fallback: hiện tất cả unpaid bills nếu không match cụ thể nào
                    const bills = matchedBills.length > 0
                      ? matchedBills
                      : fixedBills.filter((b) => !b.isPaid).slice(0, 3);
                    if (bills.length === 0) return null;
                    return (
                      <div className="tg-bill-hint">
                        <span className="tg-bill-hint-label">Đây là bill nào?</span>
                        {bills.map((bill) => (
                          <button
                            key={bill.id}
                            type="button"
                            className="tg-bill-hint-btn"
                            onClick={() => updateDraft({ note: bill.name, amount: String(bill.amount) })}
                          >
                            {bill.icon} {bill.name} · {formatVnd(bill.amount)}đ
                          </button>
                        ))}
                      </div>
                    );
                  })()}

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
