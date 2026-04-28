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
import { useIncomeCelebration } from '@/hooks/useIncomeCelebration';
import type { OverdueReason, EarningTask } from '@/types/task';
import HallOfFame from './HallOfFame';
import TaskCard from './TaskCard';
import TaskFormModal from './TaskFormModal';
import TaskOverdueDialog from './TaskOverdueDialog';
import CFOInsightCard from './CFOInsightCard';
import StackedBarChart from './StackedBarChart';
import SavingsLineChart from './SavingsLineChart';
import HealthScoreGauge from './HealthScoreGauge';
import { Plus, ChevronRight } from 'lucide-react';
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
  const completeTask = useTaskStore((s) => s.completeTask);
  const deleteOverdueTask = useTaskStore((s) => s.deleteOverdueTask);
  const getStatus = useTaskStore((s) => s.getStatus);

  // XP đọc từ store (demo bypass set xp=2500). Fallback 0 khi profile chưa init.
  const currentXP = useAuthStore((s) => s.user?.xp ?? 0);

  const { weeklyComparison, savingsGrowth } = useChartData();
  const { fireConfetti } = useIncomeCelebration();

  // === CFO state — lifted lên đây để share giữa CFOInsightCard + HealthScoreGauge ===
  const { payload, breakdown, cacheKey } = useCFOSnapshot();
  const {
    insight: cfoInsight,
    isLoading: cfoLoading,
    error: cfoError,
    lastUpdated: cfoLastUpdated,
    fetchInsight,
  } = useCFOReport();

  // Auto-fetch khi cacheKey đổi (data tháng/ngày thay đổi). Hook tự dedupe + cache.
  useEffect(() => {
    fetchInsight(payload, { cacheKey });
  }, [cacheKey, payload, fetchInsight]);

  const handleCfoRefresh = useCallback(() => {
    fetchInsight(payload, { cacheKey, forceRefresh: true });
  }, [payload, cacheKey, fetchInsight]);

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<EarningTask | null>(null);
  const [overdueTarget, setOverdueTarget] = useState<string | null>(null);

  const activeTasks = tasks.filter((t) => !t.deletedAt && !t.completedAt);
  const completedTasks = tasks.filter((t) => t.completedAt);
  const overdueTaskName = overdueTarget
    ? tasks.find((t) => t.id === overdueTarget)?.name || ''
    : '';

  const handleComplete = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      completeTask(id, task.expectedAmount);
      fireConfetti();
    }
  }, [tasks, completeTask, fireConfetti]);

  const handleOverdueReason = useCallback((reason: OverdueReason) => {
    if (overdueTarget) {
      deleteOverdueTask(overdueTarget, reason);
      setOverdueTarget(null);
    }
  }, [overdueTarget, deleteOverdueTask]);

  const handleEdit = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) { setEditingTask(task); setShowForm(true); }
  }, [tasks]);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingTask(null);
  }, []);

  const switchTab = (tab: MoneyTab) => {
    if (tab === activeTab) return;
    setDirection(tab === 'cfo' ? 1 : -1);
    setActiveTab(tab);
  };

  // Stats
  const completedCount = completedTasks.length;
  const activeCount = activeTasks.filter((t) => getStatus(t) === 'active').length;
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

              {/* Active Task List */}
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  status={getStatus(task)}
                  onComplete={handleComplete}
                  onOverdueAction={setOverdueTarget}
                  onEdit={handleEdit}
                />
              ))}

              {/* Add Task button */}
              <button className="btn btn-primary btn-full btn-lg" onClick={() => setShowForm(true)} style={{ marginTop: 'var(--space-sm)' }}>
                <Plus size={18} /> <span>Thêm nhiệm vụ kiếm tiền</span>
              </button>

              {/* Completed Tasks — History */}
              {completedTasks.length > 0 && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-sm)' }}>
                    ✅ Lịch sử hoàn thành ({completedTasks.length})
                  </p>
                  {completedTasks.slice(0, 3).map((task) => (
                    <TaskCard key={task.id} task={task} status="completed" onComplete={() => {}} onOverdueAction={() => {}} />
                  ))}
                </div>
              )}

              {/* ═══ Section: Công cụ — entry point cho các tính năng phụ trợ ═══ */}
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
        onUpdate={updateTask}
      />
      <TaskOverdueDialog
        isOpen={!!overdueTarget}
        taskName={overdueTaskName}
        onSelect={handleOverdueReason}
        onCancel={() => setOverdueTarget(null)}
      />
    </div>
  );
}
