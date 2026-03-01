// src/services/aiService.ts
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import {
  Transaction,
  Goal,
  IncomeProject,
  FixedCost,
  FinancialReport,
  ProsperityPlan,
  Budget,
  Wallet,
} from "../types";
import { StorageService } from "./storageService";

/**
 * ===========================================
 *  PRODUCTION-GRADE DUAL-BRAIN AI SERVICE
 *  - Primary brain: user setting (gemini/llama)
 *  - Auto fallback: other brain if fails
 *  - Timeout + soft retries
 *  - Safe JSON parsing with cleanup
 *  - Never throw to break UI (returns fallback)
 * ===========================================
 */

/** ===== System instructions ===== */
const SYSTEM_INSTRUCTION_BUTLER =
  "Bạn là một quản gia tài chính mỉa mai nhưng trung thành. Trả lời bằng tiếng Việt. Quan trọng: Luôn viết hoa chữ cái đầu tiên của câu, còn lại viết thường hoàn toàn. Câu thoại ngắn dưới 20 từ.";

const SYSTEM_INSTRUCTION_REFLECTION =
  "Bạn là một quản gia tài chính xéo xắt và mỉa mai. Khi thấy chủ nhân tiêu tiền, hãy đưa ra một lời nhận xét cay nghiệt để họ phải suy nghĩ lại về thói quen chi tiêu của mình. Trả lời bằng tiếng Việt, ngắn gọn, súc tích.";

const SYSTEM_INSTRUCTION_CFO = `Bạn là Giám đốc Tài chính (CFO) ảo của Manicash, tên là Lord Diamond. Nhiệm vụ của bạn là phân tích dữ liệu để tạo báo cáo "LỘ TRÌNH THỊNH VƯỢNG".
Xưng hô: "Quản gia Lord Diamond" gọi người dùng là "Cậu chủ" hoặc "Cô chủ". 

QUY TẮC TRÌNH BÀY:
- Văn phong: Mỉa mai, xéo xắt, hài hước nhưng cực kỳ thực tế về tiền bạc.
- Cấu trúc "Nhiệm vụ": Các chiến lược phải được trình bày dưới dạng nhiệm vụ cụ thể (Nhiệm vụ 1, Nhiệm vụ 2...).
- Các đoạn văn diễn giải: Viết chữ thường hoàn toàn, chỉ viết hoa chữ cái đầu tiên của mỗi câu.
- Nhãn quan trọng: Các từ như 'DỰ BÁO', 'CẢNH BÁO', 'BÁO ĐỘNG', 'NHIỆM VỤ' phải viết IN HOA toàn bộ.

CÁCH ĐÁNH GIÁ:
1. Chỉ số Hiệu suất Thu nhập: So sánh tiến độ dự án (milestones) với thực tế tiền vào.
2. Chỉ số Kỷ luật Chi tiêu: Phân tích độ lệch giữa Budget và Spending. Phát hiện "chi tiêu rác".
3. Đo lường Sức mạnh Tích lũy: Tính tỷ lệ dòng tiền vào Goals và Quỹ dự phòng.`;

/** ===== Runtime config (scale-friendly) ===== */
type Brain = "gemini" | "llama";

