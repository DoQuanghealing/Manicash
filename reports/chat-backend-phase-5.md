# Chat Backend Upgrade — Phase 5 Report (Hardening & Protection)

Date: 2026-06-07
Branch: `codex/ai-money-chat`
Author: Claude Code (Execution)
Reviewer: Selena (Architect)

## Mục tiêu

Lưới phòng vệ HỢP PHÁP + AN TOÀN: license gate fail-loud, telemetry phone-home,
watermark truy vết prompt, invalidation hook, long-term profile. KHÔNG cơ chế nào
làm sai lệch dữ liệu tài chính người dùng.

## Đã hoàn thành

- **License gate fail-loud**: `instrumentation.ts` throw ở production runtime khi thiếu key;
  bỏ qua build & dev; `/api/chat` trả 503 tường minh.
- **Telemetry phone-home**: hash sha256 domain lúc boot (production), optional POST endpoint.
- **Watermark**: chèn `[origin-verify:manicash-<md5(uid)[:8]>]` ẩn trong system prompt.
- **Invalidation hook**: `/api/chat` gọi `invalidateSnapshotCache(uid)` khi client gửi snapshot mới.
- **Long-term profile**: `longTermProfile.ts` (extract/strip/read/save Firestore `users/{uid}/state/aiProfile`);
  handleCFOReport nạp profile ở turn đầu + lưu note khi LLM gắn tag `[profile: ...]`.
- Test 13 ca, **13/13 PASS**. `npx tsc --noEmit` toàn dự án **exit 0**. Lint exit 0.
  Regression cả 8 suite (5 phase + parser/memory/quota) đều exit 0.

## Files changed

| File | Loại | Mô tả |
|---|---|---|
| `src/lib/aiMoneyChat/security/license.ts` | NEW | `isLicenseValid`, `assertLicenseOrThrow`, `LICENSE_ERROR_MESSAGE`. |
| `src/lib/aiMoneyChat/security/telemetry.ts` | NEW | `getDomainFingerprint`, `phoneHome`. |
| `src/instrumentation.ts` | NEW | boot-time gate (prod throw / dev warn / skip build) + telemetry. |
| `src/lib/aiMoneyChat/memory/longTermProfile.ts` | NEW | extract/strip/read/save profile. |
| `src/lib/aiMoneyChat/llm/promptBuilder.ts` | EDIT | `buildOriginWatermark` + nhúng watermark + inject longTermProfile. |
| `src/lib/aiMoneyChat/llm/systemPrompts.ts` | EDIT | hướng dẫn LLM gắn tag `[profile: ...]`. |
| `src/lib/aiMoneyChat/handlers/handleCFOReport.ts` | EDIT | readProfile + inject + extract/save/strip note (DI). |
| `src/lib/aiMoneyChat/handlers/handleFollowUp.ts` | EDIT | extract/save/strip note (DI). |
| `src/app/api/chat/route.ts` | EDIT | license 503 + invalidation hook. |
| `tests/ai-money-security.test.ts` | NEW | 13 ca. |
| `.env.example` | EDIT | LLM_PROVIDER, OPENAI_API_KEY, AI_MONEY_CHAT_OPENAI_MODEL, MANICASH_LICENSE_KEY, MANICASH_TELEMETRY_URL. |
| `package.json` | EDIT | script `test:ai-security`. |

## Quyết định kiến trúc cần Architect lưu ý

1. **License gate an toàn 2 lớp, KHÔNG brick dev/build.**
   - `isLicenseValid()` trả **true** khi không phải production → dev/test/build chạy bình thường.
   - Production runtime thiếu key → `instrumentation.register()` throw (fail-loud) + `/api/chat` 503.
   - Bỏ qua hoàn toàn `phase-production-build` → `next build` không bị chặn.
   - **Lý do**: bảo vệ bản quyền KHÔNG được hy sinh trải nghiệm dev hay dữ liệu user (đúng tinh
     thần "fail-loud, không silent-corrupt" đã chốt đầu Phase 5).

