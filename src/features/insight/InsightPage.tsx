import { useEffect, useState } from "react";
import { StorageService } from "../../services/storageService";
import { useInsightAI } from "./useInsightAI";
import PlanningTab from "./PlanningTab";
import ReportTab from "./ReportTab";

import type {
  Transaction,
  User,
  Goal,
  IncomeProject,
  FixedCost,
  Budget,
  Wallet,
  GamificationState,
} from "../../types";

interface Props {
  transactions: Transaction[];
  users: User[];
}

const InsightPage = ({ transactions, users }: Props) => {
  const [activeTab, setActiveTab] = useState<"planning" | "report">("planning");

  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<IncomeProject[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [gamification, setGamification] =
    useState<GamificationState>(StorageService.getGamificationState());

  const activeUser = users[0]; // bạn có thể custom nếu multi-user

  const { aiPreferred, aiStatus, applyAiMeta } = useInsightAI();

  useEffect(() => {
    setGoals(StorageService.getGoals());
    setProjects(StorageService.getIncomeProjects());
    setFixedCosts(StorageService.getFixedCosts());
    setBudgets(StorageService.getBudgets());
    setWallets(StorageService.getWallets());
  }, []);

  return (
    <div className="p-6 space-y-6">

      {/* TAB SWITCH */}
      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab("planning")}
          className={`px-6 py-3 rounded-xl ${
            activeTab === "planning"
              ? "bg-primary text-white"
              : "bg-foreground/5"
          }`}
        >
          Lập kế hoạch
        </button>

        <button
          onClick={() => setActiveTab("report")}
          className={`px-6 py-3 rounded-xl ${
            activeTab === "report"
              ? "bg-primary text-white"
              : "bg-foreground/5"
          }`}
        >
          Báo cáo CFO
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === "planning" ? (
        <PlanningTab
          transactions={transactions}
          users={users}
          aiPreferred={aiPreferred}
          aiStatus={aiStatus}
          applyAiMeta={applyAiMeta}
        />
      ) : (
        <ReportTab
          transactions={transactions}
          goals={goals}
          projects={projects}
          fixedCosts={fixedCosts}
          budgets={budgets}
          wallets={wallets}
          gamification={gamification}
          activeUser={activeUser}
          aiPreferred={aiPreferred}
          aiStatus={aiStatus}
          applyAiMeta={applyAiMeta}
        />
      )}
    </div>
  );
};

export default InsightPage;
