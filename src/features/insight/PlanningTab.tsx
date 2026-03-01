import { useState } from "react";
import { AiService } from "../../services/aiService";
import { AiStatusPill } from "../../components/AiStatusPill";
import type { Brain } from "../../services/aiService";

type Feature = "income_plan" | "cfo_report";

interface Props {
  transactions: any[];
  users: any[];
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

const PlanningTab = ({
  aiPreferred,
  aiStatus,
  applyAiMeta,
}: Props) => {
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePlan = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);

    try {
      const result = await AiService.generateIncomePlan(aiPrompt);

      applyAiMeta(result);

      if (!result.data) return;

      // TODO: ở đây bạn gắn logic mở modal / set project giống file cũ
      console.log("AI PLAN:", result.data);

    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">AI Lập kế hoạch</h3>

        <AiStatusPill
          brainUsed={aiStatus.brainUsed}
          preferred={aiPreferred}
          fallback={aiStatus.fallback}
          fromCache={aiStatus.fromCache}
          isLoading={isGenerating}
          error={aiStatus.error}
          retryAfterMs={aiStatus.retryAfterMs}
          onRetry={handleGeneratePlan}
        />
      </div>

      <textarea
        className="w-full p-4 rounded-xl bg-foreground/5"
        placeholder="Bạn muốn kiếm tiền từ việc gì?"
        value={aiPrompt}
        onChange={(e) => setAiPrompt(e.target.value)}
      />

      <button
        onClick={handleGeneratePlan}
        disabled={isGenerating}
        className="px-6 py-3 bg-primary text-white rounded-xl"
      >
        {isGenerating ? "Đang tạo..." : "Lập kế hoạch AI"}
      </button>

      {aiStatus.error && (
        <p className="text-danger text-sm">
          Lỗi AI: {aiStatus.error}
        </p>
      )}
    </div>
  );
};

export default PlanningTab;