const CONFIG = {
  // Gemini
  GEMINI_MODEL_TEXT: (import.meta.env.VITE_GEMINI_MODEL_TEXT as string) || "gemini-3-flash-preview",
  GEMINI_MODEL_JSON: (import.meta.env.VITE_GEMINI_MODEL_JSON as string) || "gemini-3-flash-preview",

  // Groq (OpenAI-compatible)
  GROQ_ENDPOINT:
    (import.meta.env.VITE_GROQ_ENDPOINT as string) ||
    "https://api.groq.com/openai/v1/chat/completions",
  GROQ_MODEL_FAST:
    (import.meta.env.VITE_GROQ_MODEL_FAST as string) || "llama-3.1-8b-instant",
  GROQ_MODEL_PRO:
    (import.meta.env.VITE_GROQ_MODEL_PRO as string) || "llama-3.3-70b-versatile",

  // Networking
  TIMEOUT_MS: Number(import.meta.env.VITE_AI_TIMEOUT_MS || 12000),
  RETRY_COUNT: Number(import.meta.env.VITE_AI_RETRY_COUNT || 1), // soft retry once
  RETRY_BACKOFF_MS: Number(import.meta.env.VITE_AI_RETRY_BACKOFF_MS || 600),

  // Token limits
  MAX_TOKENS_TEXT: Number(import.meta.env.VITE_AI_MAX_TOKENS_TEXT || 120),
  MAX_TOKENS_JSON: Number(import.meta.env.VITE_AI_MAX_TOKENS_JSON || 1200),

  // Temperature
  TEMPERATURE_TEXT: Number(import.meta.env.VITE_AI_TEMP_TEXT || 0.8),
  TEMPERATURE_JSON: Number(import.meta.env.VITE_AI_TEMP_JSON || 0.7),

  // Data size control (scale)
  TX_SLICE_PROSPERITY: Number(import.meta.env.VITE_AI_TX_SLICE_PROSPERITY || 30),
  TX_SLICE_REPORT: Number(import.meta.env.VITE_AI_TX_SLICE_REPORT || 50),
};

/** ===== Utilities ===== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  let timer: any;
  const timeout = new Promise<T>((_, rej) => {
    timer = setTimeout(() => rej(new Error(label)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

function cleanJsonResponse(text: string) {
  return (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
}

function safeJsonParse<T>(text: string): T | null {
  try {
    const cleaned = cleanJsonResponse(text);
    if (!cleaned) return null;
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function normalizeErr(err: any) {
  const msg = String(err?.message || err || "");
  const status = (err && typeof err === "object" && "status" in err) ? (err as any).status : undefined;
  return { msg, status };
}

function isRetryableError(err: any) {
  const { msg, status } = normalizeErr(err);
  if (status === 408 || status === 429) return true;
  if (status && status >= 500) return true;
  // network-ish
  const m = msg.toLowerCase();
  if (m.includes("timeout")) return true;
  if (m.includes("network")) return true;
  if (m.includes("failed to fetch")) return true;
  if (m.includes("quota")) return true;
  if (m.includes("rate")) return true;
  return false;
}

function pickOrder(preferred: Brain): Brain[] {
  return preferred === "gemini" ? ["gemini", "llama"] : ["llama", "gemini"];
}

function hasGeminiKey() {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
}
function hasGroqKey() {
  return !!import.meta.env.VITE_GROQ_API_KEY;
}

function canUseBrain(brain: Brain) {
  if (brain === "gemini") return hasGeminiKey();
  return hasGroqKey();
}

/**
 * Optional: sanitize prompt size to avoid bloat when scaling users.
 * Keep it simple: limit length in chars.
 */
function clampPrompt(prompt: string, maxChars = 14000) {
  if (!prompt) return "";
  return prompt.length > maxChars ? prompt.slice(0, maxChars) : prompt;
}

/** ===== Low-level callers ===== */

