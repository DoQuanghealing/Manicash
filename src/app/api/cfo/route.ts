/* ═══ CFO API Route — AI Financial Analysis ═══
 * Flow:
 *   1. Nhận snapshot từ client (HealthSnapshot fields).
 *   2. Tính healthScore + breakdown deterministic (server-side, KHÔNG trust AI).
 *   3. Có GROQ_API_KEY → gọi Groq cho narrative; nếu fail → fallback theo tier.
 *   4. Không có key → fallback ngay.
 *   5. Trả về CFOInsight = { summary, suggestions, healthScore, source }.
 *
 * Observability: log 3 source ('groq' | 'fallback-no-key' | 'fallback-error') để
 * monitor Groq health khi AI CFO trở thành Pro feature.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  computeHealthScore,
  getHealthTier,
  type HealthSnapshot,
} from '@/lib/cfoHealthScore';
import {
  getCFONarrative,
  getFallbackNarrative,
  type CFOInsight,
  type CFOPayload,
  type WatchedCategoryDetail,
  type FlaggedTransactionDetail,
} from '@/lib/groqClient';
import { toMoneySnapshotV1 } from '@/lib/moneyBrain';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { generateLLMResponse } from '@/lib/aiMoneyChat/llm/llmClient';
import { runCFOAnalysis } from '@/lib/aiMoneyChat/cfo/cfoService';

/**
 * Nếu body là snapshot (MoneySnapshotV1 hoặc ClientSnapshotInput) → MoneySnapshotV1.
 * Trả null nếu body là payload CFO legacy (flat numbers).
 */
function resolveMoneySnapshot(body: unknown): MoneySnapshotV1 | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const hasWallets = b.wallets && typeof b.wallets === 'object';
  if (!hasWallets) return null;
  // Cả MoneySnapshotV1 lẫn ClientSnapshotInput đều đi qua adapter để chuẩn hoá
  // (toMoneySnapshotV1 đọc field optional; budgets MoneySnapshotV1 dùng monthlyLimit).
  if (b.version === 'money_snapshot_v1' && Array.isArray(b.transactions)) {
    // Đã đúng shape — chuẩn hoá nhẹ field budget (monthlyLimit -> limit) cho adapter.
    const normalized = {
      ...b,
      budgets: Array.isArray(b.budgets)
        ? (b.budgets as Array<Record<string, unknown>>).map((bd) => ({
            categoryId: bd.categoryId,
            name: bd.categoryName ?? bd.name,
            limit: typeof bd.monthlyLimit === 'number' ? bd.monthlyLimit : bd.limit,
          }))
        : b.budgets,
    };
    return toMoneySnapshotV1(normalized as ClientSnapshotInput);
  }
  if (Array.isArray(b.transactions) || Array.isArray(b.bills) || Array.isArray(b.budgets)) {
    return toMoneySnapshotV1(b as ClientSnapshotInput);
  }
  return null;
}

/** Response mới (context-pack) — giữ field backward-compatible cho UI cũ. */
async function handleSnapshotPath(snapshot: MoneySnapshotV1) {
  const result = await runCFOAnalysis(snapshot, { generate: generateLLMResponse });
  const { context, cfo, deterministicFallback } = result;
  console.log(
    `[CFO] healthScore=${context.healthScore.total} mode=${context.financialMode} ` +
      `source=${deterministicFallback ? 'fallback' : 'llm'}`,
  );
  return NextResponse.json({
    version: 'cfo_response_v1',
    contextVersion: context.version,
    generatedAt: context.generatedAt,
    // Backward-compatible top-level fields (CFOInsightCard).
    summary: cfo.summary,
    suggestions: cfo.actionPlan7Days,
    healthScore: context.healthScore.total,
    source: deterministicFallback ? 'quick' : 'ai',
    // New rich payload.
    cfo,
    executiveSummary: context.executiveSummary,
    financialMode: context.financialMode,
    deterministicFallback,
  });
}

/** Cap watched-categories từ client — chống abuse + giữ prompt size hợp lý. */
const MAX_WATCHED = 5;
/** Cap flagged-transactions từ client. */
const MAX_FLAGGED_TXNS = 5;

/** Validate + sanitize watched-category từ client. */
function parseWatched(raw: unknown): WatchedCategoryDetail[] {
  if (!Array.isArray(raw)) return [];
  const num = (v: unknown, fb = 0) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  return raw
    .map((entry): WatchedCategoryDetail | null => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const name = typeof e.name === 'string' ? e.name.slice(0, 40).trim() : '';
      if (!name) return null;
      const spent = Math.max(0, num(e.spent));
      const limit = Math.max(0, num(e.limit));
      return {
        name,
        spent,
        limit,
        overBy: Math.max(0, num(e.overBy)),
        percent: Math.max(0, Math.min(9999, Math.round(num(e.percent)))),
        isFlagged: Boolean(e.isFlagged),
        isOver: Boolean(e.isOver),
        savingsAt20pct: Math.max(0, num(e.savingsAt20pct, Math.round(spent * 0.2))),
      };
    })
    .filter((x): x is WatchedCategoryDetail => x !== null)
    .slice(0, MAX_WATCHED);
}

