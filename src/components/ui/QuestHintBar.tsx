/* ═══ QuestHintBar — Sticky banner trên destination khi đang làm quest ═══
 *
 * Mount ở (app)/layout.tsx — single instance.
 * Render khi useQuestStore.activeContext không null.
 * Hiển thị quest icon + name + progress + nút Ẩn/Bỏ.
 *
 * Auto-clear context sau 30s nếu user không có tiến độ.
 * Auto-clear khi quest complete (QuestCompletionPopup sẽ kế tiếp xử lý).
 */
'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Target, EyeOff, X } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { collectAllMetrics, collectSeasonalDelta } from '@/lib/questMetrics';
import { ONBOARDING_QUEST_BY_ID } from '@/data/onboardingQuests';
import { DAILY_QUEST_BY_ID } from '@/data/dailyQuestPool';
import { pickWeeklyChallenge } from '@/data/weeklyChallenges';
import './QuestHintBar.css';

const STALE_TIMEOUT_MS = 30_000; // 30s không tương tác → clear

interface QuestPreview {
  title: string;
  icon: string;
  progress: number;     // 0..1
  current: number;
  target: number;
  displaySuffix?: string; // "/2 ghi" hoặc "tr/5tr"
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function QuestHintBar() {
  const router = useRouter();
  const activeContext = useQuestStore((s) => s.activeContext);
  const clearActiveContext = useQuestStore((s) => s.clearActiveContext);
  const toggleHintBarHidden = useQuestStore((s) => s.toggleHintBarHidden);
  const onboardingInstances = useQuestStore((s) => s.onboardingInstances);
  const dailyInstances = useQuestStore((s) => s.dailyInstances);
  const weeklyInstance = useQuestStore((s) => s.weeklyInstance);
  const seasonalChapterInstances = useQuestStore((s) => s.seasonalChapterInstances);
  const getCurrentSeasonal = useQuestStore((s) => s.getCurrentSeasonal);

  // Subscribe stores để re-render khi data đổi
  useAuthStore((s) => s.user);
  useFinanceStore((s) => s.transactions);

  // Stale timeout — reset mỗi khi activeContext đổi (user mới bấm "Làm ngay")
  useEffect(() => {
    if (!activeContext) return;
    const timer = setTimeout(() => {
      clearActiveContext();
    }, STALE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [activeContext, clearActiveContext]);

  if (!activeContext || activeContext.hintHidden) {
    // Khi user đã ẩn hint bar → vẫn render mini chip "Hiện nhiệm vụ"
    if (activeContext?.hintHidden) {
      return (
        <button
          className="qhb-mini-show"
          onClick={() => toggleHintBarHidden()}
          aria-label="Hiện nhiệm vụ đang làm"
        >
          <Target size={14} />
        </button>
      );
    }
    return null;
  }

  // Compute preview theo questType
  const preview = computePreview(
    activeContext,
    onboardingInstances,
    dailyInstances,
    weeklyInstance,
    seasonalChapterInstances,
    getCurrentSeasonal
  );

  if (!preview) return null;

  const isDone = preview.progress >= 1;

  return (
    <AnimatePresence>
      <motion.div
        key={activeContext.questId}
        className={`qhb-bar ${isDone ? 'qhb-bar--done' : ''}`}
        initial={{ y: -80, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -60, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26, mass: 0.8 }}
      >
        <div className="qhb-icon">{preview.icon}</div>
        <div className="qhb-body">
          <div className="qhb-row">
            <p className="qhb-title">{preview.title}</p>
            <span className="qhb-count">
              {formatNumber(preview.current)}/{formatNumber(preview.target)}
              {preview.displaySuffix && (
                <span className="qhb-suffix">{preview.displaySuffix}</span>
              )}
            </span>
          </div>
          <div className="qhb-progress">
            <motion.div
              className="qhb-progress-fill"
              animate={{ width: `${Math.min(100, preview.progress * 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
        <div className="qhb-actions">
          <button
            type="button"
            className="qhb-action-btn"
            onClick={() => toggleHintBarHidden()}
            aria-label="Ẩn"
            title="Ẩn hint bar"
          >
            <EyeOff size={14} />
          </button>
          <button
            type="button"
            className="qhb-action-btn"
            onClick={() => {
              clearActiveContext();
              router.push(activeContext.returnPath);
            }}
            aria-label="Bỏ"
            title="Bỏ nhiệm vụ + quay về"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Compute preview cho hint bar dựa trên context + store state. */
function computePreview(
  ctx: { questId: string; questType: string },
  onboardingInstances: Record<string, { completedAt?: string }>,
  dailyInstances: Record<string, { completedAt?: string }>,
  weeklyInstance: { completedAt?: string; templateId?: string } | null,
  seasonalChapterInstances: Record<string, { completedAt?: string }>,
  getCurrentSeasonal: () => { chapters: Array<{ id: string; title: string; icon: string; metric: string; target: number }> } | null
): QuestPreview | null {
  const metrics = collectAllMetrics();

  if (ctx.questType === 'onboarding') {
    const quest = ONBOARDING_QUEST_BY_ID[ctx.questId];
    if (!quest) return null;
    const current = (metrics.onboarding as Record<string, number>)[quest.metric] ?? 0;
    return {
      title: quest.title,
      icon: quest.icon,
      current,
      target: quest.target,
      progress: Math.min(1, current / quest.target),
    };
  }

  if (ctx.questType === 'daily') {
    const tpl = DAILY_QUEST_BY_ID[ctx.questId];
    if (!tpl) return null;
    const current = (metrics.daily as Record<string, number>)[tpl.metric] ?? 0;
    return {
      title: tpl.title,
      icon: tpl.icon,
      current,
      target: tpl.target,
      progress: Math.min(1, current / tpl.target),
    };
  }

  if (ctx.questType === 'weekly') {
    const tpl = pickWeeklyChallenge(new Date());
    const current = (metrics.weekly as Record<string, number>)[tpl.metric] ?? 0;
    const { target } = tpl.computeTarget(metrics.lastMonthIncome);
    return {
      title: tpl.title,
      icon: tpl.icon,
      current,
      target,
      progress: Math.min(1, current / target),
    };
  }

  if (ctx.questType === 'seasonal') {
    const event = getCurrentSeasonal();
    if (!event) return null;
    const chapter = event.chapters.find((c) => c.id === ctx.questId);
    if (!chapter) return null;
    // Cần seasonal delta — đọc startedAt từ store
    const startedAt = useQuestStore.getState().seasonalStartedAt;
    if (!startedAt) return null;
    const delta = collectSeasonalDelta(startedAt);
    const current = (delta as Record<string, number>)[chapter.metric] ?? 0;
    return {
      title: chapter.title,
      icon: chapter.icon,
      current,
      target: chapter.target,
      progress: Math.min(1, current / chapter.target),
    };
  }

  return null;
}
