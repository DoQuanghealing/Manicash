import React from "react";
import { Brain, RefreshCw, ShieldAlert, Database, Zap } from "lucide-react";
import type { Brain as BrainType } from "../services/aiService";

type Props = {
  brainUsed?: BrainType | null;
  preferred?: BrainType;
  fallback?: boolean;
  fromCache?: boolean;
  isLoading?: boolean;
  error?: string | null;
  retryAfterMs?: number;
  onRetry?: () => void;
  compact?: boolean;
};

export const AiStatusPill: React.FC<Props> = ({
  brainUsed,
  preferred,
  fallback,
  fromCache,
  isLoading,
  error,
  retryAfterMs,
  onRetry,
  compact,
}) => {
  const used = brainUsed || preferred || null;

  const brainLabel =
    used === "gemini" ? "GEMINI" : used === "llama" ? "LLAMA" : "AI";

  const brainClass =
    used === "gemini"
      ? "bg-primary/10 border-primary/30 text-primary"
      : used === "llama"
      ? "bg-secondary/10 border-secondary/30 text-secondary"
      : "bg-foreground/5 border-foreground/10 text-foreground/40";

  const hint = [
    fromCache ? "CACHE" : null,
    fallback ? "FALLBACK" : null,
    isLoading ? "RUNNING" : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const canRetry = !!onRetry && !isLoading && (!retryAfterMs || retryAfterMs <= 0);

  const retryText =
    retryAfterMs && retryAfterMs > 0 ? `CHỜ ${Math.ceil(retryAfterMs / 1000)}S` : "THỬ LẠI";

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "justify-between"}`}>
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-lg backdrop-blur-xl ${brainClass}`}
      >
        {used ? <Brain size={14} /> : <Zap size={14} />}
        <span className="text-[9px] font-black uppercase tracking-[0.25em]">
          {brainLabel}
        </span>

        {fromCache && <Database size={14} className="opacity-70" />}
        {fallback && <ShieldAlert size={14} className="opacity-70" />}
      </div>

      {!compact && (
        <div className="flex items-center gap-2">
          {hint && (
            <span className="text-[8px] font-black text-foreground/25 uppercase tracking-[0.2em]">
              {hint}
            </span>
          )}

          {error && (
            <span className="text-[8px] font-black text-danger uppercase tracking-[0.2em]">
              FAIL
            </span>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              disabled={!canRetry}
              className={`px-3 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center gap-2
                ${
                  canRetry
                    ? "bg-foreground text-background border-white/10"
                    : "bg-foreground/10 text-foreground/30 border-foreground/10 cursor-not-allowed"
                }`}
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              {retryText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
