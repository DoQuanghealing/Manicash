import { useEffect, useState } from "react";
import { AiService } from "../../services/aiService";
import type { AiResult, Brain } from "../../services/aiService";

type Feature = "income_plan" | "cfo_report";

export const useInsightAI = () => {
  const [aiPreferred, setAiPreferred] = useState<Brain>(
    AiService.getPreferredBrain()
  );

  const [aiStatus, setAiStatus] = useState<{
    brainUsed: Brain | null;
    fallback: boolean;
    fromCache: boolean;
    error: string | null;
    retryAfterMs: number;
    lastFeature: Feature | null;
  }>({
    brainUsed: null,
    fallback: false,
    fromCache: false,
    error: null,
    retryAfterMs: 0,
    lastFeature: null,
  });

  // countdown
  useEffect(() => {
    if (aiStatus.retryAfterMs <= 0) return;

    const id = setInterval(() => {
      setAiStatus(prev => {
        if (prev.retryAfterMs <= 1000) {
          clearInterval(id);
          return { ...prev, retryAfterMs: 0 };
        }
        return { ...prev, retryAfterMs: prev.retryAfterMs - 1000 };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [aiStatus.retryAfterMs > 0]);

  const applyAiMeta = <T,>(result: AiResult<T>) => {
    setAiStatus({
      brainUsed: result.brainUsed || null,
      fallback: !!result.fallback,
      fromCache: !!result.fromCache,
      error: result.data ? null : result.error || "AI failed",
      retryAfterMs: result.retryAfterMs || 0,
      lastFeature: result.feature || null,
    });
  };

  return {
    aiPreferred,
    aiStatus,
    applyAiMeta,
    setAiPreferred,
  };
};