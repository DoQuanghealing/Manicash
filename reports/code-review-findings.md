# Code Review Findings

Status: synthetic test stopped. Phase 2/3 not run. This report is source/UI-flow verification only.

Screenshot note: I could not capture the in-app browser/desktop screenshot from this environment. `agent-browser` is not installed, and the PowerShell desktop capture failed with `The handle is invalid`. I am not attaching a fake screenshot. Routes verified reachable: `/input` 200, `/ledger` 200.

## Part A - Verify 2 Existing Bugs

## BUG #1 - Backdate transaction - [Severity: High] - CONFIRMED

- File: `src/components/ui/TransactionInput.tsx:25`, `src/components/ui/TransactionInput.tsx:65`, `src/stores/useFinanceStore.ts:172`
- UI result: `TransactionInput` state/render has type, amount, category, note, wallet, submit. I found no `transactionDate`, `selectedDate`, date picker, or "Ngay giao dich" field in the input flow.
- Store result: `addTransaction` does not accept date/dateKey; its type explicitly omits `date`, `time`, `dateLabel`, `dateKey`, then hardcodes `new Date()`.
- Impact: users who forgot days cannot record the original transaction date. Ledger/calendar/monthly totals will attach the transaction to today.

Relevant code:

```ts
// src/components/ui/TransactionInput.tsx:65
const txn = addTransaction({
  type,
  amount: numericAmount,
  categoryId: selectedCategory || 'other',
  note: note || categories.find((c) => c.id === selectedCategory)?.name || '',
  wallet,
});
```

```ts
// src/stores/useFinanceStore.ts:172
addTransaction: (txnData) => {
  const now = new Date();
  const txn: Transaction = {
    ...txnData,
    id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: now.toISOString(),
    time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    dateLabel: getDateLabel(now.toISOString()),
    dateKey: getDateKey(now),
  };
```

- Cách verify tiếp: open `/input`, try to log an expense for yesterday. Expected blocker: no date field. If a date UI exists elsewhere, confirm whether it reaches `addTransaction`.
- Suggested fix (chưa làm): add optional transaction date to `addTransaction`, expose a date selector in `TransactionInput`, and recalculate affected month/category snapshots from that transaction date.

## BUG #2 - Delete transaction - [Severity: Medium] - CONFIRMED

- File: `src/app/(app)/ledger/_components/LedgerContent.tsx:168`, `src/stores/useFinanceStore.ts:48`
- UI result: Ledger renders each transaction as a static `.ledger-txn-item`. There is no transaction click handler, edit button, delete button, detail modal, or menu in the transaction row.
- Store result: `FinanceState` exposes `addTransaction`, filters, bill actions, snapshots. It does not expose `deleteTransaction`, `updateTransaction`, or rollback logic.
- Impact: wrong entries cannot be corrected. If a future UI deletes from array directly, balances/category spent/snapshots will likely drift unless rollback is centralized.

Relevant code:

```tsx
// src/app/(app)/ledger/_components/LedgerContent.tsx:168
{txns.map((txn) => {
  const cat = getCategory(txn.categoryId);
  return (
    <div key={txn.id} className="ledger-txn-item" id={`txn-${txn.id}`}>
      ...
    </div>
  );
})}
```

- Cách verify tiếp: open `/ledger`, click a transaction row. Expected blocker: no edit/delete UI appears.
- Suggested fix (chưa làm): add store-level update/delete transaction actions that atomically rollback balances, category budgets, monthly snapshots, and any split/contribution side effects.

## Part B - New Findings From Code Review

## FINDING #1 - [Severity: High]

- File: `src/stores/useFinanceStore.ts:306`
- Vấn đề: `payBill` can mark a bill paid even when `billFundBalance < bill.amount`; it clamps the fund to `0` instead of rejecting the payment.
- Giả thiết tại sao là bug: UI disables payment when underfunded, but store actions should still enforce invariants. Any direct call, future automation, or race can mark a bill as paid without enough money.
- Cách verify: call `useFinanceStore.getState().payBill(billId)` with bill fund below the bill amount; check `isPaid === true` and `billFundBalance === 0`.
- Suggested fix (chưa làm): move the guard into the store: if fund is insufficient, return an error/no-op and do not mark paid.

## FINDING #2 - [Severity: High]

- File: `src/stores/useFinanceStore.ts:193`
- Vấn đề: `addTransaction` supports `wallet: 'bill-fund'` in the type, but expense transactions from `bill-fund` do not reduce `billFundBalance`.
- Giả thiết tại sao là bug: income to `bill-fund` is handled, but expense from `bill-fund` is ignored. This can record an expense without affecting any balance.
- Cách verify: call `addTransaction({ type: 'expense', wallet: 'bill-fund', amount: 100000, ... })`; transaction appears, bill fund balance does not decrease.
- Suggested fix (chưa làm): either disallow bill-fund expense transactions at the type/UI boundary, or handle them by deducting `billFundBalance`.

