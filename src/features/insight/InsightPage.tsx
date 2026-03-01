import { useState } from "react";
import { useInsightAI } from "./useInsightAI";
import PlanningTab from "./PlanningTab";
import ReportTab from "./ReportTab";

const InsightPage = ({ transactions, users }) => {
  const [activeTab, setActiveTab] = useState<"planning" | "report">("planning");

  const {
    aiPreferred,
    aiStatus,
    applyAiMeta,
  } = useInsightAI();

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex justify-between items-center">
        <h2>THU NHẬP</h2>
      </div>

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
          users={users}
          aiPreferred={aiPreferred}
          aiStatus={aiStatus}
          applyAiMeta={applyAiMeta}
        />
      )}
    </div>
  );
};

export default InsightPage;