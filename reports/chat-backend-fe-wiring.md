# Chat Backend — FE Wiring Report

Date: 2026-06-08
Branch: `codex/ai-money-chat`
Author: Claude Code (Execution)

## Mục tiêu

Nối UI `/chat` với backend `/api/chat` (Phase 1-5) để chat AI hoạt động real-time:
truy vấn số dư/hóa đơn/nhiệm vụ + báo cáo CFO + follow-up, dùng dữ liệu thật từ Zustand.

## Thiết kế tích hợp (giữ flow cũ, thêm flow mới)

- **Nhập giao dịch** ("mua trà sữa 50k") → vẫn chạy LOCAL (confirm card + memory correction +
  AI fallback). Không đổi.
- **Truy vấn / phân tích** (số dư, bill, nhiệm vụ, CFO, follow-up) → gọi `/api/chat` kèm
  `clientSnapshot` đóng gói từ Zustand + `sessionId`.
- Phân nhánh bằng `classifyIntent(text)` client-side: `LOG_TRANSACTION` → local; còn lại → server.

## Files changed

| File | Loại | Mô tả |
|---|---|---|
| `src/lib/aiMoneyChat/clientSnapshot.ts` | NEW | `buildClientSnapshot()` map Zustand → `ClientSnapshotInput` (wallets, bills, tasks, transactions tháng này, history 3 tháng, budgets, goals). |
| `src/lib/aiMoneyChat/chatClient.ts` | NEW | `sendChatMessage()` POST `/api/chat` + Bearer ID token, xử lý 401/503/error. |
| `src/app/(app)/chat/_components/AiMoneyChatContent.tsx` | EDIT | route intent, `askAssistant()`, markdown render (`FormattedText`), sessionId, typing indicator, welcome + examples mới. |
| `tests/ai-money-client-snapshot.test.ts` | NEW | 3 ca test builder. |
| `.env.local` | EDIT | bật `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true`, `AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true`. |
| `package.json` | EDIT | script `test:ai-client-snapshot`. |

## Verify

- `npx tsc --noEmit` (toàn dự án): exit 0.
- `npx eslint` (file FE): exit 0.
- `npm run test:ai-client-snapshot`: 3/3 PASS.
- Regression 6 suite AI: exit 0.
- Dev server: `POST /api/chat` (no auth) → 401 (route OK); `GET /chat` → 200 (page OK).
- Smoke LLM thật (đã chạy tay): OpenAI gpt-4o-mini trả báo cáo Lord Diamond đúng format,
  fallback Groq hoạt động khi OpenAI 429.

## Cách test trên app

1. Dev server đang chạy: http://localhost:3000 (hoặc `npm run dev` để khởi động lại).
2. Đăng nhập Google → vào tab Chat (`/chat`).
3. Thử các chip: "toi con bao nhieu tien", "tien dien dong chua", "len bao cao CFO thang nay".
4. Nhập giao dịch ("mua trà sữa 50k") vẫn ra confirm card như cũ.

## Rủi ro / lưu ý

- CFO report tốn 8 credit/lượt (quota Pro). Free user sẽ nhận thông báo mời nâng Pro
  (đúng thiết kế). Để test thoải mái, đảm bảo user là Pro hoặc tăng
  `AI_MONEY_CHAT_FREE_MONTHLY_CREDITS` tạm thời.
- `clientSnapshot` đóng gói client → server validate; số liệu real-time, chính xác tuyệt đối.
- Markdown render là bản nhẹ (heading/bold/bullet); đủ đẹp cho báo cáo CFO.
