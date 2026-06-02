# AI Money Chat Phase 0 Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Tao nen mong an toan cho AI Money Chat truoc khi viet parser va luu giao dich that.

## Da hoan thanh

- Doc lai roadmap trong `docs/AI_MONEY_CHAT_ROADMAP.md`.
- Kiem tra write path hien tai cua giao dich.
- Xac dinh `useFinanceStore.addTransaction` la duong ghi legacy chinh.
- Xac dinh `useFinanceCoreStore.execute` la duong mirror sang finance core.
- Tao contract `ParsedMoneyIntent`.
- Tao feature flag `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED`.
- Tao route beta `/chat` chua mutate data.
- Tao discovery doc cho Phase 0.

## Files changed

- `docs/AI_MONEY_CHAT_PHASE0_DISCOVERY.md`
- `reports/ai-money-chat-phase-0.md`
- `src/lib/aiMoneyChat/types.ts`
- `src/lib/aiMoneyChat/featureFlag.ts`
- `src/app/(app)/chat/page.tsx`
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`

## User flows

- User co the mo `/chat`.
- Trong development, beta hien san.
- Trong production, beta bi khoa neu chua set `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true`.
- Chat input hien preview UX nhung chua gui/luu giao dich.

## Data logic

- Chua ghi transaction.
- Chua goi AI.
- Chua dung Firebase.
- Schema trung gian da du de map sang legacy store va finance core sau nay.

## Tests

- `npm run build` pass.
- `npm run test` pass.

## Ket qua

Phase 0 da tao du nen de sang Phase 1 viet local parser ma khong pha UI hien tai. Next.js da nhan route `/chat` trong production build.

## Rui ro con lai

- Legacy store va finance core hien chua atomic.
- Can quyet dinh sau nay chat confirmation se goi helper chung hay tach function tu `TransactionInput`.
- Chua co nav vao `/chat`, nen beta can mo bang URL truc tiep.

## Viec tiep theo

Phase 1: tao local parser `parseMoneyText(input)` va test bo cau tieng Viet sinh hoat.