/** Validate + sanitize flagged-transactions từ client. */
function parseFlaggedTxns(raw: unknown): FlaggedTransactionDetail[] {
  if (!Array.isArray(raw)) return [];
  const num = (v: unknown, fb = 0) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  return raw
    .map((entry): FlaggedTransactionDetail | null => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const categoryName = typeof e.categoryName === 'string'
        ? e.categoryName.slice(0, 40).trim()
        : '';
      if (!categoryName) return null;
      return {
        categoryName,
        note: typeof e.note === 'string' ? e.note.slice(0, 80).trim() : '',
        amount: Math.max(0, num(e.amount)),
        daysAgo: Math.max(0, Math.min(60, Math.floor(num(e.daysAgo)))),
      };
    })
    .filter((x): x is FlaggedTransactionDetail => x !== null)
    .slice(0, MAX_FLAGGED_TXNS);
}

/** Internal log source — dev-only, NOT exposed to client. */
type CFOSource = 'groq' | 'fallback-no-key' | 'fallback-error';

/** Validate + normalize input từ client (defensive — client có thể tamper). */
function parseSnapshot(body: unknown): HealthSnapshot | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  // dayOfMonth — fallback về ngày hiện tại nếu thiếu
  const dayOfMonth = num(b.dayOfMonth, new Date().getDate());

  return {
    monthlyIncome: Math.max(0, num(b.monthlyIncome)),
    monthlyExpense: Math.max(0, num(b.monthlyExpense)),
    safeToSpend: num(b.safeToSpend), // cho phép âm
    emergencyBalance: Math.max(0, num(b.emergencyBalance)),
    categoriesTotal: Math.max(0, Math.floor(num(b.categoriesTotal))),
    categoriesOverBudget: Math.max(0, Math.floor(num(b.categoriesOverBudget))),
    billsDueByNow: Math.max(0, Math.floor(num(b.billsDueByNow))),
    billsPaidOfDue: Math.max(0, Math.floor(num(b.billsPaidOfDue))),
    dayOfMonth: Math.min(31, Math.max(1, Math.floor(dayOfMonth))),
  };
}

/** Build CFOPayload từ snapshot + transaction count (lấy thêm từ body). */
function buildPayload(body: unknown, snapshot: HealthSnapshot, savingsRate: number): CFOPayload {
  const b = (body as Record<string, unknown>) || {};
  const txCount = typeof b.transactionCount === 'number'
    ? Math.max(0, Math.floor(b.transactionCount))
    : 0;
  const watchedCategories = parseWatched(b.watchedCategories);
  const topFlaggedTransactions = parseFlaggedTxns(b.topFlaggedTransactions);

  return {
    monthlyIncome: snapshot.monthlyIncome,
    monthlyExpense: snapshot.monthlyExpense,
    savingsRate,
    safeToSpend: snapshot.safeToSpend,
    emergencyBalance: snapshot.emergencyBalance,
    categoriesTotal: snapshot.categoriesTotal,
    categoriesOverBudget: snapshot.categoriesOverBudget,
    billsDueByNow: snapshot.billsDueByNow,
    billsPaidOfDue: snapshot.billsPaidOfDue,
    transactionCount: txCount,
    watchedCategories,
    topFlaggedTransactions,
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // === 0. Snapshot path (Phase 3): CFO Context Pack + schema-guarded AI ===
  const moneySnapshot = resolveMoneySnapshot(body);
  if (moneySnapshot) {
    return handleSnapshotPath(moneySnapshot);
  }

  // === 1. Legacy path: parse + tính healthScore (luôn chạy, không phụ thuộc Groq) ===
  const snapshot = parseSnapshot(body);
  if (!snapshot) {
    return NextResponse.json(
      { error: 'Invalid snapshot payload' },
      { status: 400 },
    );
  }

  const breakdown = computeHealthScore(snapshot);
  const payload = buildPayload(body, snapshot, breakdown.savingsRate);

  // === 2. Sinh narrative — Groq nếu có key, fallback nếu không ===
  const apiKey = process.env.GROQ_API_KEY;
  let narrative: { summary: string; suggestions: string[] };
  let source: CFOSource;

  if (apiKey) {
    try {
      narrative = await getCFONarrative(apiKey, payload, breakdown);
      source = 'groq';
    } catch (error) {
      console.error('CFO Groq error, using fallback:', error);
      narrative = getFallbackNarrative(breakdown, payload.watchedCategories, payload.topFlaggedTransactions);
      source = 'fallback-error';
    }
  } else {
    narrative = getFallbackNarrative(breakdown, payload.watchedCategories, payload.topFlaggedTransactions);
    source = 'fallback-no-key';
  }

  // === Observability log — server console only ===
  const tier = getHealthTier(breakdown.total);
  console.log(`[CFO] healthScore=${breakdown.total} tier=${tier} source=${source}`);

  // === 3. Compose response — healthScore từ formula deterministic ===
  // Client chỉ thấy 'ai' | 'quick' — chi tiết "no-key" vs "error" giấu trong log.
  const insight: CFOInsight = {
    summary: narrative.summary,
    suggestions: narrative.suggestions,
    healthScore: breakdown.total,
    source: source === 'groq' ? 'ai' : 'quick',
  };

  return NextResponse.json(insight);
}
