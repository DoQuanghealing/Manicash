/* ═══ TaskEvalPanel — Quản gia thẩm định nhiệm vụ (T5 · Cấp 3) ═══
 * CHỈ tier Phú Vương (task.eval). Điểm khả thi hiện LIVE (deterministic, 0đ); nút
 * "Quản gia thẩm định" gọi AI (gợi ý subtask thiếu/rủi ro/giá/coach) — cache theo hash
 * trên task, sửa task → gọi lại. Fallback deterministic khi hết quota/lỗi (0đ).
 */
'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EarningTask } from '@/types/task';
import type { MoneyTaskSnapshot } from '@/lib/moneyBrain/types';
import { useTaskStore } from '@/stores/useTaskStore';
import { useCapacitySurveyStore } from '@/stores/useCapacitySurveyStore';
import { hasFeature, tasteQuotaFor, minLevelFor } from '@/lib/monetization/butlerFeatures';
import { useEffectiveButlerLevel } from '@/hooks/useEffectiveButlerLevel';
import { computeTaskFeasibility } from '@/lib/aiMoneyChat/taskEval/taskFeasibility';
import { computeTaskEvalHash } from '@/lib/aiMoneyChat/taskEval/taskEvalHash';
import { buildTaskEvalContext } from '@/lib/aiMoneyChat/taskEval/taskEvalContext';
import { requestTaskEval } from '@/lib/aiMoneyChat/taskEval/taskEvalClient';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './TaskEvalPanel.css';

function scoreBand(score: number): { color: string; label: string } {
  if (score >= 70) return { color: '#22C55E', label: 'Khả quan' };
  if (score >= 40) return { color: '#F59E0B', label: 'Cần đẩy nhanh' };
  return { color: '#EF4444', label: 'Rủi ro cao' };
}

interface TaskEvalPanelProps {
  task: EarningTask;
}

export default function TaskEvalPanel({ task }: TaskEvalPanelProps) {
  const allTasks = useTaskStore((s) => s.tasks);
  const setTaskAiEval = useTaskStore((s) => s.setTaskAiEval);
  const skills = useCapacitySurveyStore((s) => s.answers.skills);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Hiện panel khi đủ cấp HOẶC được nếm thử (kém đúng 1 cấp). Server chốt số lượt thật.
  const { level } = useEffectiveButlerLevel();
  const canEval =
    hasFeature(level, 'task.eval') ||
    (tasteQuotaFor('task.eval') > 0 && level >= minLevelFor('task.eval') - 1);
  // Điểm khả thi LIVE gate theo ĐÚNG feature của nó (backlog B4 — trước gate nhầm
  // vào task.eval). Taster (cấp 2) vẫn thấy nút AI nhưng không thấy điểm live.
  const canWatch = hasFeature(level, 'task.completion.watch');

  // Điểm khả thi LIVE (0đ, realtime) — luôn tính client-side.
  const feasibility = useMemo(
    () => computeTaskFeasibility(task as MoneyTaskSnapshot, allTasks as MoneyTaskSnapshot[], new Date().toISOString()),
    [task, allTasks],
  );

  const currentHash = useMemo(() => computeTaskEvalHash(task), [task]);
  const cached = task.aiEval && task.aiEval.hash === currentHash ? task.aiEval : null;

  if (!canEval && !canWatch) return null;

  async function onEvaluate() {
    setLoading(true);
    try {
      const ctx = buildTaskEvalContext(task, allTasks, skills, new Date().toISOString());
      const out = await requestTaskEval(ctx);
      setNotice(
        out.upgradeRequired
          ? out.reason
          : out.taste
            ? `Lượt nếm thử — còn ${out.taste.remaining}/${out.taste.quota} lượt tháng này.`
            : null,
      );
      setTaskAiEval(task.id, {
        hash: currentHash,
        feasibility: out.feasibility,
        missingSubtasks: out.ai.missingSubtasks,
        risks: out.ai.risks,
        suggestedPriceRange: out.ai.suggestedPriceRange,
        oneLineCoach: out.ai.oneLineCoach,
        deterministicFallback: out.deterministicFallback,
        at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }

  const band = scoreBand(feasibility.score);

  return (
    <div className="te-panel">
      {/* Điểm khả thi deterministic (0đ) — feature task.completion.watch (cấp 3) */}
      {canWatch && (
      <div className="te-score-row">
        <div className="te-score-head">
          <span className="te-score-title">🧭 Khả năng hoàn thành</span>
          <span className="te-score-val" style={{ color: band.color }}>{feasibility.score}/100 · {band.label}</span>
        </div>
        <div className="te-score-bar">
          <div className="te-score-fill" style={{ width: `${feasibility.score}%`, background: band.color }} />
        </div>
        <span className="te-score-sub">
          {feasibility.signals.subtaskDone}/{feasibility.signals.subtaskTotal} bước ·{' '}
          {feasibility.signals.daysLeft >= 0 ? `còn ${feasibility.signals.daysLeft} ngày` : `trễ ${-feasibility.signals.daysLeft} ngày`} ·{' '}
          lịch sử {feasibility.signals.historicalRate}%
        </span>
      </div>
      )}

      {/* Nút AI thẩm định — feature task.eval (cấp 3, Pro nếm 5 lượt/tháng) */}
      {canEval && (
      <button className="te-btn" onClick={onEvaluate} disabled={loading}>
        {loading ? '⏳ Quản gia đang xem…' : cached ? '🔄 Thẩm định lại' : '🧠 Quản gia thẩm định'}
      </button>
      )}

      {notice && <p className="te-notice">{notice}</p>}

      {/* Kết quả AI (cache theo hash) */}
      <AnimatePresence>
        {cached && (
          <motion.div
            className="te-result"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="te-coach">💬 {cached.oneLineCoach}</p>

            {cached.missingSubtasks.length > 0 && (
              <div className="te-block">
                <span className="te-block-title">Nên bổ sung</span>
                <ul>{cached.missingSubtasks.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {cached.risks.length > 0 && (
              <div className="te-block te-block--risk">
                <span className="te-block-title">Rủi ro</span>
                <ul>{cached.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {cached.suggestedPriceRange && (
              <div className="te-price">
                💰 Khoảng giá đề xuất: {formatCurrencyShort(cached.suggestedPriceRange.min)} – {formatCurrencyShort(cached.suggestedPriceRange.max)}
              </div>
            )}
            {cached.deterministicFallback && (
              <span className="te-note">Bản đánh giá cơ bản — không tốn credit.</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
