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
  | "RATE_LIMIT"
  | "UNKNOWN";

export type AiFeature =
  | "income_plan"
  | "cfo_report";

export type AiResult<T> = {
  data: T | null;
  brainUsed: Brain | null;
  fallback: boolean;

  // Part 4 meta
  feature: AiFeature;
  fromCache?: boolean;
  retryAfterMs?: number;

  error?: string;
  errorCode?: AiErrorCode;
};

/* =====================================================
   CONFIG
===================================================== */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

// Cache TTL: 5 phút
const CACHE_TTL_MS = 5 * 60 * 1000;

// Global cooldown chống double click
const GLOBAL_COOLDOWN_MS = 2500;

// Rate limit theo feature: 10 req / 60s
const FEATURE_WINDOW_MS = 60 * 1000;
const FEATURE_MAX_REQ = 10;

// LocalStorage key usage
const AI_USAGE_KEY = "manicash_ai_usage_v1";
const AI_RATE_KEY = "manicash_ai_rate_v1";

/* =====================================================
   SMALL UTILITIES
===================================================== */

const nowMs = () => Date.now();

const djb2Hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
};

const safeJsonParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    const jsonString = cleaned.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
};

const detectErrorCode = (error: any): AiErrorCode => {
  if (!navigator.onLine) return "OFFLINE";
  const msg = String(error?.message || "").toLowerCase();

  if (msg.includes("no_api_key") || msg.includes("no api key") || msg.includes("api key") || msg.includes("unauthorized")) return "NO_KEY";
  if (msg.includes("quota") || msg.includes("429")) return "QUOTA";
  if (msg.includes("network") || msg.includes("failed to fetch")) return "NETWORK";
  if (msg.includes("rate_limit")) return "RATE_LIMIT";

  return "UNKNOWN";
};

/* =====================================================
   CACHE ENGINE (IN-MEMORY)
===================================================== */

type CacheEntry = {
  ts: number;
  value: any;
};

const cache = new Map<string, CacheEntry>();

const getCache = <T>(key: string): T | null => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (nowMs() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
};

const setCache = (key: string, value: any) => {
  cache.set(key, { ts: nowMs(), value });
};

/* =====================================================
   USAGE TRACKING (LOCALSTORAGE)
===================================================== */

type UsageState = {
  totalRequests: number;
  totalSuccess: number;
  totalFail: number;
  lastBrain?: Brain;
  lastAt?: string;
  charsIn: number;
  charsOut: number;
  byFeature: Record<string, { req: number; ok: number; fail: number }>;
};

