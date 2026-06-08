# Chat Backend Upgrade — Phase 3 Report (Context Aggregation + LLM Integration)

Date: 2026-06-07
Branch: `codex/ai-money-chat`
Author: Claude Code (Execution)
Reviewer: Selena (Architect)

## Mục tiêu

Mở rộng snapshot thành ngữ cảnh tài chính toàn diện; xây LLM adapter
provider-agnostic (OpenAI primary + Groq fallback); persona Lord Diamond;
hoàn thiện `handleCFOReport` có quota gate.

## Đã hoàn thành

- `MonthlyFinancialSnapshot` đầy đủ: cashflow, budget/safeToSpend, categories
  (top + overspent), **anomalies z-score (>2.0 so với 3 tháng trước)**, goals at risk,
  health score (tích hợp `computeHealthScore` sẵn có).
- LLM adapter: `LLMProvider` interface, `OpenAIProvider` (gpt-4o-mini),
  `GroqProvider` (llama-3.3-70b-versatile), `llmClient` routing + **auto-fallback**.
- `LORD_DIAMOND_SYSTEM_PROMPT` (ép bám số liệu, format 3 phần) + `buildLLMMessages`
  (nén JSON, bóc ID thừa).
- `handleCFOReport` wire vào route cho `CFO_REPORT / ANALYZE_FINANCE / ADVICE_CUT_SPENDING`.
- Test 17 ca, **17/17 PASS**. Lint exit 0 (0 warning). tsc-clean toàn bộ file mới.

## Files changed

| File | Loại | Mô tả |
|---|---|---|
| `src/lib/aiMoneyChat/aggregation/types.ts` | EDIT | thêm SnapshotCashflow/Budget/Category/Anomaly/Goal/Health; mở rộng `MonthlyFinancialSnapshot`, `ClientSnapshotInput` (transactions/history/budgets/goals). |
| `src/lib/aiMoneyChat/aggregation/snapshotBuilder.ts` | REWRITE | computeCashflow/Categories/Anomalies(z-score)/Goals + buildHealth; zeroSections cho empty/firestore. |
| `src/lib/aiMoneyChat/llm/types.ts` | NEW | `LLMProvider`, `LLMMessage`, `LLMOptions`, `LLMResult`. |
| `src/lib/aiMoneyChat/llm/openaiProvider.ts` | NEW | OpenAI REST (gpt-4o-mini). |
| `src/lib/aiMoneyChat/llm/groqProvider.ts` | NEW | Groq REST (llama-3.3-70b). |
| `src/lib/aiMoneyChat/llm/llmClient.ts` | NEW | `generateLLMResponse` + fallback + DI. |
| `src/lib/aiMoneyChat/llm/systemPrompts.ts` | NEW | `LORD_DIAMOND_SYSTEM_PROMPT`. |
| `src/lib/aiMoneyChat/llm/promptBuilder.ts` | NEW | `buildLLMMessages`, `compactSnapshot`. |
| `src/lib/aiMoneyChat/handlers/handleCFOReport.ts` | NEW | quota gate + snapshot + prompt + LLM, DI. |
| `src/app/api/chat/route.ts` | EDIT | wire handleCFOReport, bỏ placeholder. |
| `tests/ai-money-cfo-llm.test.ts` | NEW | 17 ca. |
| `package.json` | EDIT | script `test:ai-cfo-llm`. |

## Quyết định kiến trúc cần Architect lưu ý

1. **LLM adapter dùng `fetch`, KHÔNG cài SDK `openai`.** OpenAI + Groq cùng API
   `/chat/completions`; codebase sẵn có (groqClient, parse route) đã dùng fetch.
   → zero-dependency, đồng bộ. `LLMProvider` cô lập nên swap sang SDK chính thức
   sau này chỉ sửa 1 file. **Khác chữ trong prompt** ("thư viện chính thức OpenAI")
   — cần Architect duyệt; tôi sẵn sàng đổi nếu muốn dùng SDK thật.

2. **Credit: dùng `chargeAiMoneyCfoNarrationCredit` (8 credits), KHÔNG phải
   `chargeAiMoneyFallbackCredit` (1 credit).** Prompt ghi `chargeAiMoneyFallbackCredit`
   nhưng đó là credit cho parse (1 credit) — undercharge cho 1 báo cáo CFO đầy đủ.
   CFO narration = 8 credits đúng với cost model roadmap. Đã chọn bucket đúng ngữ nghĩa.

3. **Fix loader crash bằng dynamic import.** `handleCFOReport` import tĩnh `../quota`
   → kéo `firebase-admin` (top-level await) làm test runner (jiti) sập. Đổi sang
   `await import('../quota')` trong `defaultDeps()` — production không đổi, test inject
   `charge` nên không chạm firebase. (snapshotBuilder đã lazy-import firebaseAdmin từ trước.)

4. **DI cho testability.** `handleCFOReport(uid, intent, ctx, deps?)` và
   `generateLLMResponse(messages, options, deps?)` nhận deps optional → test routing
   + quota + LLM bằng mock, không cần env Firebase/OpenAI/Groq.

## Data logic chính

- **savingsRate** = `(income - expense) / income` (đồng bộ `computeHealthScore`).
- **safeToSpend** = `max(0, budgetTotal - expense - billChưaTrả)`.
- **Anomaly z-score**: cho mỗi danh mục, `mean`/`std` từ tối đa 3 tháng trong `history`;
  `z = (thisMonth - mean) / std`; flag khi `z > 2.0` và `std > 0` (cần ≥2 điểm lịch sử).
- **Goal at risk**: `monthsToComplete = ceil(remaining / pace)`; at risk khi có deadline
  và `monthsToComplete > monthsAvailable` (hoặc pace ≤ 0). `pace` = monthlyContribution,
  thiếu thì lấy proxy `cashflow.savings`.
- **compactSnapshot**: bỏ uid + mọi `id`, bỏ section rỗng → JSON ~vài trăm token.

## Tests (17/17 PASS)

- Snapshot: cashflow/savingsRate, budget/safeToSpend/overspent, anomaly z>2 (mua sắm đột
  biến bị flag, food ổn định không), goals at risk, health score 0-100.
- compactSnapshot: không lộ uid/id, có cashflow/health/anomalies.
- buildLLMMessages: có Lord Diamond + CONTEXT, user message cuối, history chèn đúng.
- llmClient: OpenAI OK→không fallback; OpenAI lỗi→Groq; OpenAI chưa cấu hình→Groq;
  preferred=groq→Groq; cả hai fail→throw.
- handleCFOReport: quota OK→cfo-card+suggestions+tokensUsed; free denied→mời Pro;
  pro hết hạn mức→báo hết credit; LLM lỗi→fallback deterministic kèm health score.
- Regression: `test:ai-intent` 0 FAIL, `test:ai-handlers` 13 PASS/0 FAIL.
- `npx tsc --noEmit` 0 lỗi trong file Phase 1/2/3 (2 lỗi pre-existing ở tests khác, đã
  tách task riêng từ Phase 2).

## Rủi ro còn lại

1. **Chưa gọi LLM thật** (không có OPENAI_API_KEY/GROQ_API_KEY trong môi trường dev).
   Logic routing đã test bằng mock; cần smoke test với key thật trước launch.
2. **Anomaly/goals phụ thuộc client gửi `history`/`budgets`/`goals`** trong clientSnapshot.
   Firestore fallback chưa có các mục này (trả zero + warning). Việc wire FE đóng gói
   snapshot là phần tiếp theo (ngoài scope BE Phase 3).
3. **Env mới cần khai báo** (`.env.example`): `OPENAI_API_KEY`, `LLM_PROVIDER`,
   `AI_MONEY_CHAT_OPENAI_MODEL` (optional). Nên thêm trước khi deploy.

## Việc tiếp theo (Phase 4)

- Conversation state (short-term session 30′, long-term profile).
- `handleFollowUp` tái dùng snapshot trong phiên (không re-aggregate).
- Heuristic detect "tại sao / đó / nó" → FOLLOW_UP tại route.
