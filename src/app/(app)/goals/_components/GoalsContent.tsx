/* ═══ Goals Content — Dual-Tab: Mục tiêu lớn | Wishlist ═══ */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import GoalCard from './GoalCard';
import GoalFormModal from './GoalFormModal';
import WishlistPanel from './WishlistPanel';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import MilestoneCelebration from '@/components/ui/MilestoneCelebration';
import TabSwitcher from '@/components/ui/TabSwitcher';
import { Plus } from 'lucide-react';

type GoalsTab = 'goals' | 'wishlist';

const GOALS_TABS = [
  { key: 'goals', label: 'Mục tiêu lớn', icon: '🎯' },
  { key: 'wishlist', label: 'Wishlist', icon: '🧊' },
];

export default function GoalsContent() {
  const [activeTab, setActiveTab] = useState<GoalsTab>('goals');

  const goals = useGoalsStore((s) => s.goals);
  const totalSaved = useGoalsStore((s) => s.getTotalSaved());
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const addGoal = useGoalsStore((s) => s.addGoal);
  const deleteGoal = useGoalsStore((s) => s.deleteGoal);
  const completeMilestone = useGoalsStore((s) => s.completeMilestone);

  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);

  const handleCompleteMilestone = useCallback((goalId: string, msId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    const ms = goal?.milestones.find((m) => m.id === msId);
    completeMilestone(goalId, msId);
    if (ms) setCelebration(ms.name);
  }, [goals, completeMilestone]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteGoal(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteGoal]);

  return (
    <div className="stack stack-md">
      {/* ═══ Tab Switcher: Mục tiêu lớn | Wishlist ═══ */}
      <TabSwitcher
        tabs={GOALS_TABS}
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as GoalsTab)}
      />

      {/* ═══ Tab Content ═══ */}
      <AnimatePresence mode="wait">
        {activeTab === 'goals' ? (
          <motion.div
            key="goals"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Total overview */}
            <div className="glass-card" style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(249,115,22,0.06))',
              border: '1px solid rgba(124,58,237,0.2)',
              textAlign: 'center',
              marginBottom: 'var(--space-md)',
            }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)', marginBottom: 4 }}>
                Tổng đã tích lũy
              </p>
              <p className="heading-lg text-gradient">{formatCurrency(totalSaved)}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-secondary)', marginTop: 4 }}>
                / {formatCurrencyShort(totalTarget)} tổng mục tiêu
              </p>
            </div>

            {/* Goal list */}
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDelete={setDeleteTarget}
                onCompleteMilestone={handleCompleteMilestone}
              />
            ))}

            {/* Add button */}
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={() => setShowForm(true)}
              style={{ marginTop: 'var(--space-sm)' }}
            >
              <Plus size={18} />
              <span>Thêm mục tiêu</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="wishlist"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <WishlistPanel />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <GoalFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={addGoal}
      />

      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        title="Xóa mục tiêu?"
        message="Bạn có chắc muốn xóa mục tiêu này? Hành động này không thể hoàn tác."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <MilestoneCelebration
        isVisible={!!celebration}
        milestoneName={celebration || ''}
        onDone={() => setCelebration(null)}
      />
    </div>
  );
}
