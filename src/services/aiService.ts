import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Transaction, Goal, IncomeProject, FixedCost, FinancialReport, ProsperityPlan, Budget, Wallet } from "../types";
import { StorageService } from "./storageService";

type Brain = "gemini" | "llama";

export type AiResult<T> = {
  data: T | null;
  brainUsed: Brain | null;
  fallback: boolean;
  error?: string;
};

const SYSTEM_INSTRUCTION_BUTLER =
  "Bạn là một quản gia tài chính mỉa mai nhưng trung thành. Trả lời bằng tiếng Việt. Viết hoa chữ cái đầu câu.";

const SYSTEM_INSTRUCTION_CFO =
  "Bạn là Giám đốc Tài chính ảo. Phân tích tài chính cực kỳ thực tế, xéo xắt.";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

/* =========================
   INTERNAL HELPERS
========================= */

const callGemini = async (prompt: string, system: string) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: system,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 1024,
      },
    });

    return res.text || null;
  } catch {
    return null;
  }
};

const callLlama = async (prompt: string, system: string) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return null;

  try {
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

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
};

/* =========================
   CORE EXECUTION ENGINE
========================= */

const executeWithFallback = async <T>(
  preferred: Brain,
  geminiFn: () => Promise<T | null>,
  llamaFn: () => Promise<T | null>
): Promise<AiResult<T>> => {
  if (preferred === "gemini") {
    const gem = await geminiFn();
    if (gem) return { data: gem, brainUsed: "gemini", fallback: false };

    const llama = await llamaFn();
    if (llama) return { data: llama, brainUsed: "llama", fallback: true };

    return { data: null, brainUsed: null, fallback: true, error: "All brains failed" };
  }

  const llama = await llamaFn();
  if (llama) return { data: llama, brainUsed: "llama", fallback: false };

  const gem = await geminiFn();
  if (gem) return { data: gem, brainUsed: "gemini", fallback: true };

  return { data: null, brainUsed: null, fallback: true, error: "All brains failed" };
};

/* =========================
   PUBLIC AI SERVICE
========================= */

export const AiService = {
  /* ===== Income Plan (AI Suggestion) ===== */
  generateIncomePlan: async (idea: string): Promise<AiResult<any>> => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";

    const prompt = `Lập kế hoạch kiếm tiền cho ý tưởng: ${idea}.
Trả về JSON: { name, description, expectedIncome, milestones[] }`;

    return executeWithFallback(
      preferred,
      async () => {
        const text = await callGemini(prompt, SYSTEM_INSTRUCTION_BUTLER);
        return text ? JSON.parse(text) : null;
      },
      async () => {
        const text = await callLlama(prompt, SYSTEM_INSTRUCTION_BUTLER);
        return text ? JSON.parse(text) : null;
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
  ): Promise<AiResult<FinancialReport>> => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";

    const prompt = `
Phân tích tài chính dựa trên dữ liệu sau:
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
Trả về JSON FinancialReport.
`;

    return executeWithFallback(
      preferred,
      async () => {
        const text = await callGemini(prompt, SYSTEM_INSTRUCTION_CFO);
        return text ? JSON.parse(text) : null;
      },
      async () => {
        const text = await callLlama(prompt, SYSTEM_INSTRUCTION_CFO);
        return text ? JSON.parse(text) : null;
      }
    );
  },
};