async function callGroqRaw(args: {
  prompt: string;
  system: string;
  isPro?: boolean;
  jsonMode?: boolean;
}): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) return null;

  const body: any = {
    model: args.isPro ? CONFIG.GROQ_MODEL_PRO : CONFIG.GROQ_MODEL_FAST,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: clampPrompt(args.prompt) },
    ],
    temperature: args.jsonMode ? CONFIG.TEMPERATURE_JSON : CONFIG.TEMPERATURE_TEXT,
    max_tokens: args.jsonMode ? CONFIG.MAX_TOKENS_JSON : CONFIG.MAX_TOKENS_TEXT,
  };

  // Enforce JSON for Groq/OpenAI-compatible models (best-effort)
  if (args.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(CONFIG.GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    const err: any = new Error(`GROQ_HTTP_${res.status}: ${t || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? null;
}

async function callGroqWithRetry(args: {
  prompt: string;
  system: string;
  isPro?: boolean;
  jsonMode?: boolean;
}): Promise<string | null> {
  let lastErr: any = null;
  for (let attempt = 0; attempt <= CONFIG.RETRY_COUNT; attempt++) {
    try {
      const p = callGroqRaw(args);
      return await withTimeout(p, CONFIG.TIMEOUT_MS, "groq_timeout");
    } catch (e: any) {
      lastErr = e;
      if (attempt < CONFIG.RETRY_COUNT && isRetryableError(e)) {
        await sleep(CONFIG.RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      break;
    }
  }
  // swallow at this layer; higher layer handles fallback
  console.warn("[AiService][Groq] failed:", normalizeErr(lastErr));
  return null;
}

async function callGeminiText(args: {
  prompt: string;
  system: string;
  maxTokens?: number;
  thinking?: ThinkingLevel;
}): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: CONFIG.GEMINI_MODEL_TEXT,
    contents: clampPrompt(args.prompt),
    config: {
      systemInstruction: args.system,
      thinkingConfig: { thinkingLevel: args.thinking ?? ThinkingLevel.LOW },
      maxOutputTokens: args.maxTokens ?? CONFIG.MAX_TOKENS_TEXT,
    },
  });
  return res?.text ?? null;
}

async function callGeminiJson<T>(args: {
  prompt: string;
  system: string;
  schema: any;
  maxTokens?: number;
}): Promise<T | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: CONFIG.GEMINI_MODEL_JSON,
    contents: clampPrompt(args.prompt),
    config: {
      systemInstruction: args.system,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      maxOutputTokens: args.maxTokens ?? CONFIG.MAX_TOKENS_JSON,
      responseMimeType: "application/json",
      responseSchema: args.schema,
    },
  });

  const text = res?.text || "";
  // Gemini returns JSON string if schema is satisfied
  return safeJsonParse<T>(text);
}

async function callGeminiWithRetryText(args: {
  prompt: string;
  system: string;
  maxTokens?: number;
  thinking?: ThinkingLevel;
}): Promise<string | null> {
  let lastErr: any = null;
  for (let attempt = 0; attempt <= CONFIG.RETRY_COUNT; attempt++) {
    try {
      const p = callGeminiText(args);
      return await withTimeout(p, CONFIG.TIMEOUT_MS, "gemini_timeout");
    } catch (e: any) {
      lastErr = e;
      if (attempt < CONFIG.RETRY_COUNT && isRetryableError(e)) {
        await sleep(CONFIG.RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      break;
    }
  }
  console.warn("[AiService][GeminiText] failed:", normalizeErr(lastErr));
  return null;
}

async function callGeminiWithRetryJson<T>(args: {
  prompt: string;
  system: string;
  schema: any;
  maxTokens?: number;
}): Promise<T | null> {
  let lastErr: any = null;
  for (let attempt = 0; attempt <= CONFIG.RETRY_COUNT; attempt++) {
    try {
      const p = callGeminiJson<T>(args);
      return await withTimeout(p, CONFIG.TIMEOUT_MS, "gemini_timeout");
    } catch (e: any) {
      lastErr = e;
      if (attempt < CONFIG.RETRY_COUNT && isRetryableError(e)) {
        await sleep(CONFIG.RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      break;
    }
  }
  console.warn("[AiService][GeminiJson] failed:", normalizeErr(lastErr));
  return null;
}

/** ===== High-level dual-brain execution wrappers ===== */

async function runTextDualBrain(args: {
  preferred: Brain;
  prompt: string;
  system: string;
  fallbackText: string;
}): Promise<string> {
  const order = pickOrder(args.preferred);

  for (const brain of order) {
    if (!canUseBrain(brain)) continue;

    if (brain === "gemini") {
      const out = await callGeminiWithRetryText({
        prompt: args.prompt,
        system: args.system,
        maxTokens: CONFIG.MAX_TOKENS_TEXT,
        thinking: ThinkingLevel.LOW,
      });
      if (out && out.trim()) return out.trim();
    } else {
      const out = await callGroqWithRetry({
        prompt: args.prompt,
        system: args.system,
        isPro: false,
        jsonMode: false,
      });
      if (out && out.trim()) return out.trim();
    }
  }

  return args.fallbackText;
}

async function runJsonDualBrain<T>(args: {
  preferred: Brain;
  prompt: string;
  system: string;
  geminiSchema: any;
  groqIsPro?: boolean; // big model for json tasks
}): Promise<T | null> {
  const order = pickOrder(args.preferred);

  for (const brain of order) {
    if (!canUseBrain(brain)) continue;

    if (brain === "gemini") {
      const out = await callGeminiWithRetryJson<T>({
        prompt: args.prompt,
        system: args.system,
        schema: args.geminiSchema,
        maxTokens: CONFIG.MAX_TOKENS_JSON,
      });
      if (out) return out;
    } else {
      const raw = await callGroqWithRetry({
        prompt: args.prompt,
        system: args.system,
        isPro: !!args.groqIsPro,
        jsonMode: true,
      });
      const parsed = raw ? safeJsonParse<T>(raw) : null;
      if (parsed) return parsed;
    }
  }

  return null;
}

/** ===== JSON Schemas (Gemini) ===== */

const ProsperityPlanSchema = {
  type: Type.OBJECT,
  properties: {
    statusTitle: { type: Type.STRING },
    statusEmoji: { type: Type.STRING },
    healthScore: { type: Type.NUMBER },
    summary: { type: Type.STRING },
    savingsStrategies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          desc: { type: Type.STRING },
        },
        required: ["title", "desc"],
      },
    },
    incomeStrategies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          desc: { type: Type.STRING },
        },
        required: ["title", "desc"],
      },
    },
    badHabitToQuit: {
      type: Type.OBJECT,
      properties: {
        habit: { type: Type.STRING },
        why: { type: Type.STRING },
      },
      required: ["habit", "why"],
    },
  },
  required: [
    "statusTitle",
    "statusEmoji",
    "healthScore",
    "summary",
    "savingsStrategies",
    "incomeStrategies",
    "badHabitToQuit",
  ],
};

const FinancialReportSchema = {
  type: Type.OBJECT,
  properties: {
    healthScore: { type: Type.NUMBER },
    healthAnalysis: { type: Type.STRING },
    incomeEfficiency: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER },
        bestSource: { type: Type.STRING },
        forecast: { type: Type.STRING },
        analysis: { type: Type.STRING },
      },
      required: ["score", "bestSource", "forecast", "analysis"],
    },
    budgetDiscipline: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING },
        trashSpending: { type: Type.ARRAY, items: { type: Type.STRING } },
        varianceAnalysis: { type: Type.STRING },
        warningMessage: { type: Type.STRING },
      },
      required: ["status", "trashSpending", "varianceAnalysis"],
    },
    wealthVelocity: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING },
        goalForecasts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              estimatedDate: { type: Type.STRING },
            },
            required: ["name", "estimatedDate"],
          },
        },
        cutSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["status", "goalForecasts", "cutSuggestions"],
    },
    gamificationInsights: {
      type: Type.OBJECT,
      properties: {
        rankVelocity: { type: Type.STRING },
        incomeVsGoals: { type: Type.STRING },
        domainExpertise: { type: Type.STRING },
      },
      required: ["rankVelocity", "incomeVsGoals", "domainExpertise"],
    },
    cfoAdvice: { type: Type.STRING },
  },
  required: [
    "healthScore",
    "healthAnalysis",
    "incomeEfficiency",
    "budgetDiscipline",
    "wealthVelocity",
    "gamificationInsights",
    "cfoAdvice",
  ],
};

const IncomePlanSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    expectedIncome: { type: Type.NUMBER },
    milestones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          daysFromNow: { type: Type.NUMBER },
        },
        required: ["title", "daysFromNow"],
      },
    },
  },
  required: ["name", "description", "expectedIncome", "milestones"],
};

/** ===== Public API ===== */
export const AiService = {
  /**
   * Production: availability depends on selected brain.
   * Still return true if either exists, but expose a stricter check too.
   */
  isAvailable: () => {
    const brain = StorageService.getAiBrain() as Brain;
    if (brain === "llama") return hasGroqKey() || hasGeminiKey(); // llama preferred but can fallback gemini
    return hasGeminiKey() || hasGroqKey(); // gemini preferred but can fallback llama
  },

  /**
   * Optional strict check: only "preferred brain" available?
   */
  isPreferredBrainAvailable: () => {
    const brain = StorageService.getAiBrain() as Brain;
    return canUseBrain(brain);
  },

  generateTransactionComment: async (transaction: any): Promise<string> => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";
    const prompt = `Người dùng vừa chi ${transaction?.amount} cho ${transaction?.category}. Hãy đưa ra một lời mỉa mai ngắn gọn.`;

    return runTextDualBrain({
      preferred,
      prompt,
      system: SYSTEM_INSTRUCTION_BUTLER,
      fallbackText: "Lại tiêu tiền nữa rồi ạ?",
    });
  },

  generateReflectionPrompt: async (category: string, amount: number): Promise<string> => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";
    const prompt = `Chi ${amount} VND cho mục ${category}. Mỉa mai tôi đi.`;

    return runTextDualBrain({
      preferred,
      prompt,
      system: SYSTEM_INSTRUCTION_REFLECTION,
      fallbackText: "Tiêu tiền thế này thì bao giờ mới giàu được ạ?",
    });
  },

  generateProsperityPlan: async (
    transactions: Transaction[],
    fixedCosts: FixedCost[],
    projects: IncomeProject[],
    goals: Goal[]
  ): Promise<ProsperityPlan | null> => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";

    // scale-safe: only last N transactions, keep fields minimal
    const summary = {
      transactions: (transactions || [])
        .slice(-CONFIG.TX_SLICE_PROSPERITY)
        .map((t) => ({ cat: t.category, val: t.amount, desc: t.description })),
      fixedCosts: (fixedCosts || []).map((c) => ({ title: c.title, val: c.amount })),
      projects: (projects || []).map((p) => ({
        name: p.name,
        expectedIncome: (p as any).expectedIncome,
        milestones: (p as any).milestones?.length ?? 0,
      })),
      goals: (goals || []).map((g) => ({ name: g.name, target: g.targetAmount, current: g.currentAmount })),
    };

    const prompt = `Dựa trên dữ liệu tài chính của chủ nhân: ${JSON.stringify(summary)}.
Hãy đóng vai Quản gia Lord Diamond mỉa mai xéo xắt nhưng cực kỳ giỏi phân tích dòng tiền để đưa ra "LỘ TRÌNH THỊNH VƯỢNG".
Bạn PHẢI trả về JSON theo cấu trúc sau:
{
  "statusTitle": "ĐẠI PHÚ HÀO TIỀM NĂNG",
  "statusEmoji": string,
  "healthScore": number,
  "summary": "Lời nhận xét tổng thể về dòng tiền của Cậu chủ/Cô chủ (xéo xắt nhưng thực tế).",
  "savingsStrategies": [
    { "title": "NHIỆM VỤ 1: [Tên nhiệm vụ cắt giảm]", "desc": "[Mô tả cụ thể hành động cần làm ngay hôm nay]" },
    { "title": "NHIỆM VỤ 2: [Tên nhiệm vụ tối ưu]", "desc": "[Mô tả cụ thể hành động cần làm]" }
  ],
  "incomeStrategies": [
    { "title": "GỢI Ý 1: [Tên gợi ý dấn thân tăng thu]", "desc": "[Mô tả hành động cụ thể]" },
    { "title": "GỢI Ý 2: [Tên gợi ý kinh doanh]", "desc": "[Mô tả hành động cụ thể]" }
  ],
  "badHabitToQuit": { "habit": string, "why": string }
}`;

    return runJsonDualBrain<ProsperityPlan>({
      preferred,
      prompt,
      system: SYSTEM_INSTRUCTION_CFO,
      geminiSchema: ProsperityPlanSchema,
      groqIsPro: true, // JSON plan => dùng model pro cho ổn định
    });
  },

  generateComprehensiveReport: async (
    transactions: Transaction[],
    goals: Goal[],
    projects: IncomeProject[],
    fixedCosts: FixedCost[],
    budgets: Budget[],
    wallets: Wallet[],
    gamification: any,
    gender: "MALE" | "FEMALE" = "MALE"
  ): Promise<FinancialReport | null> => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";

    const today = new Date();
    // scale-safe context: minimal fields + slices
    const dataContext = {
      today: today.toISOString(),
      dayOfMonth: today.getDate(),
      gamification: { rank: gamification?.rank, points: gamification?.points },
      wallets: (wallets || []).map((w) => ({ name: w.name, bal: w.balance })),
      transactions: (transactions || [])
        .slice(-CONFIG.TX_SLICE_REPORT)
        .map((t) => ({ type: t.type, cat: t.category, amt: t.amount, desc: t.description })),
      budgets: (budgets || []).map((b) => ({ cat: b.category, lim: b.limit, spent: (b as any).spent })),
      goals: (goals || []).map((g) => ({
        name: g.name,
        tar: g.targetAmount,
        cur: g.currentAmount,
        dl: (g as any).deadline,
      })),
      projects: (projects || []).map((p: any) => ({
        name: p.name,
        inc: p.expectedIncome,
        miles: p.milestones?.length ?? 0,
        done: (p.milestones || []).filter((m: any) => m.isCompleted).length,
      })),
      fixedCosts: (fixedCosts || []).map((c) => ({ title: c.title, amt: c.amount })),
    };

    const prompt = `Phân tích dữ liệu tài chính của ${gender === "FEMALE" ? "Cô chủ" : "Cậu chủ"} và tạo báo cáo CFO dưới dạng JSON.
Đặc biệt chú ý đến phần "gamificationInsights":
- rankVelocity: Tốc độ thăng hạng dựa trên số điểm và các dự án đã hoàn thành.
- incomeVsGoals: So sánh số tiền kiếm được từ các dự án với các mục tiêu lớn đang theo đuổi.
- domainExpertise: Ghi nhận khả năng hoàn thành nhiệm vụ (milestones) để đánh giá sự chuyên nghiệp/kỷ luật.

Dữ liệu: ${JSON.stringify(dataContext)}`;

    return runJsonDualBrain<FinancialReport>({
      preferred,
      prompt,
      system: SYSTEM_INSTRUCTION_CFO,
      geminiSchema: FinancialReportSchema,
      groqIsPro: true,
    });
  },

  generateIncomePlan: async (idea: string): Promise<any> => {
    const preferred = (StorageService.getAiBrain() as Brain) || "gemini";

    const prompt = `Lập kế hoạch thực thi cho ý tưởng kiếm tiền: "${idea}".
Trả về JSON: { "name": string, "description": string, "expectedIncome": number, "milestones": [{ "title": string, "daysFromNow": number }] }`;

    return runJsonDualBrain<any>({
      preferred,
      prompt,
      system: SYSTEM_INSTRUCTION_BUTLER,
      geminiSchema: IncomePlanSchema,
      groqIsPro: true,
    });
  },
};
