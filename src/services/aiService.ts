import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  Transaction,
  Goal,
  IncomeProject,
  FixedCost,
  FinancialReport,
  Budget,
  Wallet,
} from "../types";
import { StorageService } from "./storageService";

/* =====================================================
   TYPES
===================================================== */

export type Brain = "gemini" | "llama";

export type AiErrorCode =
  | "NO_KEY"
  | "NETWORK"
  | "QUOTA"
  | "PARSE"
  | "OFFLINE"
  | "UNKNOWN";

export type AiResult<T> = {
  data: T | null;
  brainUsed: Brain | null;
  fallback: boolean;
  error?: string;
  errorCode?: AiErrorCode;
};

/* =====================================================
   CONSTANTS
===================================================== */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

/* =====================================================
   SAFE JSON PARSER (ANTI-GEMINI MARKDOWN BUG)
===================================================== */

const safeJsonParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;

  try {
    // remove ```json ``` blocks
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) return null;

    const jsonString = cleaned.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
};

/* =====================================================
   ERROR DETECTOR
===================================================== */

const detectErrorCode = (error: any): AiErrorCode => {
  if (!navigator.onLine) return "OFFLINE";

  const msg = String(error?.message || "").toLowerCase();

  if (msg.includes("api key") || msg.includes("unauthorized")) return "NO_KEY";
  if (msg.includes("quota")) return "QUOTA";
  if (msg.includes("network")) return "NETWORK";

  return "UNKNOWN";
};

/* =====================================================
   GEMINI CALL
===================================================== */

const callGemini = async (
  prompt: string,
  system: string
): Promise<string | null> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("NO_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const res = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: prompt,
    config: {
      systemInstruction: system,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      maxOutputTokens: 1200,
    },
  });

  return res.text || null;
};

/* =====================================================
   LLAMA (GROQ)
===================================================== */

const callLlama = async (
  prompt: string,
  system: string
): Promise<string | null> => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("NO_API_KEY");

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (res.status === 429) throw new Error("QUOTA");
    throw new Error("NETWORK_ERROR");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};

/* =====================================================
   EXECUTION ENGINE WITH FALLBACK
===================================================== */

const executeWithFallback = async <T>(
  preferred: Brain,
  geminiFn: () => Promise<T | null>,
  llamaFn: () => Promise<T | null>
): Promise<AiResult<T>> => {
  if (!navigator.onLine) {
    return {
      data: null,
      brainUsed: null,
      fallback: false,
      error: "Không có kết nối mạng.",
      errorCode: "OFFLINE",
    };
  }

  try {
    if (preferred === "gemini") {
      try {
        const gem = await geminiFn();
        if (gem) return { data: gem, brainUsed: "gemini", fallback: false };
      } catch (e) {}

      try {
        const llama = await llamaFn();
        if (llama)
          return { data: llama, brainUsed: "llama", fallback: true };
      } catch (e) {}
    } else {
      try {
        const llama = await llamaFn();
        if (llama)
          return { data: llama, brainUsed: "llama", fallback: false };
      } catch (e) {}

      try {
        const gem = await geminiFn();
        if (gem)
          return { data: gem, brainUsed: "gemini", fallback: true };
      } catch (e) {}
    }

    return {
      data: null,
      brainUsed: null,
      fallback: true,
      error: "Cả hai AI đều không phản hồi.",
      errorCode: "UNKNOWN",
    };
  } catch (err: any) {
    return {
      data: null,
      brainUsed: null,
      fallback: false,
      error: err?.message || "AI Error",
      errorCode: detectErrorCode(err),
    };
  }
};

/* =====================================================
   PUBLIC AI SERVICE
===================================================== */

export const AiService = {
  /* ===== Income Plan ===== */
  generateIncomePlan: async (idea: string) => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";

    const system =
      "Bạn là cố vấn kinh doanh thực tế. Trả về JSON gồm: name, description, expectedIncome, milestones[]. Không markdown.";

    const prompt = `Lập kế hoạch kiếm tiền cho ý tưởng: ${idea}`;

    return executeWithFallback(
      preferred,
      async () => {
        const text = await callGemini(prompt, system);
        return safeJsonParse(text);
      },
      async () => {
        const text = await callLlama(prompt, system);
        return safeJsonParse(text);
      }
    );
  },

  /* ===== CFO REPORT ===== */
  generateComprehensiveReport: async (
    transactions: Transaction[],
    goals: Goal[],
    projects: IncomeProject[],
    fixedCosts: FixedCost[],
    budgets: Budget[],
    wallets: Wallet[],
    gamification: any,
    gender: "MALE" | "FEMALE"
  ) => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";

    const system =
      "Bạn là CFO thực chiến. Trả về JSON FinancialReport hợp lệ. Không markdown.";

    const prompt = `
Phân tích tài chính dựa trên dữ liệu:
${JSON.stringify({
  transactions,
  goals,
  projects,
  fixedCosts,
  budgets,
  wallets,
  gamification,
  gender,
})}
`;

    return executeWithFallback(
      preferred,
      async () => {
        const text = await callGemini(prompt, system);
        return safeJsonParse<FinancialReport>(text);
      },
      async () => {
        const text = await callLlama(prompt, system);
        return safeJsonParse<FinancialReport>(text);
      }
    );
  },
};
