# Phase 3 Report — CFO Context Pack V1 + AI CFO JSON Schema

## 1. Summary
**Đã làm:** Nâng CFO AI từ "prompt vai trò" → "đọc báo cáo đã tính sẵn". Money Brain tính toàn bộ số (CFOContextPackV1); LLM chỉ diễn giải theo JSON schema chặt; có fallback deterministic khi LLM thiếu key/lỗi/JSON sai. `/api/cfo` + `handleCFOReport` dùng context pack, backward-compatible.

**Chưa làm (đúng phạm vi):** Không Action Protocol/execute (Phase 4), không DB, không đổi UI layout lớn, không lời khuyên đầu tư cụ thể.

## 2. Branch / Git
- Branch: `codex/ai-money-chat`
- Starting commit: `34beea4` (Phase 2)
- Ending commit: chưa commit (chờ PO duyệt)
- Working tree: 8 modified + 14 untracked (xem mục 10)

## 3. CFO Context Pack
- Version: `cfo_context_v1`
- Sections: period, financialMode, executiveSummary, healthScore (6 thành phần), wallets, bills, budget (+cutSimulation), behavior, goals, earningTasks, history, constraints.
- Metrics source: 100% từ `src/lib/moneyBrain` engine. `buildCFOContextPack(snapshot)` PURE — không React/Zustand/API/Date.now() (generatedAt = snapshot.clientNow).

## 4. Financial Mode (`financialMode.ts`)
- Rules: safeToSpend≤0 hoặc billCoverage<1 → `stabilize`; safeToSpend>0 & savingsRate<20 → `build_cashflow`; savingsRate≥20 & runway≥3 → `accelerate` (hoặc `protect_capital` nếu thanh khoản ≥6 tháng chi + 0 overbudget + 0 goal at-risk).
- Tests: `moneybrain-financial-mode.test.ts` (6 cases, đủ 4 mode + runway helper).

## 5. Behavior / History Metrics
- Behavior (`behaviorMetrics.ts`): largestExpenses, unusualExpenses (≥2.5× avg, ≥3 txns/category), repeatedSmallLeaks (≤100k, ≥3 lần), weekendSpending (T7/CN theo dateKey). Tests: `moneybrain-behavior-metrics.test.ts`.
- History (`historyMetrics.ts`): availableMonths, monthlyHistory(N), hasEnoughHistory — KHÔNG fabricate tháng thiếu. Tests: `moneybrain-history-metrics.test.ts`.

## 6. AI CFO Schema & Prompt
- Schema (`cfo/cfoResponseSchema.ts`, plain TS — project chưa dùng Zod): `summary, diagnosis[1..6], risks[0..6], opportunities[0..6], actionPlan7Days[3..7], quickWins?, warnings?`. **Không** có healthScore/totalIncome/totalExpense/safeToSpend (field thừa bị strip tự nhiên).
- Prompt (`cfo/cfoPromptBuilder.ts`): system cấm "Không tự tạo số liệu", "Không sửa healthScore", yêu cầu JSON-only; user nhúng context JSON (không có transaction thô).
- Number guard: `parseCFOAIResponse` chỉ copy field cho phép; `runCFOAnalysis` luôn lấy số từ context.

## 7. API / Chat Integration
- `/api/cfo`: phát hiện snapshot (MoneySnapshotV1/ClientSnapshotInput) → `handleSnapshotPath` (context pack + schema-guarded AI). Body legacy (HealthSnapshot phẳng) → path cũ giữ nguyên. Response mới có top-level `{summary, suggestions, healthScore, source}` (backward-compatible CFOInsightCard) + `{cfo, executiveSummary, financialMode, contextVersion, generatedAt, deterministicFallback}`.
- `handleCFOReport`: quota gate → `toMoneySnapshotV1(clientSnapshot)` → `runCFOAnalysis` → compose markdown ("Số liệu chính" từ context, diễn giải từ LLM). Session vẫn lưu legacy snapshot (follow-up Phase 4 không đổi).
- Backward compatibility: `/money` gửi MoneySnapshotV1 (đã có sẵn trong `useCFOSnapshot`); CFOInsightCard không đổi.

## 8. Fallback
- Missing key / provider chưa cấu hình: `generateLLMResponse` throw → `runCFOAnalysis` catch → `buildDeterministicCFOFallback(context)`.
- Invalid JSON: `parseCFOAIResponse` trả null → fallback.
- Provider error/timeout: catch → fallback. KHÔNG trả 500 cho user.

## 9. UI
- Money CFO card: vẫn render (summary/suggestions/healthScore/source giữ nguyên field). HealthScoreGauge vẫn dùng `breakdown.total` deterministic (Phase 1B).
- Report page: local-first, không phụ thuộc `/api/cfo` → không vỡ. (Follow-up: có thể render thêm diagnosis/risks/opportunities/financialMode từ response mới.)

## 10. Tests
**New (mb):** financial-mode, behavior-metrics, history-metrics, cfo-context-pack.
**New (ai-cfo):** response-schema, prompt-builder, fallback, report-context, llm-guard.
**Updated:** `ai-money-cfo-llm.test.ts` (handleCFOReport → JSON contract + composed markdown).
**Scripts:** thêm `test:mb-finmode|behavior|history|cfopack`, `test:ai-cfo-schema|prompt|fallback|context|guard`; gộp vào `test:moneybrain` + `test:ai-money`.

**Commands & kết quả:**
- `npx tsc --noEmit` → **0 errors**
- `npm run test:moneybrain` → 14 suites, all complete, 0 FAIL
- `npm run test:ai-money` → **159 PASS / 0 FAIL** (18 suites)
- `npm run test:ai-cfo-llm` → 0 FAIL
- `npm run test:ai-all` → **76 PASS / 0 FAIL** (không regression)
- `eslint` changed files → 0 errors/warnings
- grep guards: moneyBrain 0 `Date.now()`/`fetch`/provider/React/Zustand (chỉ comment); CFO schema không có field healthScore.

## 11. Risks / Follow-up for Phase 4
- `/report` chưa render full response mới (diagnosis/risks/opportunities/financialMode) — follow-up UI.
- `handleCFOReport` bỏ longTermProfile note-extraction (JSON output không có tag) — có thể thêm lại field `profileNote` vào schema sau.
- Bill status trong context vẫn dùng billMetrics (paid/unpaid) — đủ cho CFO; due/overdue chi tiết để Phase sau nếu cần.
- **Phase 4 — Client-executed Action Protocol**: server trả `actionRequest`, client confirm + execute Zustand.

---

## Phase 3 Acceptance Checklist
- [x] `CFOContextPackV1` type
- [x] `buildCFOContextPack(snapshot)`
- [x] financialMode deterministic
- [x] behaviorMetrics + historyMetrics (no fabricate)
- [x] healthScore từ engine, không từ LLM
- [x] AI response schema không có healthScore/income/expense/safeToSpend
- [x] Prompt cấm AI tự tạo số + JSON-only
- [x] LLM invalid → fallback deterministic
- [x] `/api/cfo` dùng context pack + backward-compatible
- [x] `handleCFOReport` dùng context pack; số từ context
- [x] Deterministic handlers Phase 2 không regression
- [x] Money CFO card render; HealthScoreGauge deterministic
- [x] tsc / test:moneybrain / test:ai-money / test:ai-all / eslint pass
- [x] report Phase 3
- [x] chưa commit (chờ duyệt)
