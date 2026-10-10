/* ═══ Money Content — Dual-Tab: Money + CFO Report ═══ */
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChartData } from '@/hooks/useChartData';
import { useCFOSnapshot } from '@/hooks/useCFOSnapshot';
import { useCFOReport } from '@/hooks/useCFOReport';
import type { OverdueReason, EarningTask } from '@/types/task';
import { getTaskStage } from '@/types/task';
import { receiveTaskPayment, undoReceiveTaskPayment, getOutstandingSummary } from '@/lib/tasks/receiveTaskPayment';
import { EARNING_THEMES, taskDraftFromTemplate, type EarningTemplate, type EarningThemeId } from '@/data/earningTemplates';
import { formatCurrency } from '@/utils/formatCurrency';
import HallOfFame from './HallOfFame';
import TaskCard from './TaskCard';
import TaskFormModal, { type TaskDraft } from './TaskFormModal';
import EarningIdeasSheet from './EarningIdeasSheet';
import TaskSettleSheet, { type SettleMode, type ReceiveChoice, type AwaitChoice } from './TaskSettleSheet';
import TaskUndoToast, { type UndoToastData } from './TaskUndoToast';
import TaskOverdueDialog from './TaskOverdueDialog';
import CFOInsightCard from './CFOInsightCard';
import StackedBarChart from './StackedBarChart';
import SavingsLineChart from './SavingsLineChart';
import HealthScoreGauge from './HealthScoreGauge';
import Link from 'next/link';
import { Plus, ChevronRight, BarChart2, MessageCircle, Sparkles } from 'lucide-react';
import { isAiMoneyChatEnabled } from '@/lib/aiMoneyChat/featureFlag';
import { isSmsWebhookEnabled } from '@/lib/featureFlags';
import './earningTheme.css';
import './money.css';

type MoneyTab = 'money' | 'cfo';

const tabVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 280 : -280,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 280 : -280,
    opacity: 0,
  }),
};

