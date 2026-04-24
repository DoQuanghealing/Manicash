/* ═══ Money Content — Dual-Tab: Money + CFO Report ═══ */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '@/stores/useTaskStore';
import { useChartData } from '@/hooks/useChartData';
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
import { Plus } from 'lucide-react';
import './money.css';

const DEMO_XP = 1_250;

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
  const [activeTab, setActiveTab] = useState<MoneyTab>('money');
  const [direction, setDirection] = useState(0);

  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const deleteOverdueTask = useTaskStore((s) => s.deleteOverdueTask);
  const getStatus = useTaskStore((s) => s.getStatus);

  const { weeklyComparison, savingsGrowth, healthScore } = useChartData();
  const { fireConfetti } = useIncomeCelebration();

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
              <HallOfFame currentXP={DEMO_XP} />

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
              <CFOInsightCard />
              <StackedBarChart data={weeklyComparison} />
              <SavingsLineChart data={savingsGrowth} />
              <HealthScoreGauge score={healthScore} />
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
