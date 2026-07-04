/* ═══ CFO API Route — AI Financial Analysis ═══
 * Nhận MoneySnapshotV1 từ client (MoneyContent) → CFO Context Pack (số do engine
 * moneyBrain tính deterministic) → LLM chỉ diễn giải (schema-guarded), fallback
 * deterministic nếu không có/ lỗi LLM. healthScore luôn từ getFinancialHealthScore.
 */
import { NextRequest, NextResponse } from 'next/server';
import { toMoneySnapshotV1 } from '@/lib/moneyBrain';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { generateLLMResponse } from '@/lib/aiMoneyChat/llm/llmClient';
import { runCFOAnalysis } from '@/lib/aiMoneyChat/cfo/cfoService';

/**
 * Nếu body là snapshot (MoneySnapshotV1 hoặc ClientSnapshotInput) → MoneySnapshotV1.
 * Trả null nếu body không phải snapshot hợp lệ.
 */
function resolveMoneySnapshot(body: unknown): MoneySnapshotV1 | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const hasWallets = b.wallets && typeof b.wallets === 'object';
  if (!hasWallets) return null;
  // Cả MoneySnapshotV1 lẫn ClientSnapshotInput đều đi qua adapter để chuẩn hoá
  // (toMoneySnapshotV1 đọc field optional; budgets MoneySnapshotV1 dùng monthlyLimit).
  if (b.version === 'money_snapshot_v1' && Array.isArray(b.transactions)) {
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

/** Response context-pack — giữ field backward-compatible cho UI cũ. */
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

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Client (MoneyContent) luôn gửi MoneySnapshotV1 → số liệu do moneyBrain engine
  // tính, LLM chỉ diễn giải. (Nhánh "legacy" cũ dùng cfoHealthScore đã gỡ bỏ.)
  const moneySnapshot = resolveMoneySnapshot(body);
  if (!moneySnapshot) {
    return NextResponse.json({ error: 'Invalid snapshot payload' }, { status: 400 });
  }
  return handleSnapshotPath(moneySnapshot);
}
