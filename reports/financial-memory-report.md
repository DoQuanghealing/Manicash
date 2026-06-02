# Financial Memory Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Tong ket Group 2: Memory Intelligence, gom taxonomy, local memory va AI fallback co guardrail.

## Da hoan thanh

- Phase 3: Category Taxonomy.
- Phase 4: Local Memory.
- Phase 5: AI Fallback.

## Files changed

- `src/lib/aiMoneyChat/taxonomy.ts`
- `src/lib/aiMoneyChat/categoryKeywords.ts`
- `src/lib/aiMoneyChat/parser.ts`
- `src/lib/aiMoneyChat/aiFallback.ts`
- `src/lib/aiMoneyChat/clientFallback.ts`
- `src/stores/useAiMoneyMemoryStore.ts`
- `src/app/api/ai-money-chat/parse/route.ts`
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/lib/wipeAllData.ts`
- `tests/ai-money-chat-parser.test.ts`
- `tests/ai-money-memory.test.ts`
- `tests/ai-money-fallback.test.ts`

## User flows

- Parser local xu ly truoc.
- Memory local override neu user da sua truoc do.
- AI fallback chi duoc goi khi local confidence low va memory khong co rule.
- Tat ca ket qua, ke ca AI, deu vao confirmation card truoc khi luu.

## Data logic

- Taxonomy phu het category hien co.
- Unknown item khong tao category moi.
- Memory localStorage key: `manicash-ai-money-memory`.
- AI fallback default disabled bang server flag.
- AI output validate category/type/amount truoc khi dung.

## Tests

- `npm run test:ai-chat` pass.
- `npm run test:ai-memory` pass.
- `npm run test:ai-fallback` pass.
- `npm run test` pass.
- `npm run build` pass.

## Ket qua

Group 2 da hoan thanh ve logic. App da co du 3 lop:

1. Local parser.
2. Local memory.
3. AI fallback guarded.

## Rui ro con lai

- Chua nen bat AI fallback production khi chua co quota.
- Chua co Firebase sync cho memory.
- Chua co admin/setting UI de xem/xoa memory rules.
- Chua co route-level rate limit.

## Viec tiep theo

Group 3 Phase 6: AI Cost & Pro Quota.

