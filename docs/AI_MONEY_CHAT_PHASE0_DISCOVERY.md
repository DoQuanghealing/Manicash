# AI Money Chat Phase 0 Discovery

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Scope

Phase 0 creates a safe foundation only:

- Discover current finance write paths.
- Add a beta `/chat` route that does not mutate user money data yet.
- Define the intermediate `ParsedMoneyIntent` contract for Phase 1 parser and Phase 2 confirmation.
- Add a public feature flag so production can keep the beta disabled until ready.

## Current finance write paths

### Legacy UI store

Main transaction creation currently goes through:

- `src/stores/useFinanceStore.ts`
- action: `addTransaction(...)`

Required input shape:

```ts
{
  transactionDate?: Date;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  categoryId: string;
  note: string;
  wallet: 'main' | 'emergency' | 'bill-fund';
}
```

Side effects inside `addTransaction`:

- Updates legacy transaction list.
- Updates legacy balances.
- Calls `useAuthStore.getState().updateStreak()` for income/expense.
- Calls `useBudgetStore.getState().addSpending(...)` for expenses.
- Updates old monthly snapshots for valid backdated transactions.

### Finance core ledger

The newer ledger layer is:

- `src/stores/useFinanceCoreStore.ts`
- action: `execute(event)`
- event factories/types in `src/core/finance/*`

Current manual input mirrors income/expense into finance core from:

- `src/components/ui/TransactionInput.tsx`

Mapping today:

- Income -> `CREATE_INCOME`, target account `main_bank`.
- Expense -> `CREATE_EXPENSE`, source account `main_bank`.
- Category and legacy transaction id are stored in metadata.

Important: current code writes legacy store first, then tries finance core. This is not atomic yet.

## Category sources

Expense categories:

- `src/data/categories.ts`
- `EXPENSE_CATEGORIES`

Income categories:

- `src/data/categories.ts`
- `INCOME_CATEGORIES`

Current expense IDs include:

- `food`
- `coffee`
- `groceries`
- `transport`
- `clothing`
- `cosmetics`
- `shopping`
- `entertain`
- `health`
- `education`
- `bills`
- `rent`
- `gift`
- `pet`
- `other`

Current income IDs include:

- `salary`
- `freelance`
- `business`
- `investment`
- `bonus`
- `gift-in`
- `other-in`

## Phase 0 implementation

Added files:

- `src/lib/aiMoneyChat/types.ts`
- `src/lib/aiMoneyChat/featureFlag.ts`
- `src/app/(app)/chat/page.tsx`
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`

Feature flag:

```text
NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true
```

Behavior:

- In development, `/chat` is enabled by default.
- In production, `/chat` is disabled unless `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true`.
- No bottom nav link is added in Phase 0, so existing UI navigation is unchanged.
- The beta input is disabled functionally until parser/confirmation is implemented.

## ParsedMoneyIntent contract

`ParsedMoneyIntent` is the intermediate object between chat text and real finance writes.

It is designed to map into both:

- legacy `useFinanceStore.addTransaction`
- core `FinanceEvent`

Key fields:

- `kind`: transaction, fund transfer, earning task, goal update, unknown.
- `type`: income, expense, transfer.
- `amount`: normalized VND amount.
- `category`: category id plus alternatives.
- `accountMapping`: legacy wallet plus optional finance core account ids/event type.
- `confidence`: high, medium, low.
- `needsConfirmation`: must be true unless confidence is high and product explicitly allows auto-save.

## Phase 1 next steps

Build local parser:

- `parseMoneyText(input: string): ParsedMoneyIntent`
- Parse VND patterns: `50k`, `1tr3`, `1300k`, `2.500.000`, `20tr`.
- Detect intent: income, expense, transfer/split.
- Detect category from seed keywords.
- Return confidence and reasons.
- Add tests before connecting to UI save flow.

## Safety notes

- Do not call AI in Phase 1.
- Do not write to Firebase directly from chat.
- Do not auto-create categories from unknown words.
- Do not add `/chat` to bottom nav until the confirmation flow works.
- Keep all AI/API secrets out of `NEXT_PUBLIC_*`.