export default function MoneyContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MoneyTab>('money');
  const [direction, setDirection] = useState(0);

  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const markWorkDone = useTaskStore((s) => s.markWorkDone);
  const undoMarkWorkDone = useTaskStore((s) => s.undoMarkWorkDone);
  const deleteOverdueTask = useTaskStore((s) => s.deleteOverdueTask);
  const getStatus = useTaskStore((s) => s.getStatus);

  // XP đọc từ store (demo bypass set xp=2500). Fallback 0 khi profile chưa init.
  const currentXP = useAuthStore((s) => s.user?.xp ?? 0);

  const { weeklyComparison, savingsGrowth } = useChartData();

  // === CFO state — lifted lên đây để share giữa CFOInsightCard + HealthScoreGauge ===
  // Phase 3: gửi MoneySnapshotV1 -> /api/cfo dùng CFO Context Pack (số do engine tính).
  const { snapshot: cfoSnapshot, breakdown, cacheKey } = useCFOSnapshot();
  const {
    insight: cfoInsight,
    isLoading: cfoLoading,
    error: cfoError,
    lastUpdated: cfoLastUpdated,
    fetchInsight,
  } = useCFOReport();

  // Auto-fetch khi cacheKey đổi (data tháng/ngày thay đổi). Hook tự dedupe + cache.
  useEffect(() => {
    fetchInsight(cfoSnapshot, { cacheKey });
  }, [cacheKey, cfoSnapshot, fetchInsight]);

  const handleCfoRefresh = useCallback(() => {
    fetchInsight(cfoSnapshot, { cacheKey, forceRefresh: true });
  }, [cfoSnapshot, cacheKey, fetchInsight]);

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<EarningTask | null>(null);
  const [overdueTarget, setOverdueTarget] = useState<string | null>(null);
  // Đợt 1 — thư viện mẫu, xong việc/nhận tiền, toast hoàn tác, lọc "khách còn nợ".
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideasTheme, setIdeasTheme] = useState<EarningThemeId | undefined>(undefined);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [settle, setSettle] = useState<{ taskId: string; mode: SettleMode } | null>(null);
  const [toast, setToast] = useState<UndoToastData | null>(null);
  const [owedOnly, setOwedOnly] = useState(false);

  const activeTasks = tasks.filter((t) => !t.deletedAt && !t.completedAt);
  const owed = getOutstandingSummary(tasks);
  // Hết việc nợ thì bộ lọc mất nghĩa: coi như tắt, và tắt hẳn để lần sau không âm thầm bật lại.
  if (owedOnly && owed.count === 0) setOwedOnly(false);
  const visibleTasks = owedOnly && owed.count > 0
    ? activeTasks.filter((t) => getTaskStage(t) === 'awaiting_payment')
    : activeTasks;
  const settleTask = settle ? tasks.find((t) => t.id === settle.taskId) ?? null : null;
  const completedTasks = tasks.filter((t) => t.completedAt);
  const overdueTaskName = overdueTarget
    ? tasks.find((t) => t.id === overdueTarget)?.name || ''
    : '';

  const showToast = useCallback((t: Omit<UndoToastData, 'id'>) => {
    setToast({ ...t, id: Date.now() });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const openIdeas = useCallback((themeId?: EarningThemeId) => {
    setToast(null);
    setIdeasTheme(themeId);
    setIdeasOpen(true);
  }, []);

  const handlePickTemplate = useCallback((tpl: EarningTemplate) => {
    setIdeasOpen(false);
    setEditingTask(null);
    setDraft(taskDraftFromTemplate(tpl));
    setShowForm(true);
  }, []);

  // Mở sheet thì ẩn toast: toast nằm trên sheet (z 320) và che đúng nút đáy → chạm nhầm "Hoàn tác" khoản thu trước.
  const openSettle = useCallback((taskId: string, mode: SettleMode) => {
    setToast(null);
    setSettle({ taskId, mode });
  }, []);
  const handleWorkDone = useCallback((id: string) => openSettle(id, 'done'), [openSettle]);
  const handleOpenReceive = useCallback((id: string) => openSettle(id, 'receive'), [openSettle]);
  const handleOpenReschedule = useCallback((id: string) => openSettle(id, 'reschedule'), [openSettle]);
  const closeSettle = useCallback(() => setSettle(null), []);

  // Nhận tiền: MỘT đường duy nhất receiveTaskPayment (giao dịch thu + XP 1 lần + popup thu nhập).
  const handleReceive = useCallback((task: EarningTask, c: ReceiveChoice): string | null => {
    const res = receiveTaskPayment({
      taskId: task.id,
      amount: c.amount,
      wallet: 'main',
      method: c.method,
      categoryId: c.categoryId,
      receivedAt: c.receivedAt,
    });
    if (!res.ok) return res.message;
    setSettle(null);
    const where = c.method === 'cash' ? 'tiền mặt' : 'ví chính';
    const expected = task.expectedAmount || 0;
    const gap = expected > 0 && c.amount > 0 ? (c.amount - expected) / expected : 0;
    const note = gap <= -0.2
      ? 'Quản gia: Lần sau báo giá cao hơn chút nhé.'
      : gap >= 0.2
        ? 'Quản gia: Khách trả hơn mong đợi, tuyệt vời 👏'
        : 'Quản gia: Tiền về rồi, làm tốt lắm!';
    const undo = res.undo;
    showToast({
      message: res.transaction ? `Đã ghi +${formatCurrency(res.transaction.amount)} vào ${where}` : `Đã khép việc “${task.name}”`,
      note,
      onUndo: () => {
        const ok = undoReceiveTaskPayment(undo);
        setTimeout(() => showToast({
          message: ok ? `Đã hoàn tác — gỡ khoản thu của “${task.name}”` : 'Không hoàn tác được — dữ liệu đã thay đổi.',
        }), 0);
      },
    });
    return null;
  }, [showToast]);

  const handleAwait = useCallback((task: EarningTask, c: AwaitChoice) => {
    const before = {
      subTasks: task.subTasks.map((st) => ({ ...st })),
      payerName: task.payerName,
      paymentDueDate: task.paymentDueDate,
    };
    setSettle(null);
    if (!markWorkDone(task.id, { payerName: c.payerName, paymentDueDate: c.paymentDueDate })) return;
    showToast({
      message: 'Đã chuyển sang Chờ thanh toán',
      note: c.payerName ? `Khách: ${c.payerName}` : undefined,
      onUndo: () => {
        const ok = undoMarkWorkDone(task.id, { subTasks: before.subTasks });
        if (ok) updateTask(task.id, { payerName: before.payerName, paymentDueDate: before.paymentDueDate });
        setTimeout(() => showToast({ message: ok ? 'Đã hoàn tác — việc trở lại Đang làm' : 'Không hoàn tác được — dữ liệu đã thay đổi.' }), 0);
      },
    });
  }, [markWorkDone, undoMarkWorkDone, updateTask, showToast]);

  const handleReschedule = useCallback((task: EarningTask, c: AwaitChoice) => {
    updateTask(task.id, { payerName: c.payerName || undefined, paymentDueDate: c.paymentDueDate });
    setSettle(null);
    showToast({
      message: c.paymentDueDate
        ? `Đã hẹn lại ngày ${new Date(`${c.paymentDueDate}T12:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
        : 'Đã bỏ ngày hẹn trả',
    });
  }, [updateTask, showToast]);

  const handleOverdueReason = useCallback((reason: OverdueReason) => {
    if (overdueTarget) {
      deleteOverdueTask(overdueTarget, reason);
      setOverdueTarget(null);
    }
  }, [overdueTarget, deleteOverdueTask]);

  const handleEdit = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) { setToast(null); setDraft(null); setEditingTask(task); setShowForm(true); }
  }, [tasks]);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingTask(null);
    setDraft(null);
  }, []);

  const switchTab = (tab: MoneyTab) => {
    if (tab === activeTab) return;
    setDirection(tab === 'cfo' ? 1 : -1);
    setActiveTab(tab);
  };

  // Stats
  const completedCount = completedTasks.length;
  const activeCount = activeTasks.filter((t) => getStatus(t) === 'active' && getTaskStage(t) !== 'awaiting_payment').length;
  const overdueCount = activeTasks.filter((t) => getStatus(t) === 'overdue').length;

  return (
    <div className="stack stack-sm">
      {/* ═══ Dual-Tab Navigation ═══ */}
      <div className="money-tab-bar">
        <button
          className={`money-tab ${activeTab === 'money' ? 'active' : ''}`}
          onClick={() => switchTab('money')}
        >
          💰 Money
        </button>
        <button
          className={`money-tab ${activeTab === 'cfo' ? 'active' : ''}`}
          onClick={() => switchTab('cfo')}
        >
          📊 Báo cáo CFO
        </button>
        <div
          className="money-tab-indicator"
          style={{ transform: `translateX(${activeTab === 'cfo' ? '100%' : '0'})` }}
        />
      </div>

      {/* ═══ Tab Content with Sliding Transitions ═══ */}
      <div className="money-tab-viewport">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          {activeTab === 'money' ? (
            <motion.div
              key="money"
              custom={direction}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* ═══ TAB 1: Money — Gamification + Tasks ═══ */}
              <HallOfFame currentXP={currentXP} />

              {/* Task Stats */}
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--c-success)' }}>{completedCount}</p>
                  <p style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>Hoàn thành</p>
                </div>
                <div style={{ width: 1, background: 'var(--glass-border)' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 800, color: '#10B981' }}>{activeCount}</p>
                  <p style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>Đang chạy</p>
                </div>
                <div style={{ width: 1, background: 'var(--glass-border)' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 800, color: overdueCount > 0 ? '#EF4444' : 'var(--c-text-muted)' }}>{overdueCount}</p>
                  <p style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>Trễ hạn</p>
                </div>
              </div>

              {/* Đợt 1 — Khách còn nợ: bấm để lọc chỉ việc Chờ thanh toán */}
              {owed.count > 0 && (
                <button
                  type="button"
                  className={`money-owed${owedOnly ? ' is-on' : ''}`}
                  onClick={() => setOwedOnly(!owedOnly)}
                  aria-pressed={owedOnly}
                >
                  <span className="money-owed-text">
                    Khách còn nợ <b>{formatCurrency(owed.amount)}</b> từ {owed.count} việc
                  </span>
                  <span className="money-owed-act">{owedOnly ? 'Xem tất cả' : 'Lọc'}</span>
                </button>
              )}

              {/* Active Task List */}
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  status={getStatus(task)}
                  onWorkDone={handleWorkDone}
                  onReceive={handleOpenReceive}
                  onReschedule={handleOpenReschedule}
                  onOverdueAction={setOverdueTarget}
                  onEdit={handleEdit}
                />
              ))}

              {/* Rỗng: mời chọn ý tưởng ngay */}
              {activeTasks.length === 0 && (
                <div className="money-empty">
                  <p className="money-empty-text">Chưa có việc nào. Chọn một ý tưởng bên dưới, 30 giây là bắt đầu.</p>
                  <div className="money-empty-themes">
                    {EARNING_THEMES.map((t) => (
                      <button key={t.id} type="button" data-tid={t.id} className="money-empty-theme" onClick={() => openIdeas(t.id)}>
                        <span aria-hidden="true">{t.emoji}</span>
                        <small>{t.name}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Gợi ý từ thư viện mẫu + tự thêm */}
              <div className="money-add-row">
                <button type="button" className="btn btn-primary btn-lg money-ideas-btn" onClick={() => openIdeas()}>
                  <Sparkles size={18} aria-hidden="true" /> <span>Gợi ý việc kiếm tiền</span>
                </button>
                <button
                  type="button"
                  className="money-add-btn"
                  onClick={() => { setToast(null); setDraft(null); setEditingTask(null); setShowForm(true); }}
                  aria-label="Tự thêm nhiệm vụ kiếm tiền"
                >
                  <Plus size={18} aria-hidden="true" /> <span>Tự thêm</span>
                </button>
              </div>

              {/* Completed Tasks — History */}
              {completedTasks.length > 0 && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-sm)' }}>
                    ✅ Đã nhận tiền ({completedTasks.length})
                  </p>
                  {completedTasks.slice(0, 3).map((task) => (
                    <TaskCard key={task.id} task={task} status="completed" />
                  ))}
                </div>
              )}

              {/* ═══ Section: Công cụ — ẩn SMS Webhook cho v1, bật lại khi NEXT_PUBLIC_SMS_WEBHOOK_ENABLED=true ═══ */}
              {isSmsWebhookEnabled() && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-sm)' }}>
                    🛠️ Công cụ
                  </p>
                  <button
                    type="button"
                    className="glass-card"
                    onClick={() => router.push('/settings/sms-webhook')}
                    aria-label="Mở cài đặt SMS Webhook"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-md)',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(249, 115, 22, 0.04))',
                      border: '1px solid rgba(124, 58, 237, 0.18)',
                    }}
                  >
                    <span style={{ fontSize: '1.6rem', flexShrink: 0 }} aria-hidden>🤖</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 4 }}>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--c-text-primary)' }}>
                          Tự động ghi giao dịch SMS
                        </p>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--gradient-primary)',
                          color: '#fff',
                        }}>
                          PRO
                        </span>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
                        Liên kết SMS ngân hàng — không cần API
                      </p>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} aria-hidden />
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="cfo"
              custom={direction}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* ═══ TAB 2: CFO Report ═══ */}
              <CFOInsightCard
                insight={cfoInsight}
                isLoading={cfoLoading}
                error={cfoError}
                lastUpdated={cfoLastUpdated}
                onRefresh={handleCfoRefresh}
              />
              <StackedBarChart data={weeklyComparison} />
              <SavingsLineChart data={savingsGrowth} />
              <HealthScoreGauge score={breakdown.total} />

              <Link href="/report" className="money-report-cta">
                <BarChart2 size={16} />
                <span>Xem báo cáo đầy đủ tháng này</span>
                <ChevronRight size={16} />
              </Link>

              {isAiMoneyChatEnabled() && (
                <Link href="/chat" className="money-report-cta money-chat-cta">
                  <MessageCircle size={16} />
                  <span>Nhập giao dịch bằng AI Money Chat</span>
                  <ChevronRight size={16} />
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <TaskFormModal
        isOpen={showForm}
        onClose={handleCloseForm}
        onSubmit={addTask}
        editTask={editingTask}
        draft={draft}
        onUpdate={updateTask}
      />
      <EarningIdeasSheet
        isOpen={ideasOpen}
        initialThemeId={ideasTheme}
        onClose={() => setIdeasOpen(false)}
        onPick={handlePickTemplate}
      />
      <TaskSettleSheet
        task={settleTask}
        mode={settle?.mode ?? 'done'}
        onClose={closeSettle}
        onReceive={handleReceive}
        onAwait={handleAwait}
        onReschedule={handleReschedule}
      />
      <TaskUndoToast toast={toast} onDismiss={dismissToast} />
      <TaskOverdueDialog
        isOpen={!!overdueTarget}
        taskName={overdueTaskName}
        onSelect={handleOverdueReason}
        onCancel={() => setOverdueTarget(null)}
      />
    </div>
  );
}