2. **`computeHealthScore` GIỮ nguyên ở vị trí dùng chung (client + server).**
   Nó đang được `useCFOSnapshot`, `CFOInsightCard.tsx`, `useChartData`, `butlerReport` dùng
   client-side để render report tức thời. Đây là **công thức điểm số deterministic, không
   phải IP bí mật**. IP thật sự đắt giá — `LORD_DIAMOND_SYSTEM_PROMPT`, orchestration LLM,
   prompt builder, anomaly z-score trong snapshotBuilder — **đã nằm server-only** (chỉ import
   bởi route/handler; snapshotBuilder dynamic-import firebaseAdmin nên không chạy được ở client).
   → Di dời computeHealthScore sẽ vỡ UI mà không tăng bảo mật thực chất. **Cần Architect xác nhận.**

3. **Invalidation hook đặt SERVER-SIDE, không nhét vào `useFinanceStore`.**
   `useFinanceStore.addTransaction` chạy CLIENT; cache in-memory sống ở SERVER (runtime khác).
   Import hàm cache server vào store client sẽ (a) bundle code server vào client hoặc (b) thao
   tác trên một Map rỗng vô nghĩa. Thay vào đó:
   - Server: `/api/chat` gọi `invalidateSnapshotCache(uid)` khi nhận `clientSnapshot` mới
     (tín hiệu "dữ liệu vừa đổi" hợp lệ duy nhất reachable từ server).
   - Client: tự "invalidate" theo thiết kế — mỗi lượt chat client tính lại snapshot từ Zustand
     và gửi lên, nên dữ liệu luôn mới. End-to-end đảm bảo "lượt chat sau thấy số liệu mới nhất".
   - Không có endpoint ghi transaction server-side (sms-webhook chỉ ghi `pending_transactions`
     chờ duyệt; finance thật ghi client → Firestore). **Cần Architect xác nhận hướng này.**

4. **Watermark gửi md5(uid) lên LLM mỗi call.** Là hash 8 ký tự, không lộ uid thô. Đánh đổi
   nhỏ để truy vết prompt leak. Có thể tắt nếu Architect không muốn.

5. **Long-term profile dùng tag `[profile: ...]` do LLM tự gắn**, server bóc + lưu (≤280 ký tự
   ~<100 tokens) + ẩn tag khỏi message. Firestore I/O bọc try/catch → không bao giờ làm gãy chat.
   Đọc lại ở turn đầu, nạp vào prompt.

## Tests (13/13 PASS)

- License: dev luôn pass; prod thiếu/ngắn key → invalid; prod key hợp lệ → valid; assert không
  throw ở dev; message tường minh.
- Telemetry: fingerprint ổn định, 16 hex, khác theo domain.
- Watermark: `buildOriginWatermark` = md5(uid)[:8] đúng format; nhúng vào system prompt.
- Profile: extract/strip tag, null khi vắng; handleCFOReport nạp profile cũ vào prompt + lưu
  note mới + ẩn tag; không tag → không gọi saveProfile.
- `npx tsc --noEmit` toàn dự án exit 0 (kể cả 2 test pre-existing trước đây — nay đã sạch).
- Regression 8 suite exit 0.

## Rủi ro còn lại

1. **Smoke test LLM thật**: vẫn cần chạy với OPENAI_API_KEY/GROQ_API_KEY thật trước launch
   (logic đã test bằng mock).
2. **FE wiring**: client `/chat` cần đóng gói `clientSnapshot` (wallets/bills/tasks/transactions/
   budgets/goals/history) + truyền `sessionId`. Đây là phần FE, ngoài scope BE.
3. **Profile extraction phụ thuộc LLM tuân thủ tag**: nếu model không gắn `[profile:]`, không có
   note nào được lưu (degrade an toàn, không sai).
4. **Telemetry phone-home**: mặc định chỉ log; chỉ POST khi set `MANICASH_TELEMETRY_URL`.

## Tổng kết toàn dự án (Phase 1 → 5)

| Phase | Nội dung | Test |
|---|---|---|
| 1 | Intent Router 4-tier rule-based | 30 PASS |
| 2 | Deterministic queries + hybrid snapshot + `/api/chat` | 13 PASS |
| 3 | Full snapshot (anomaly/goals/health) + LLM adapter (OpenAI/Groq) + Lord Diamond | 17 PASS |
| 4 | Conversation state + follow-up + lazy memory | 13 PASS |
| 5 | License gate + telemetry + watermark + invalidation + long-term profile | 13 PASS |

**Tổng: 86 test PASS, tsc-clean, lint-clean.** Hệ thống Chat Backend ManiCash 2.0 hoàn tất
theo Master Roadmap. Việc còn lại trước launch: FE wiring clientSnapshot + smoke test API key thật.
