'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  Lightbulb,
  Sparkles,
  Download,
  Printer,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { formatCurrency } from '@/utils/formatCurrency';
import HealthScoreGauge from '@/app/(app)/money/_components/HealthScoreGauge';
import { buildLocalCfoNarration, type CfoNarrationInput } from '@/lib/aiMoneyChat/cfoNarration';
import { requestCfoNarration } from '@/lib/aiMoneyChat/cfoNarrationClient';
import { buildMonthlyReportCsv, downloadCsv } from '@/lib/aiMoneyChat/reportExport';
import { trackEvent } from '@/lib/analytics/events';
import { useIsPro } from '@/hooks/useIsPro';
import ProGate from '@/components/ui/ProGate';
import './cfo-report.css';

function getCurrentMonthLabel(): string {
  const now = new Date();
  return `tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function CfoReportContent() {
  const transactions = useFinanceStore((s) => s.transactions);
  const getMonthlyIncome = useFinanceStore((s) => s.getMonthlyIncome);
  const getMonthlyExpense = useFinanceStore((s) => s.getMonthlyExpense);
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const currentBudgetMonth = useBudgetStore((s) => s.currentMonth);
  const goals = useGoalsStore((s) => s.goals);
  const expenseCategories = useCategoryStore((s) => s.expenseCategories);

  const monthKey = getCurrentMonthKey();
  const monthLabel = getCurrentMonthLabel();

  const monthlyIncome = useMemo(() => getMonthlyIncome(), [getMonthlyIncome]);
  const monthlyExpense = useMemo(() => getMonthlyExpense(), [getMonthlyExpense]);
  const monthlySavings = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0;

  const categoryTotals = useMemo(() => {
    const monthlyTxns = transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(monthKey),
    );
    const totals: Record<string, number> = {};
    for (const t of monthlyTxns) {
      totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
    }
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([catId, amount]) => {
        const cat = expenseCategories.find((c) => c.id === catId);
        return {
          id: catId,
          name: cat?.name ?? catId,
          icon: (cat as { icon?: string } | undefined)?.icon ?? '💸',
          amount,
        };
      });
  }, [transactions, monthKey, expenseCategories]);

  const budgetStats = useMemo(() => {
    const thisMonthBudgets = categoryBudgets.filter((b) => b.month === currentBudgetMonth);
    if (!thisMonthBudgets.length) return { onTrack: 0, total: 0, rate: 50 };
    const onTrack = thisMonthBudgets.filter((b) => {
      const spent = categoryTotals.find((c) => c.id === b.categoryId)?.amount ?? 0;
      return spent <= b.monthlyLimit;
    }).length;
    return {
      onTrack,
      total: thisMonthBudgets.length,
      rate: Math.round((onTrack / thisMonthBudgets.length) * 100),
    };
  }, [categoryBudgets, currentBudgetMonth, categoryTotals]);

  const activeGoals = useMemo(() => {
    return goals
      .filter((g) => g.currentAmount < g.targetAmount)
      .map((g) => ({
        ...g,
        progress: Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)),
        remaining: g.targetAmount - g.currentAmount,
      }));
  }, [goals]);

  const healthScore = useMemo(() => {
    let score = 0;
    // Savings: 0-40 pts (20%+ savings = full)
    score += Math.min(40, Math.max(0, savingsRate * 2));
    // Budget compliance: 0-30 pts
    score += Math.round((budgetStats.rate / 100) * 30);
    // Goals progress: 0-30 pts
    const avgGoalProgress =
      activeGoals.length > 0
        ? activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length
        : 50;
    score += Math.round((avgGoalProgress / 100) * 30);
    return Math.min(100, Math.round(score));
  }, [savingsRate, budgetStats, activeGoals]);

  const tier = healthScore >= 70 ? 'good' : healthScore >= 40 ? 'fair' : 'poor';
  const tierLabel = { good: 'Sức khỏe tốt', fair: 'Cần chú ý', poor: 'Cần cải thiện' }[tier];
  const tierSummary = {
    good: `Tháng này bạn quản lý tài chính rất tốt — tiết kiệm được ${savingsRate}% thu nhập. Tiếp tục phong độ này!`,
    fair: `Tháng này ổn nhưng còn room để cải thiện. Tỷ lệ tiết kiệm ${savingsRate}% — mục tiêu lý tưởng là 20%+.`,
    poor: `Tháng này chi tiêu vượt kế hoạch. Hãy xem lại danh mục nào đang vượt ngân sách.`,
  }[tier];

  const actionPlan = useMemo(() => {
    const actions: string[] = [];
    if (categoryTotals[0]) {
      actions.push(`Xem lại "${categoryTotals[0].name}" — danh mục tốn nhiều nhất tháng này (${formatCurrency(categoryTotals[0].amount)}).`);
    }
    if (savingsRate < 20) {
      actions.push('Đặt mục tiêu tiết kiệm tối thiểu 20% thu nhập tháng tới.');
    } else {
      actions.push(`Duy trì tỷ lệ tiết kiệm ${savingsRate}% — bạn đang đúng hướng.`);
    }
    if (activeGoals[0]) {
      actions.push(`Nạp thêm vào "${activeGoals[0].name}" — còn ${formatCurrency(activeGoals[0].remaining)} để đạt đích.`);
    } else {
      actions.push('Đối chiếu số dư ngân hàng để đảm bảo không bị lệch giao dịch.');
    }
    // Mục sâu hơn (chủ yếu hiện cho Pro)
    if (categoryTotals[1]) {
      actions.push(`Đặt hạn mức cho "${categoryTotals[1].name}" (${formatCurrency(categoryTotals[1].amount)}) để kiểm soát tháng tới.`);
    }
    actions.push('Tự động trích tiết kiệm ngay khi có thu nhập (pay yourself first), trước khi chi.');
    return actions.slice(0, 5);
  }, [categoryTotals, savingsRate, activeGoals]);

  // ── Rủi ro & Cơ hội (deterministic) — free xem 1 rủi ro, Pro xem đầy đủ ──
  const riskItems = useMemo(() => {
    const r: string[] = [];
    if (monthlySavings < 0) {
      r.push(`Chi vượt thu ${formatCurrency(Math.abs(monthlySavings))} tháng này — dòng tiền âm.`);
    } else if (savingsRate < 20) {
      r.push(`Tỷ lệ tiết kiệm chỉ ${savingsRate}% (lý tưởng ≥ 20%).`);
    }
    const overBudget = categoryBudgets
      .filter((b) => b.month === currentBudgetMonth)
      .filter((b) => (categoryTotals.find((c) => c.id === b.categoryId)?.amount ?? 0) > b.monthlyLimit);
    for (const b of overBudget.slice(0, 2)) {
      const cat = expenseCategories.find((c) => c.id === b.categoryId);
      const spent = categoryTotals.find((c) => c.id === b.categoryId)?.amount ?? 0;
      r.push(`"${cat?.name ?? b.categoryId}" vượt ngân sách (${formatCurrency(spent)} / ${formatCurrency(b.monthlyLimit)}).`);
    }
    if (categoryTotals[0] && monthlyExpense > 0) {
      const share = Math.round((categoryTotals[0].amount / monthlyExpense) * 100);
      if (share >= 40) r.push(`"${categoryTotals[0].name}" chiếm ${share}% tổng chi — khá tập trung vào một nhóm.`);
    }
    if (r.length === 0) r.push('Chưa phát hiện rủi ro lớn — giữ phong độ này.');
    return r;
  }, [monthlySavings, savingsRate, categoryBudgets, currentBudgetMonth, categoryTotals, expenseCategories, monthlyExpense]);

  const opportunityItems = useMemo(() => {
    const o: string[] = [];
    if (categoryTotals[0]) {
      o.push(`Cắt 10% "${categoryTotals[0].name}" → để dành thêm ~${formatCurrency(Math.round(categoryTotals[0].amount * 0.1))}/tháng.`);
    }
    if (activeGoals[0]) {
      o.push(`Dồn lực cho "${activeGoals[0].name}" — chỉ còn ${formatCurrency(activeGoals[0].remaining)} là cán đích.`);
    }
    o.push(savingsRate >= 20
      ? `Tiết kiệm ${savingsRate}% rất tốt — cân nhắc đầu tư phần dư để tiền tự sinh lời.`
      : 'Lập quỹ khẩn cấp 3–6 tháng chi tiêu trước khi nghĩ tới đầu tư.');
    return o;
  }, [categoryTotals, activeGoals, savingsRate]);

  const FREE_ACTION_COUNT = 2;

  const expenseBarWidth = monthlyIncome > 0
    ? Math.min(100, Math.round((monthlyExpense / monthlyIncome) * 100))
    : 0;

  const narrationInput: CfoNarrationInput = useMemo(
    () => ({
      monthLabel,
      tier,
      healthScore,
      income: monthlyIncome,
      expense: monthlyExpense,
      savings: monthlySavings,
      savingsRate,
      topCategory: categoryTotals[0]
        ? { name: categoryTotals[0].name, amount: categoryTotals[0].amount }
        : null,
      topGoal: activeGoals[0]
        ? { name: activeGoals[0].name, progress: activeGoals[0].progress, remaining: activeGoals[0].remaining }
        : null,
      budgetOnTrack: budgetStats.onTrack,
      budgetTotal: budgetStats.total,
    }),
    [monthLabel, tier, healthScore, monthlyIncome, monthlyExpense, monthlySavings, savingsRate, categoryTotals, activeGoals, budgetStats],
  );

  const isPro = useIsPro();
  const [narration, setNarration] = useState<string>(() => buildLocalCfoNarration(narrationInput));
  const [narrationSource, setNarrationSource] = useState<'local' | 'ai'>('local');
  const [narrationCached, setNarrationCached] = useState(false);
  const [narrationLoading, setNarrationLoading] = useState(false);

  useEffect(() => {
    trackEvent('cfo_report_view', { healthScore, tier });
  }, [healthScore, tier]);

  async function handleAskLordDiamond() {
    setNarrationLoading(true);
    const result = await requestCfoNarration(narrationInput);
    setNarration(result.text);
    setNarrationSource(result.source === 'ai' ? 'ai' : 'local');
    setNarrationCached(result.cached);
    setNarrationLoading(false);
    trackEvent('cfo_narration', { source: result.source, cached: result.cached });
  }

  function handleExportCsv() {
    const csv = buildMonthlyReportCsv({
      monthLabel,
      income: monthlyIncome,
      expense: monthlyExpense,
      savings: monthlySavings,
      savingsRate,
      healthScore,
      tierLabel,
      categories: categoryTotals.map((c) => ({ name: c.name, amount: c.amount })),
      goals: activeGoals.map((g) => ({
        name: g.name,
        current: g.currentAmount,
        target: g.targetAmount,
        progress: g.progress,
      })),
      actionPlan,
    });
    downloadCsv(`manicash-bao-cao-${monthKey}.csv`, csv);
    trackEvent('report_export', { format: 'csv' });
  }

  function handlePrint() {
    if (typeof window !== 'undefined') window.print();
    trackEvent('report_export', { format: 'print' });
  }

  return (
    <div className="cfo-report">
      {/* Back nav */}
      <div className="cfo-nav">
        <Link href="/money" className="cfo-back-btn">
          <ArrowLeft size={18} />
          <span>Money</span>
        </Link>
        <p className="cfo-nav-title">Báo cáo {monthLabel}</p>
      </div>

      {/* Hero */}
      <section className={`cfo-hero cfo-hero-${tier}`}>
        <p className={`cfo-tier-badge cfo-tier-${tier}`}>{tierLabel}</p>
        <p className="cfo-summary-text">{tierSummary}</p>
      </section>

      {/* Lord Diamond narration (Phase 13) */}
      <section className="cfo-section cfo-narration">
        <div className="cfo-narration-head">
          <div className="cfo-narration-avatar" aria-hidden="true">LD</div>
          <div className="cfo-narration-meta">
            <span className="cfo-narration-name">Lord Diamond</span>
            <span className={`cfo-narration-tag cfo-narration-tag-${narrationSource}`}>
              {narrationSource === 'ai' ? 'AI Pro' : 'Bản local'}
            </span>
          </div>
        </div>
        <p className="cfo-narration-text">{narration}</p>
        {isPro ? (
          <div className="cfo-narration-actions">
            <button
              type="button"
              className="cfo-narration-btn"
              onClick={handleAskLordDiamond}
              disabled={narrationLoading}
            >
              {narrationLoading ? <Loader2 size={15} className="cfo-spin" /> : <Sparkles size={15} />}
              {narrationLoading ? 'Lord Diamond đang viết...' : 'Hỏi Lord Diamond (AI Pro)'}
            </button>
            {narrationSource === 'ai' && narrationCached && (
              <span className="cfo-narration-cached">Đã lưu — không tốn credit</span>
            )}
          </div>
        ) : (
          <ProGate feature="cfo_narration" label="CFO Lord Diamond viết riêng">
            <></>
          </ProGate>
        )}
      </section>

      {/* Health Score */}
      <section className="cfo-section">
        <HealthScoreGauge score={healthScore} />
      </section>

      {/* Cashflow */}
      <section className="cfo-section">
        <h2 className="cfo-section-title">
          <Wallet size={16} />
          Dòng tiền tháng này
        </h2>
        <div className="cfo-cashflow">
          <div className="cfo-cf-item">
            <div className="cfo-cf-label-row">
              <TrendingUp size={14} className="cfo-cf-icon-income" />
              <span className="cfo-cf-label">Thu nhập</span>
              <span className="cfo-cf-amount cfo-cf-amount-income">{formatCurrency(monthlyIncome)}</span>
            </div>
            <div className="cfo-cf-bar-track">
              <div className="cfo-cf-bar cfo-cf-bar-income" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="cfo-cf-item">
            <div className="cfo-cf-label-row">
              <TrendingDown size={14} className="cfo-cf-icon-expense" />
              <span className="cfo-cf-label">Chi tiêu</span>
              <span className="cfo-cf-amount cfo-cf-amount-expense">{formatCurrency(monthlyExpense)}</span>
            </div>
            <div className="cfo-cf-bar-track">
              <div className="cfo-cf-bar cfo-cf-bar-expense" style={{ width: `${expenseBarWidth}%` }} />
            </div>
          </div>

          <div className="cfo-cf-savings-row">
            <span className="cfo-cf-savings-label">Tiết kiệm được</span>
            <span className={`cfo-cf-savings-amount ${monthlySavings >= 0 ? 'is-positive' : 'is-negative'}`}>
              {monthlySavings >= 0 ? formatCurrency(monthlySavings) : `−${formatCurrency(Math.abs(monthlySavings))}`}
            </span>
            {savingsRate !== 0 && (
              <span className={`cfo-cf-savings-rate ${savingsRate >= 20 ? 'is-good' : savingsRate > 0 ? 'is-fair' : 'is-poor'}`}>
                {savingsRate}%
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Top Categories */}
      {categoryTotals.length > 0 && (
        <section className="cfo-section">
          <h2 className="cfo-section-title">
            <TrendingDown size={16} />
            Top danh mục chi tiêu
          </h2>
          <div className="cfo-categories">
            {categoryTotals.map((cat, i) => (
              <div key={cat.id} className="cfo-cat-row">
                <span className="cfo-cat-icon">{cat.icon}</span>
                <div className="cfo-cat-detail">
                  <div className="cfo-cat-header">
                    <span className="cfo-cat-name">{cat.name}</span>
                    <span className="cfo-cat-amount">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="cfo-cat-bar-track">
                    <div
                      className="cfo-cat-bar"
                      style={{
                        width:
                          categoryTotals[0].amount > 0
                            ? `${Math.round((cat.amount / categoryTotals[0].amount) * 100)}%`
                            : '0%',
                        opacity: 1 - i * 0.15,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Goals */}
      {activeGoals.length > 0 && (
        <section className="cfo-section">
          <h2 className="cfo-section-title">
            <Target size={16} />
            Tiến độ mục tiêu
          </h2>
          <div className="cfo-goals">
            {activeGoals.slice(0, 3).map((goal) => (
              <div key={goal.id} className="cfo-goal-row">
                <div className="cfo-goal-header">
                  <span className="cfo-goal-name">{goal.name}</span>
                  <span className="cfo-goal-pct">{goal.progress}%</span>
                </div>
                <div className="cfo-goal-bar-track">
                  <div className="cfo-goal-bar" style={{ width: `${goal.progress}%` }} />
                </div>
                <p className="cfo-goal-remaining">Còn {formatCurrency(goal.remaining)} để đạt đích</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rủi ro & Cơ hội — Free: 1 rủi ro · Pro: đầy đủ + cơ hội */}
      <section className="cfo-section">
        <h2 className="cfo-section-title">
          <AlertTriangle size={16} />
          Rủi ro &amp; Cơ hội
        </h2>
        <ul className="cfo-risk-list">
          {(isPro ? riskItems : riskItems.slice(0, 1)).map((r, i) => (
            <li key={`r${i}`} className="cfo-risk-item cfo-risk-warn">
              <span aria-hidden>⚠️</span>
              <p>{r}</p>
            </li>
          ))}
          {isPro && opportunityItems.map((o, i) => (
            <li key={`o${i}`} className="cfo-risk-item cfo-risk-opp">
              <span aria-hidden>💡</span>
              <p>{o}</p>
            </li>
          ))}
        </ul>
        {!isPro && (
          <ProGate feature="cfo_deep_analysis" label="Phân tích đầy đủ rủi ro & cơ hội">
            <></>
          </ProGate>
        )}
      </section>

      {/* Action Plan — Free: 2 việc · Pro: đầy đủ */}
      <section className="cfo-section cfo-action-plan">
        <h2 className="cfo-section-title">
          <Lightbulb size={16} />
          Kế hoạch tháng tới
        </h2>
        <ul className="cfo-actions">
          {(isPro ? actionPlan : actionPlan.slice(0, FREE_ACTION_COUNT)).map((action, i) => (
            <li key={i} className="cfo-action-item">
              <span className="cfo-action-num">{i + 1}</span>
              <p>{action}</p>
            </li>
          ))}
        </ul>
        {!isPro && actionPlan.length > FREE_ACTION_COUNT && (
          <ProGate feature="cfo_full_plan" label={`Mở ${actionPlan.length - FREE_ACTION_COUNT} việc còn lại trong kế hoạch`}>
            <></>
          </ProGate>
        )}
      </section>

      {/* Export (Phase 12) */}
      <section className="cfo-export" aria-label="Xuất báo cáo">
        <button type="button" className="cfo-export-btn" onClick={handleExportCsv}>
          <Download size={16} />
          Xuất CSV / Excel
        </button>
        <button type="button" className="cfo-export-btn" onClick={handlePrint}>
          <Printer size={16} />
          In / Lưu PDF
        </button>
      </section>

      <p className="cfo-footnote">
        Báo cáo được tính từ dữ liệu local. Narration AI Pro chỉ gửi số liệu đã tổng hợp,
        không gửi từng giao dịch để bảo vệ riêng tư và tiết kiệm chi phí.
      </p>
    </div>
  );
}