const loadUsage = (): UsageState => {
  try {
    const raw = localStorage.getItem(AI_USAGE_KEY);
    if (!raw) {
      return {
        totalRequests: 0,
        totalSuccess: 0,
        totalFail: 0,
        charsIn: 0,
        charsOut: 0,
        byFeature: {},
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      totalRequests: 0,
      totalSuccess: 0,
      totalFail: 0,
      charsIn: 0,
      charsOut: 0,
      byFeature: {},
    };
  }
};

const saveUsage = (u: UsageState) => {
  try {
    localStorage.setItem(AI_USAGE_KEY, JSON.stringify(u));
  } catch {
    // ignore
  }
};

const trackUsageStart = (feature: AiFeature, prompt: string) => {
  const u = loadUsage();
  u.totalRequests += 1;
  u.charsIn += prompt.length;
  u.lastAt = new Date().toISOString();
  u.byFeature[feature] = u.byFeature[feature] || { req: 0, ok: 0, fail: 0 };
  u.byFeature[feature].req += 1;
  saveUsage(u);
};

const trackUsageEnd = (feature: AiFeature, ok: boolean, brain: Brain | null, outText?: string) => {
  const u = loadUsage();
  if (ok) u.totalSuccess += 1;
  else u.totalFail += 1;

  if (brain) u.lastBrain = brain;
  if (outText) u.charsOut += outText.length;

  u.byFeature[feature] = u.byFeature[feature] || { req: 0, ok: 0, fail: 0 };
  if (ok) u.byFeature[feature].ok += 1;
  else u.byFeature[feature].fail += 1;

  u.lastAt = new Date().toISOString();
  saveUsage(u);
};

/* =====================================================
   RATE LIMIT ENGINE (LOCALSTORAGE + MEMORY)
===================================================== */

// Global last request timestamp (memory)
let lastGlobalCallAt = 0;

// Feature window timestamps persisted
type RateState = Record<string, number[]>;

const loadRate = (): RateState => {
  try {
    const raw = localStorage.getItem(AI_RATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const saveRate = (r: RateState) => {
  try {
    localStorage.setItem(AI_RATE_KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
};

const checkRateLimit = (feature: AiFeature): { ok: boolean; retryAfterMs?: number } => {
  const t = nowMs();

  // Global cooldown
  const since = t - lastGlobalCallAt;
  if (since < GLOBAL_COOLDOWN_MS) {
    return { ok: false, retryAfterMs: GLOBAL_COOLDOWN_MS - since };
  }

  // Feature window
  const rs = loadRate();
  const arr = (rs[feature] || []).filter(ts => t - ts <= FEATURE_WINDOW_MS);
  if (arr.length >= FEATURE_MAX_REQ) {
    const oldest = arr[0];
    const retry = FEATURE_WINDOW_MS - (t - oldest);
    rs[feature] = arr;
    saveRate(rs);
    return { ok: false, retryAfterMs: retry };
  }

  // Passed -> commit
  arr.push(t);
  rs[feature] = arr;
  saveRate(rs);

  lastGlobalCallAt = t;
  return { ok: true };
};

/* =====================================================
   GEMINI CALL
===================================================== */

const callGemini = async (prompt: string, system: string): Promise<string | null> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("NO_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const res = await ai.models.generateContent({
    // bạn muốn 3.0 flash preview thì đổi đúng tên model ở đây:
    // model: "gemini-3-flash-preview",
    model: "gemini-1.5-flash",
    contents: prompt,
    config: {
      systemInstruction: system,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      maxOutputTokens: 1400,
    },
  });

  return res.text || null;
};

/* =====================================================
   LLAMA (GROQ)
===================================================== */

const callLlama = async (prompt: string, system: string): Promise<string | null> => {
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
   EXECUTION ENGINE WITH CACHE + RATE LIMIT + FALLBACK
===================================================== */

const executeWithFallback = async <T>(args: {
  feature: AiFeature;
  preferred: Brain;
  cacheKey: string;

  gemini: () => Promise<{ parsed: T | null; raw: string | null }>;
  llama: () => Promise<{ parsed: T | null; raw: string | null }>;
}): Promise<AiResult<T>> => {
  const { feature, preferred, cacheKey, gemini, llama } = args;

  // Offline guard
  if (!navigator.onLine) {
    return {
      data: null,
      brainUsed: null,
      fallback: false,
      feature,
      error: "Bạn đang offline.",
      errorCode: "OFFLINE",
    };
  }

  // Cache check
  const cached = getCache<AiResult<T>>(cacheKey);
  if (cached?.data) {
    return { ...cached, feature, fromCache: true };
  }

  // Rate limit
  const rate = checkRateLimit(feature);
  if (!rate.ok) {
    return {
      data: null,
      brainUsed: null,
      fallback: false,
      feature,
      error: "rate_limit",
      errorCode: "RATE_LIMIT",
      retryAfterMs: rate.retryAfterMs,
    };
  }

  try {
    // track start (prompt length tracked by caller usually) -> we'll track minimal here
    // (caller already has prompt string; for safety we track a stub)
    trackUsageStart(feature, cacheKey);

    const tryGemini = async () => {
      const r = await gemini();
      if (r.parsed) return { brain: "gemini" as const, ...r };
      return null;
    };

    const tryLlama = async () => {
      const r = await llama();
      if (r.parsed) return { brain: "llama" as const, ...r };
      return null;
    };

    if (preferred === "gemini") {
      try {
        const g = await tryGemini();
        if (g) {
          const result: AiResult<T> = { data: g.parsed, brainUsed: "gemini", fallback: false, feature };
          setCache(cacheKey, result);
          trackUsageEnd(feature, true, "gemini", g.raw || "");
          return result;
        }
      } catch (e) {
        // ignore -> fallback
      }

      try {
        const l = await tryLlama();
        if (l) {
          const result: AiResult<T> = { data: l.parsed, brainUsed: "llama", fallback: true, feature };
          setCache(cacheKey, result);
          trackUsageEnd(feature, true, "llama", l.raw || "");
          return result;
        }
      } catch (e) {
        const code = detectErrorCode(e);
        trackUsageEnd(feature, false, null);
        return {
          data: null,
          brainUsed: null,
          fallback: true,
          feature,
          error: String(e?.message || "AI_ERROR"),
          errorCode: code,
        };
      }
    } else {
      try {
        const l = await tryLlama();
        if (l) {
          const result: AiResult<T> = { data: l.parsed, brainUsed: "llama", fallback: false, feature };
          setCache(cacheKey, result);
          trackUsageEnd(feature, true, "llama", l.raw || "");
          return result;
        }
      } catch (e) {
        // ignore -> fallback
      }

      try {
        const g = await tryGemini();
        if (g) {
          const result: AiResult<T> = { data: g.parsed, brainUsed: "gemini", fallback: true, feature };
          setCache(cacheKey, result);
          trackUsageEnd(feature, true, "gemini", g.raw || "");
          return result;
        }
      } catch (e) {
        const code = detectErrorCode(e);
        trackUsageEnd(feature, false, null);
        return {
          data: null,
          brainUsed: null,
          fallback: true,
          feature,
          error: String(e?.message || "AI_ERROR"),
          errorCode: code,
        };
      }
    }

    trackUsageEnd(feature, false, null);
    return {
      data: null,
      brainUsed: null,
      fallback: true,
      feature,
      error: "Cả hai AI đều không trả dữ liệu hợp lệ.",
      errorCode: "PARSE",
    };
  } catch (err: any) {
    const code = detectErrorCode(err);
    trackUsageEnd(feature, false, null);
    return {
      data: null,
      brainUsed: null,
      fallback: false,
      feature,
      error: err?.message || "AI Error",
      errorCode: code,
    };
  }
};

/* =====================================================
   PUBLIC API
===================================================== */

export const AiService = {
  isAvailable: () =>
    !!import.meta.env.VITE_GEMINI_API_KEY || !!import.meta.env.VITE_GROQ_API_KEY,

  // Cho UI hiển thị nhanh
  getPreferredBrain: (): Brain =>
    (StorageService.getAiBrain() as Brain) || "gemini",

  // Cho UI debug thống kê (optional)
  getUsageStats: () => loadUsage(),

  /* ===== Income Plan ===== */
  generateIncomePlan: async (idea: string) => {
    const preferred = AiService.getPreferredBrain();

    const system =
      "Bạn là cố vấn kinh doanh thực tế. Trả về JSON: {name, description, expectedIncome, milestones:[{title, daysFromNow}]}. Không markdown.";

    const prompt = `Lập kế hoạch thực thi cho ý tưởng kiếm tiền: "${idea}". Chỉ trả về JSON hợp lệ.`;

    const cacheKey = `income_plan:${preferred}:${djb2Hash(system + "|" + prompt)}`;

    return executeWithFallback<any>({
      feature: "income_plan",
      preferred,
      cacheKey,
      gemini: async () => {
        const raw = await callGemini(prompt, system);
        const parsed = safeJsonParse<any>(raw);
        return { raw, parsed };
      },
      llama: async () => {
        const raw = await callLlama(prompt, system);
        const parsed = safeJsonParse<any>(raw);
        return { raw, parsed };
      },
    });
  },

  /* ===== CFO Report ===== */
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
    const preferred = AiService.getPreferredBrain();

    const system =
      "Bạn là CFO thực chiến. Trả về JSON FinancialReport hợp lệ. Không markdown.";

    // Chỉ lấy gần đây cho nhẹ token + cache hiệu quả
    const dataContext = {
      gender,
      gamification,
      wallets: wallets.map(w => ({ name: w.name, bal: w.balance })),
      budgets: budgets.map(b => ({ cat: b.category, lim: b.limit, spent: b.spent })),
      fixedCosts: fixedCosts.map(c => ({ title: c.title, amt: c.amount })),
      goals: goals.map(g => ({ name: g.name, tar: g.targetAmount, cur: g.currentAmount, dl: g.deadline })),
      projects: projects.map(p => ({
        name: p.name,
        inc: p.expectedIncome,
        miles: p.milestones?.length || 0,
        done: (p.milestones || []).filter(m => m.isCompleted).length,
      })),
      transactions: transactions.slice(-50).map(t => ({
        type: t.type,
        cat: t.category,
        amt: t.amount,
        desc: t.description,
      })),
      today: new Date().toISOString(),
    };

    const prompt = `Phân tích dữ liệu tài chính và trả về JSON FinancialReport.
Dữ liệu: ${JSON.stringify(dataContext)}
`;

    // cache theo snapshot dữ liệu -> hash
    const cacheKey = `cfo_report:${preferred}:${djb2Hash(system + "|" + prompt)}`;

    return executeWithFallback<FinancialReport>({
      feature: "cfo_report",
      preferred,
      cacheKey,
      gemini: async () => {
        const raw = await callGemini(prompt, system);
        const parsed = safeJsonParse<FinancialReport>(raw);
        return { raw, parsed };
      },
      llama: async () => {
        const raw = await callLlama(prompt, system);
        const parsed = safeJsonParse<FinancialReport>(raw);
        return { raw, parsed };
      },
    });
  },
};