## FINDING #3 - [Severity: High]

- File: `src/stores/useDashboardStore.ts:355`
- Vấn đề: `splitFunds` mutates `FinanceStore.mainBalance` and `billFundBalance` directly with `useFinanceStore.setState`, but does not create any transaction/transfer/audit record.
- Giả thiết tại sao là bug: balances change but Ledger and `transactions` do not explain why. This makes reconciliation hard and makes future rollback/delete/report logic fragile.
- Cách verify: perform a split from the income flow, then open Ledger. Balance changes should be visible, but no transfer/split entry exists to explain the deduction.
- Suggested fix (chưa làm): create a dedicated split ledger record or transfer transaction type, then have overview/report math read from that single source.

## FINDING #4 - [Severity: Medium]

- File: `src/stores/useDashboardStore.ts:316`
- Vấn đề: `addFundContribution` always uses current wall-clock month and `new Date()`, not the transaction/split date.
- Giả thiết tại sao là bug: after backdate support is added, a backdated income split would still show savings in the current month/week, not the month/week of the original transaction.
- Cách verify: after adding backdate support, split an old income date; inspect `monthlyContributions[fund]`.
- Suggested fix (chưa làm): pass an explicit `occurredAt`/`month` into split/contribution actions.

## FINDING #5 - [Severity: Medium]

- File: `src/stores/useFinanceStore.ts:321`
- Vấn đề: `addToBillFund` can overdraw `mainBalance`; it blindly subtracts the transfer amount from main.
- Giả thiết tại sao là bug: users can move more than available into bill fund if UI or future flow fails to guard. That creates negative main balance without an explicit debt/overdraft concept.
- Cách verify: call `addToBillFund(mainBalance + 1)` and inspect `mainBalance`.
- Suggested fix (chưa làm): enforce max transfer in store, or model overdraft explicitly if negative balances are intentional.

## FINDING #6 - [Severity: Medium]

- File: `src/stores/useFinanceStore.ts:234`
- Vấn đề: `getMonthlyIncome` and `getMonthlyExpense` are hardwired to the current wall-clock month.
- Giả thiết tại sao là bug: overview can show current month only; historical comparison/snapshot rebuild cannot ask the store for another month. This is risky for charts, retrospective, and backdate recalculation.
- Cách verify: add old-month transactions, then try to compute that month via store API. There is no parameterized monthly getter.
- Suggested fix (chưa làm): add `getIncomeForMonth(month)` / `getExpenseForMonth(month)` helpers and have overview/charts use explicit month keys.

## FINDING #7 - [Severity: Low]

- File: `src/stores/useDashboardStore.ts:298`
- Vấn đề: legacy `splitIncome` updates only DashboardStore accounts. It does not update FinanceStore, bill fund, or `monthlyContributions`.
- Giả thiết tại sao là bug: no current usage was found, but it remains a public action. If reused later, it will diverge from the newer `splitFunds` path.
- Cách verify: call `splitIncome({ reserve: 100000 })`; dashboard reserve changes but contributions/chart and FinanceStore do not.
- Suggested fix (chưa làm): remove/deprecate the action or make it delegate to the same canonical split path.

## FINDING #8 - [Severity: Low]

- File: `src/lib/accountOverviewMath.ts:21`
- Vấn đề: safe-to-spend status thresholds are hardcoded: `<= 0` danger, `<= 1,000,000` low, else safe.
- Giả thiết tại sao là bug: a 1,000,000 VND buffer may be safe for Tuấn but low for Hương/Minh. This can mislabel risk across personas/income levels.
- Cách verify: compare the same 1,200,000 buffer for a 5M/month and 35M/month user.
- Suggested fix (chưa làm): make status threshold configurable or percentage-based against spending limit/fixed bills.

## Part C - Suggested Fix Order

1. Blocker before real user testing: BUG #1 backdate missing. This directly breaks realistic usage for forgetful users.
2. Blocker before serious ledger use: BUG #2 transaction edit/delete missing. Users need correction paths before trusting balances.
3. High priority: FINDING #1 and #2, because store actions can violate balances even if current UI hides the path.
4. High priority: FINDING #3, because split money changes balances without ledger/audit history.
5. Medium priority: FINDING #4 and #6 before building historical charts/month comparisons further.
6. Nice-to-have/backlog: FINDING #5, #7, #8 unless the current UI exposes those paths heavily.
