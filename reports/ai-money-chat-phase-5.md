# AI Money Chat Phase 5 Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Them AI fallback co guardrail de chi dung khi local parser + memory khong chac, khong lo key, khong tu ghi giao dich, va validate JSON truoc khi dua vao UI.

## Da hoan thanh

- Them API route server:
  - `/api/ai-money-chat/parse`
- Them server cost gate:
  - `AI_MONEY_CHAT_AI_FALLBACK_ENABLED=false`
- Them model config:
  - `AI_MONEY_CHAT_GROQ_MODEL=llama-3.3-70b-versatile`
- Route chi goi Groq khi:
  - server flag bat `true`
  - co `GROQ_API_KEY`
  - payload hop le
- Client chi request AI fallback khi:
  - local intent co amount
  - type la income/expense
  - source khong phai memory
  - confidence la `low`
- Them strict validator:
  - reject category ID la
  - reject type khong ho tro
  - reject/replace amount sai bang local amount neu co
  - luon `needsConfirmation=true` voi AI fallback
- Chat UI hien status khi dang hoi AI fallback.
- Neu AI fail/disabled/no-key, chat giu local draft de user xac nhan.
- Neu AI tra intent hop le, chat thay draft bang AI fallback intent va van bat user xac nhan.

## Files changed

- `src/app/api/ai-money-chat/parse/route.ts`
- `src/lib/aiMoneyChat/aiFallback.ts`
- `src/lib/aiMoneyChat/clientFallback.ts`
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`
- `tests/ai-money-fallback.test.ts`
- `package.json`
- `.env.example`
- `docs/AI_MONEY_CHAT_ROADMAP.md`
- `reports/ai-money-chat-phase-5.md`
- `reports/financial-memory-report.md`

## User flows

Flow fallback:

1. User nhap mot cau local parser khong chac, vi du `mua do la la 99k`.
2. Local parser tao draft `other`, confidence low.
3. Chat goi `/api/ai-money-chat/parse`.
4. Neu server flag tat, API tra `disabled`, UI giu local draft.
5. Neu server flag bat va Groq tra JSON hop le, UI cap nhat draft theo AI.
6. User van phai bam xac nhan moi luu.

## Data logic

- AI khong duoc ghi transaction.
- AI khong duoc tao category moi.
- AI output chi duoc chap nhan neu category nam trong taxonomy + app categories.
- Prompt chi gui raw text ngan va local intent summary, khong gui lich su tai chinh.
- Route cap raw text toi da 200 ky tu.

## Tests

- `npm run test:ai-fallback` pass.
- `npm run test:ai-memory` pass.
- `npm run test:ai-chat` pass.
- `npm run test` pass.
- `npm run build` pass.

## Ket qua

Phase 5 da dat deliverable: co AI fallback route/client flow nhung mac dinh khong phat sinh chi phi vi server flag dang false.

## Rui ro con lai

- Chua co quota/credit system, nen chua nen bat server flag production.
- Chua co auth/rate limit rieng cho route AI fallback.
- Chua log usage cost theo user.
- Chua co cache AI fallback.
- Chua co OpenAI provider; hien dung Groq theo env hien co cua project.

## Viec tiep theo

Group 3 Phase 6: AI Cost & Pro Quota.

Can lam truoc khi bat fallback production:

- User quota theo thang.
- Hard cap.
- Usage log.
- Free/Pro gating.
- Rate limit route.

