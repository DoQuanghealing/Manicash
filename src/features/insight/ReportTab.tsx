import { useState } from "react";
import { AiService } from "../../services/aiService";
import { AiStatusPill } from "../../components/AiStatusPill";

import type { Brain } from "../../services/aiService";
import type {
  Transaction,
  Goal,
  IncomeProject,
  FixedCost,
  Budget,
  Wallet,
  GamificationState,
  User,
  FinancialReport,
} from "../../types";

type Feature = "income_plan" | "cfo_report";

interface Props {
  transactions: Transaction[];
  goals: Goal[];
  projects: IncomeProject[];
  fixedCosts: FixedCost[];
  budgets: Budget[];
  wallets: Wallet[];
  gamification: GamificationState;
  activeUser: User;

  aiPreferred: Brain;
  aiStatus: {
    brainUsed: Brain | null;
    fallback: boolean;
    fromCache: boolean;
    error: string | null;
    retryAfterMs: number;
    lastFeature: Feature | null;
  };

  applyAiMeta: <T>(result: any) => void;
}

const ReportTab = ({
  transactions,
  goals,
  projects,
  fixedCosts,
  budgets,
  wallets,
  gamification,
  activeUser,
  aiPreferred,
  aiStatus,
  applyAiMeta,
}: Props) => {
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateReport = async () => {
    setIsLoading(true);

    try {
      const result = await AiService.generateComprehensiveReport(
        transactions,
        goals,
        projects,
        fixedCosts,
        budgets,
        wallets,
        gamification,
        activeUser?.gender || "MALE"
      );

      applyAiMeta(result);

      if (result.data) {
        setReport(result.data);
      } else {
        setReport(null);
      }
    } catch (error) {
      console.error("CFO Report error:", error);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold uppercase tracking-tight">
          Báo cáo CFO
        </h3>

        <AiStatusPill
          brainUsed={aiStatus.brainUsed}
          preferred={aiPreferred}
          fallback={aiStatus.fallback}
          fromCache={aiStatus.fromCache}
          isLoading={isLoading}
          error={aiStatus.error}
          retryAfterMs={aiStatus.retryAfterMs}
          onRetry={handleGenerateReport}
        />
      </div>

      {/* Button */}
      <button
        onClick={handleGenerateReport}
        disabled={isLoading}
        className="px-6 py-3 bg-primary text-white rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
      >
        {isLoading ? "Đang phân tích..." : "Tạo báo cáo CFO"}
      </button>

      {/* Error */}
      {aiStatus.error && !isLoading && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm font-bold text-danger uppercase tracking-widest">
            AI lỗi
          </p>
          <p className="text-sm text-foreground/70">
            {aiStatus.error}
          </p>
        </div>
      )}

      {/* Report Content */}
      {report && !isLoading && (
        <div className="space-y-6">

          {/* Health Score */}
          <div className="p-6 rounded-2xl bg-surface shadow">
            <h4 className="text-sm font-black uppercase tracking-widest mb-2">
              Sức khỏe tài chính
            </h4>
            <p className="text-3xl font-black text-primary">
              {report.healthScore}/100
            </p>
            <p className="text-sm text-foreground/60 mt-2">
              {report.healthAnalysis}
            </p>
          </div>

          {/* Income Efficiency */}
          <div className="p-6 rounded-2xl bg-surface shadow space-y-3">
            <h4 className="text-sm font-black uppercase tracking-widest">
              Hiệu suất thu nhập
            </h4>
            <p><strong>Nguồn tốt nhất:</strong> {report.incomeEfficiency.bestSource}</p>
            <p className="text-sm text-foreground/60">
              {report.incomeEfficiency.analysis}
            </p>
            <p className="text-sm text-primary">
              {report.incomeEfficiency.forecast}
            </p>
          </div>

          {/* Budget Discipline */}
          <div className="p-6 rounded-2xl bg-surface shadow space-y-3">
            <h4 className="text-sm font-black uppercase tracking-widest">
              Kỷ luật ngân sách
            </h4>
            <p className="text-sm text-foreground/60">
              {report.budgetDiscipline.varianceAnalysis}
            </p>

            {report.budgetDiscipline.trashSpending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {report.budgetDiscipline.trashSpending.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 text-xs bg-danger/10 text-danger rounded-lg border border-danger/20"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Wealth Velocity */}
          <div className="p-6 rounded-2xl bg-surface shadow space-y-3">
            <h4 className="text-sm font-black uppercase tracking-widest">
              Tốc độ đạt mục tiêu
            </h4>

            {report.wealthVelocity.goalForecasts.map((goal, idx) => (
              <div
                key={idx}
                className="flex justify-between text-sm font-medium"
              >
                <span>{goal.name}</span>
                <span className="text-primary">
                  {goal.estimatedDate}
                </span>
              </div>
            ))}

            <p className="text-sm italic text-foreground/60 mt-2">
              "{report.cfoAdvice}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportTab;