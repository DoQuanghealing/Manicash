# Chat Backend Upgrade — Phase 4 Report (Conversation State + Lazy Memory)

Date: 2026-06-07
Branch: `codex/ai-money-chat`
Author: Claude Code (Execution)
Reviewer: Selena (Architect)

## Mục tiêu

Trí nhớ ngắn hạn cho hội thoại CFO follow-up: lưu snapshot turn đầu để các câu
"tại sao lố", "cắt thế nào" tái dùng — KHÔNG re-aggregate DB; heuristic ép FOLLOW_UP.

## Đã hoàn thành

- `conversationStore`: Map in-memory, TTL absolute 30′, MAX_TURNS=8, purge khi hết hạn,
  chống rò rỉ chéo uid.
- Heuristic `detectFollowUp` + override `UNKNOWN → FOLLOW_UP` trong `routeIntent`.
- `handleFollowUp`: tái dùng snapshot phiên (không gọi `getFinanceSnapshot`), nạp history
  vào prompt, quota gate, fallback khi hết phiên.
- `handleCFOReport` tạo `createSession` + lưu turn đầu khi báo cáo thành công.
- Test 13 ca gồm hội thoại 3 lượt, **13/13 PASS**. Lint exit 0. tsc-clean.

## Files changed

| File | Loại | Mô tả |
|---|---|---|
| `src/lib/aiMoneyChat/llm/conversationStore.ts` | NEW | `ConversationTurn/Context`, `createSession/getOrCreateSession/appendTurn/purgeExpired`, TTL 30′, MAX_TURNS 8, store trên globalThis. |
| `src/lib/aiMoneyChat/intent/intentRouter.ts` | EDIT | `detectFollowUp()` + override UNKNOWN→FOLLOW_UP. |
| `src/lib/aiMoneyChat/handlers/handleFollowUp.ts` | NEW | tái dùng snapshot phiên, history, quota, DI. |
| `src/lib/aiMoneyChat/handlers/handleCFOReport.ts` | EDIT | createSession + appendTurn ở turn đầu. |
| `src/lib/aiMoneyChat/aggregation/types.ts` | EDIT | `ChatHandlerContext.sessionId`. |
| `src/app/api/chat/route.ts` | EDIT | ctx.sessionId, wire handleFollowUp. |
| `tests/ai-money-conversation.test.ts` | NEW | 13 ca (store unit + detector + 3-turn convo). |
| `package.json` | EDIT | script `test:ai-conversation`. |

## Quyết định kiến trúc cần Architect lưu ý

1. **STORE đặt trên `globalThis` (Symbol.for), không phải module-const Map.**
   Lý do kép: (a) chống Next.js dev hot-reload tạo nhiều instance module làm mất session;
   (b) đảm bảo mọi đường import (alias `@/...` vs relative `../...`) chia sẻ chung 1 Map.
   **Bug đã phát hiện & vá**: dưới test runner jiti, alias và relative load thành 2 module
   instance → 2 Map riêng → `handleCFOReport` (relative) ghi session mà test (alias) đọc ra
   null. globalThis-singleton xử lý triệt để, đồng thời bền hơn cho production dev.

2. **`sessionId` nhét vào `ChatHandlerContext`, KHÔNG đổi chữ ký handler.** Giữ
   `handleCFOReport(uid, intent, ctx, deps?)` như Phase 3 → 0 regression cho test Phase 3.

3. **Override FOLLOW_UP chỉ khi classifier = UNKNOWN.** Câu rõ ràng ("còn bao nhiêu tiền"
   → QUERY_BALANCE; "cắt giảm chi tiêu" → ADVICE) KHÔNG bị ép. Token đơn `do`/`no` match
   nguyên token (không dính "doan"/"nong"); cụm `tai sao`/`bang cach nao`... match substring.

4. **Credit follow-up = `chargeAiMoneyCfoNarrationCredit`** (như CFO). Follow-up vẫn là 1
   lượt LLM đầy đủ; dùng chung bucket cho nhất quán cost model. Có thể tách bucket rẻ hơn
   nếu Architect muốn.

## Data logic — hội thoại 3 lượt (đã test)

```
Turn 1: "lên báo cáo CFO tháng" (CFO_REPORT, có clientSnapshot + sessionId)
  -> aggregate snapshot, gọi LLM, createSession(snapshot) + appendTurn#1
Turn 2: "tại sao mục mua sắm lại lố" (UNKNOWN + 'tai sao' -> FOLLOW_UP, KHÔNG clientSnapshot)
  -> getOrCreateSession -> TÁI DÙNG snapshot cũ (income 20M có trong prompt)
  -> history có turn#1 -> LLM -> appendTurn#2  (source: 'llm-cached')
Turn 3: "bằng cách nào để khắc phục" (FOLLOW_UP)
  -> snapshot cũ, history có turn#1 + turn#2 -> appendTurn#3
```

Test khẳng định: prompt turn 2/3 chứa `20000000` (snapshot turn-1) → **chứng minh KHÔNG
re-aggregate**; history tích lũy đúng (`reply-1`, `reply-2`); `turns.length` = 1→2→3.

## Tests (13/13 PASS)

- Store: create/get, uid khác→null, sessionId lạ→null, hết hạn→purge+null, cap MAX_TURNS.
- Detector: keyword→true, "doan" không dính "do"→false, UNKNOWN+keyword→FOLLOW_UP,
  intent rõ ràng không bị override.
- 3-turn convo (no re-aggregate, history tích lũy), follow-up hết phiên→mời báo cáo mới
  (ui follow-up-buttons), follow-up hết quota→báo hết credit + KHÔNG gọi LLM.
- Regression: `test:ai-intent` / `test:ai-handlers` / `test:ai-cfo-llm` đều exit 0.
- `npx tsc --noEmit` 0 lỗi trong file Phase 1-4.

## Rủi ro còn lại

1. **In-memory single-instance**: session sống trong RAM 1 instance. Vercel Fluid Compute
   tái dùng instance nên đủ cho beta; cold start/scale-out mất session → handleFollowUp
   degrade an toàn (mời tạo báo cáo mới). Khi scale: chuyển sang Redis/Vercel Cache, giữ
   nguyên 3 hàm public.
2. **Long-term profile chưa làm**: prompt Phase 4 nhắc `longTermProfile.ts` (ghi "điểm lạ"
   vào Firestore). Tôi tập trung short-term theo trọng tâm "hội thoại liên tục". Long-term
   profile đề xuất làm ở phase phụ riêng nếu Architect cần (cần quyết shape Firestore).
3. **purgeExpired chưa có scheduler**: hiện lazy purge khi `getOrCreateSession` chạm phiên
   hết hạn. Có thể thêm cron gọi `purgeExpired()` định kỳ nếu RAM cần dọn chủ động.

## Việc tiếp theo (Phase 5)

- Code Protection & Hardening: license gate fail-loud, server-side proprietary logic,
  watermark prompt, telemetry (latencyMs/tokensUsed/source), invalidation hook
  `addTransaction → invalidateSnapshotCache`.
