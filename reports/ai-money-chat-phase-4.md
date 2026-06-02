# AI Money Chat Phase 4 Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Them local memory de ManiCash hoc tu cach nguoi dung sua category trong chat, uu tien memory truoc khi can AI.

## Da hoan thanh

- Them persisted store `useAiMoneyMemoryStore`.
- Local memory luu vao `localStorage` key `manicash-ai-money-memory`.
- Them memory rule model:
  - keyword
  - normalizedKeyword
  - categoryId
  - type
  - confidence
  - source
  - hitCount
  - createdAt
  - lastUsedAt
- Chat apply memory sau local parser.
- Neu memory match:
  - intent source thanh `memory`
  - category override theo rule da hoc
  - parser category cu thanh alternative
  - confidence tang theo rule confidence
- Khi user sua category va bam xac nhan, app ghi memory correction.
- Memory tang `hitCount` va confidence khi nguoi dung lap lai correction.
- Memory reject category ID la, khong cho tao category moi.
- Wipe all data se clear memory store va localStorage key.
- UI chat hien so rule memory da hoc.

## Files changed

- `src/stores/useAiMoneyMemoryStore.ts`
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`
- `src/lib/wipeAllData.ts`
- `tests/ai-money-memory.test.ts`
- `package.json`
- `docs/AI_MONEY_CHAT_ROADMAP.md`
- `reports/ai-money-chat-phase-4.md`

## User flows

Flow memory:

1. User nhap `mua bai tarot 250k`.
2. Parser goi y `entertain`.
3. User sua category thanh `shopping`.
4. User bam xac nhan.
5. App luu memory rule cho keyword `bai tarot`.
6. Lan sau user nhap `mua bai tarot 300k`, memory uu tien `shopping`.

## Data logic

- Memory chay local-only, khong goi Firebase.
- Memory chi luu khi user xac nhan category khac voi category parser/memory ban dau.
- Confidence ban dau: `0.72`.
- Moi lan lap lai correction tang confidence toi da `1`.
- Tu confidence `0.86` tro len, intent duoc xem la high confidence.
- Max rules: 200.

## Tests

- `npm run test:ai-memory` pass.
- `npm run test:ai-chat` pass.
- `npm run test` pass.
- `npm run build` pass.

## Ket qua

Phase 4 da dat deliverable: app co local memory co the hoc tu user correction va ap dung vao parse sau.

## Rui ro con lai

- Keyword extraction con don gian, chua co NLP tach merchant/item sau.
- Memory hien chi luu localStorage, chua sync Firebase.
- Chua co UI quan ly/xoa tung rule memory.
- Chua ghi item/tag vao transaction.
- Chua co AI fallback khi parser va memory deu yeu.

## Viec tiep theo

Phase 5: AI Fallback.

Can lam:

- Chi goi AI khi local parser + memory confidence thap.
- AI tra JSON schema nghiem ngat.
- Validate output truoc khi hien confirmation.
- Them quota guardrail truoc khi mo rong Pro usage.

