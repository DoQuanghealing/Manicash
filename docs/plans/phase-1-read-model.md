# Phase 1 — New Read Model + Migration Helper

| Field | Value |
|-------|-------|
| Status | **Approved** (leadership sign-off 2026-05-19, rev 1) |
| Parent ADR | [docs/adr/0001-three-account-model.md](../adr/0001-three-account-model.md) |
| Duration | 2 tuần |
| Scope | Data/read model + tests + feature flags. **Không** redesign UI lớn. |
| Out-of-scope | Overview UI (Phase 2), Allocation modal (Phase 3), Bill UI move (Phase 4) |
| Rev 1 changes | (a) Rejected auto-route 70/30 cho production user. (b) Migration helper = pure plan only, no auto-apply. (c) Suggestion-only mode với confidence + reason. (d) 10 acceptance criteria bổ sung từ leadership. |

---

## 1. Mục tiêu & success criteria

### 1.1 Mục tiêu

Tạo **read model mới** cho 3 tài khoản (Income / Spending / Saving) sao cho:
- UI có thể consume một API duy nhất thay vì lắp ráp từ 4 stores.
- Mọi balance đọc từ FinanceCore ledger (single source of truth).
- Migration legacy → core idempotent, có rollback.
- Domain event adapter cho phép code business logic dễ đọc.
- Feature flag gate tất cả thay đổi.

### 1.2 Success criteria (gate vào Phase 2)

- [ ] Tất cả 11 selectors pass unit test (xem §9).
- [ ] Migration helper chạy 0 mismatch trên 10 sample fixtures (xem §10.5).
- [ ] Domain adapter ↔ engine adapter pass round-trip test.
- [ ] `npm run lint` clean.
- [ ] Feature flags merged, default `false`. Khi bật `NEW_THREE_ACCOUNT_MODEL=true` ở dev, dashboard hiển thị balance core (đã có sẵn, chỉ verify).
- [ ] 0 breaking change cho UI hiện tại (test bằng cách load app với flag off → behavior identical).
- [ ] Engineering lead review.

---

## 2. Sequencing (thứ tự work)

```
  W1                                              W2
  ├─ Feature flag setup (D1)                      ├─ Domain adapter (D6-7)
  ├─ Account rename + roles (D1-2)                ├─ Migration helper (D7-9)
  ├─ Read model selectors (D2-4)                  ├─ Wiring dual-read (D9)
  ├─ Safe-to-Spend refactor (D4-5)                ├─ Test sweep (D9-10)
  ├─ Tests for selectors (D5)                     ├─ Acceptance review (D10)
```

**Critical path**: Feature flag → Account rename → Selectors → Domain adapter → Migration. Không làm gì khác trước feature flag.

---

## 3. Feature flag setup (Day 1, blocking)

### 3.1 File mới: `src/lib/featureFlags.ts`

```typescript
// src/lib/featureFlags.ts (NEW)
export const FLAGS = {
  /** Phase 1 gate — bật read model mới, migration helper. UI vẫn cũ. */
  NEW_THREE_ACCOUNT_MODEL: process.env.NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL === 'true',
  /** Phase 2 gate — bật Overview UI mới (4 chỉ số). */
  NEW_OVERVIEW_UI: process.env.NEXT_PUBLIC_ENABLE_NEW_OVERVIEW === 'true',
  /** Phase 3 gate — bật allocation modal. */
  NEW_ALLOCATION_FLOW: process.env.NEXT_PUBLIC_ENABLE_ALLOCATION_FLOW === 'true',
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] === true;
}
```

### 3.2 Vị trí check flag

| File | Hành vi khi flag OFF | Hành vi khi flag ON |
|------|----------------------|---------------------|
| `useAccountOverviewStore.ts` | Đọc legacy như hiện tại | Đọc từ new selectors |
| `useFinanceStore.payBill()` | Trừ `billFundBalance` (cũ) | Trừ `SPENDING_ACCOUNT` (mới) — *thực tế Phase 4 mới flip, Phase 1 chỉ chuẩn bị code path* |
| Onboarding | Skip migration prompt | Hiện migration prompt nếu chưa migrate |

### 3.3 ENV setup

```bash
# .env.local — dev mặc định bật để test
NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL=true

# .env.production — mặc định tắt cho release
# NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL=false  (commented out = off)
```

### 3.4 Test

```typescript
// tests/feature-flags.test.ts (NEW)
// Verify FLAGS object reflects env, default false when env unset.
```

**Acceptance**: `isFeatureEnabled('NEW_THREE_ACCOUNT_MODEL')` returns `false` when env unset; `true` when env="true"; `false` for any other value (e.g. "1", "yes").

---

## 4. Account rename + role mapping (Day 1-2)

### 4.1 Files thay đổi

#### `src/core/finance/accounts.ts` — Rename với backward-compat alias

```typescript
// ADD new IDs:
export const INCOME_ACCOUNT_ID = 'income_account';
export const RESERVE_FUND_ACCOUNT_ID = 'reserve_fund';

// KEEP old exports as aliases (deprecate in Phase 5):
/** @deprecated Use INCOME_ACCOUNT_ID. Removed in Phase 5. */
export const MAIN_BANK_ACCOUNT_ID = INCOME_ACCOUNT_ID;
/** @deprecated Use RESERVE_FUND_ACCOUNT_ID. Removed in Phase 5. */
export const EMERGENCY_FUND_ACCOUNT_ID = RESERVE_FUND_ACCOUNT_ID;

// Update DEFAULT_FINANCE_ACCOUNTS array entries:
//   { id: INCOME_ACCOUNT_ID, name: 'Tài khoản thu nhập', kind: 'asset' }
//   { id: RESERVE_FUND_ACCOUNT_ID, name: 'Dự phòng', kind: 'asset' }
//   (giữ BILL_FUND_ACCOUNT_ID 1 thời gian — Phase 4 sẽ remove khỏi DEFAULT_FINANCE_ACCOUNTS)
```

**Critical**: Giá trị string của `INCOME_ACCOUNT_ID` = `'income_account'` (KHÔNG để = `'main_bank'`). Lý do: ledger entries cũ vẫn dùng `'main_bank'`. Migration helper sẽ map.

> Wait — đây là quyết định khó. 2 options:
> - **A**: New ID `'income_account'`, migration helper rewrite ledger entries cũ.
> - **B**: New name `INCOME_ACCOUNT_ID` nhưng giá trị vẫn = `'main_bank'`.
> 
> **Chọn B cho Phase 1** — ít rủi ro, không phải rewrite ledger entries. Chỉ rename symbol ở code:
> ```typescript
> export const INCOME_ACCOUNT_ID = 'main_bank';  // Logical rename, giá trị giữ
> export const RESERVE_FUND_ACCOUNT_ID = 'emergency_fund';  // Như trên
> ```
> Tên ID kỹ thuật ('main_bank') chỉ là internal, user không thấy. Phase 5 có thể migrate sang `'income_account'` nếu muốn cleanup.

#### `src/core/finance/accountRoles.ts` (NEW)

```typescript
import {
  INCOME_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  GOAL_FUND_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  BILL_FUND_ACCOUNT_ID,
} from './accounts';
import type { AccountId } from './types';

export type AccountRole = 'income' | 'spending' | 'saving';
export type SavingBucket = 'reserve' | 'goals' | 'investment';

export const ROLE_TO_ACCOUNT_IDS: Record<AccountRole, readonly AccountId[]> = {
  income: [INCOME_ACCOUNT_ID],
  // BILL_FUND tạm thời vẫn trong spending role để Phase 1 không phá payBill cũ.
  // Phase 4 sẽ remove BILL_FUND khỏi role 'spending'.
  spending: [SPENDING_ACCOUNT_ID, BILL_FUND_ACCOUNT_ID],
  saving: [RESERVE_FUND_ACCOUNT_ID, GOAL_FUND_ACCOUNT_ID, INVESTMENT_FUND_ACCOUNT_ID],
} as const;

export const SAVING_BUCKET_TO_ACCOUNT_ID: Record<SavingBucket, AccountId> = {
  reserve: RESERVE_FUND_ACCOUNT_ID,
  goals: GOAL_FUND_ACCOUNT_ID,
  investment: INVESTMENT_FUND_ACCOUNT_ID,
} as const;

export function getAccountIdsForRole(role: AccountRole): readonly AccountId[] {
  return ROLE_TO_ACCOUNT_IDS[role];
}

export function getAccountIdForSavingBucket(bucket: SavingBucket): AccountId {
  return SAVING_BUCKET_TO_ACCOUNT_ID[bucket];
}
```

### 4.2 Tests

```typescript
// tests/account-roles.test.ts (NEW)
test('income role maps to INCOME_ACCOUNT_ID only')
test('spending role contains SPENDING + BILL_FUND in Phase 1')
test('saving role contains 3 sub-buckets in correct order')
test('SAVING_BUCKET_TO_ACCOUNT_ID has all 3 keys')
```

---

## 5. Read model selectors (Day 2-5)

### 5.1 File mới: `src/core/finance/threeAccountSelectors.ts`

11 selectors with exact contracts. All take `LedgerEntry[]` + auxiliary inputs as needed (pure functions).

```typescript
import type { LedgerEntry } from './types';
import { getAccountBalance } from './selectors';
import {
  INCOME_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  GOAL_FUND_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  BILL_FUND_ACCOUNT_ID,
} from './accounts';

/** SELECTOR 1: Số dư Tài khoản thu nhập. */
export function getIncomeBalance(ledger: LedgerEntry[]): number {
  return getAccountBalance(ledger, INCOME_ACCOUNT_ID);
}

/** SELECTOR 2: Số dư Tài khoản chi tiêu (gộp SPENDING + BILL_FUND legacy trong Phase 1). */
export function getSpendingBalance(ledger: LedgerEntry[]): number {
  return (
    getAccountBalance(ledger, SPENDING_ACCOUNT_ID) +
    getAccountBalance(ledger, BILL_FUND_ACCOUNT_ID)
  );
}

/** SELECTOR 3: Tổng Tài khoản tiết kiệm. */
export function getSavingBalance(ledger: LedgerEntry[]): number {
  return (
    getAccountBalance(ledger, RESERVE_FUND_ACCOUNT_ID) +
    getAccountBalance(ledger, GOAL_FUND_ACCOUNT_ID) +
    getAccountBalance(ledger, INVESTMENT_FUND_ACCOUNT_ID)
  );
}

/** SELECTOR 4: Breakdown tiết kiệm theo 3 sub-buckets. */
export interface SavingBreakdown {
  reserve: number;
  goals: number;
  investment: number;
  total: number;
}
export function getSavingBreakdown(ledger: LedgerEntry[]): SavingBreakdown {
  const reserve = getAccountBalance(ledger, RESERVE_FUND_ACCOUNT_ID);
  const goals = getAccountBalance(ledger, GOAL_FUND_ACCOUNT_ID);
  const investment = getAccountBalance(ledger, INVESTMENT_FUND_ACCOUNT_ID);
  return { reserve, goals, investment, total: reserve + goals + investment };
}

/** SELECTOR 5: Ngân sách tháng = limit chi tiêu hằng ngày + tổng bills cố định. */
export interface MonthlyBudgetInputs {
  dailySpendingLimit: number;     // từ useBudgetStore.getTotalCategoryLimits()
  fixedBillsTotal: number;        // từ useFinanceStore.getTotalFixedBillsAmount()
}
export function getMonthlyBudget(inputs: MonthlyBudgetInputs): number {
  return inputs.dailySpendingLimit + inputs.fixedBillsTotal;
}

/** SELECTOR 6: Đã chi hằng ngày trong tháng (không tính bill). */
export interface DailyBudgetUsedInputs {
  ledger: LedgerEntry[];
  monthKey: string;               // 'YYYY-MM'
}
export function getDailyBudgetUsed(inputs: DailyBudgetUsedInputs): number {
  return inputs.ledger
    .filter(e =>
      e.eventType === 'CREATE_EXPENSE' &&
      e.direction === 'debit' &&
      e.accountId === SPENDING_ACCOUNT_ID &&
      monthKeyOf(e.occurredAt) === inputs.monthKey &&
      e.metadata?.isBill !== true
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

/** SELECTOR 7: Đã trả bill trong tháng. */
export function getBillBudgetUsed(inputs: DailyBudgetUsedInputs): number {
  return inputs.ledger
    .filter(e =>
      e.eventType === 'CREATE_EXPENSE' &&
      e.direction === 'debit' &&
      e.accountId === SPENDING_ACCOUNT_ID &&
      monthKeyOf(e.occurredAt) === inputs.monthKey &&
      e.metadata?.isBill === true
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

/** SELECTOR 8: Bill chưa trả trong tháng hiện tại. */
export interface UnpaidBillsInputs {
  fixedBills: { id: string; amount: number; dueDay: number; isPaid: boolean }[];
}
export function getUnpaidBills(inputs: UnpaidBillsInputs) {
  return inputs.fixedBills.filter(b => !b.isPaid);
}

/** SELECTOR 9: Bill quá hạn (chưa trả + dueDay < today). */
export interface OverdueBillsInputs extends UnpaidBillsInputs {
  today: number;                  // day of month (1-31)
}
export function getOverdueBills(inputs: OverdueBillsInputs) {
  return inputs.fixedBills.filter(b => !b.isPaid && b.dueDay < inputs.today);
}

/** SELECTOR 10: Safe-to-Spend (planning metric). */
export interface SafeToSpendInputs {
  monthlyIncome: number;
  carryOver: number;
  dailySpendingLimit: number;
  fixedBillsTotal: number;
  monthlySavingsTarget: number;
}
export function getSafeToSpend(inputs: SafeToSpendInputs): number {
  return (
    inputs.monthlyIncome +
    inputs.carryOver -
    inputs.dailySpendingLimit -
    inputs.fixedBillsTotal -
    inputs.monthlySavingsTarget
  );
}

/** SELECTOR 11: Safe-to-Spend status (3 mức theo ADR §4.3). */
export type SafeToSpendStatusV2 = 'safe' | 'low' | 'negative';
export function getSafeToSpendStatusV2(amount: number): SafeToSpendStatusV2 {
  if (amount < 0) return 'negative';
  if (amount <= 1_000_000) return 'low';
  return 'safe';
}

// ── Helper ──
function monthKeyOf(isoDate: string): string {
  // YYYY-MM from ISO — UTC consistent với dateHelpers
  return isoDate.slice(0, 7);
}
```

### 5.2 Aggregated snapshot helper

```typescript
// src/core/finance/threeAccountSnapshot.ts (NEW)
export interface ThreeAccountSnapshot {
  income: { balance: number };
  spending: {
    balance: number;
    monthlyBudget: number;
    dailyBudgetUsed: number;
    billBudgetUsed: number;
    unpaidBills: FixedBillView[];
    overdueBills: FixedBillView[];
  };
  saving: {
    balance: number;
    breakdown: SavingBreakdown;
  };
  safeToSpend: {
    amount: number;
    status: SafeToSpendStatusV2;
    inputs: SafeToSpendInputs;     // expose for debug/UI
  };
}

export function buildThreeAccountSnapshot(args: {
  ledger: LedgerEntry[];
  monthKey: string;
  today: number;
  fixedBills: FixedBill[];
  dailySpendingLimit: number;
  carryOver: number;
  monthlySavingsTarget: number;
  monthlyIncome: number;
}): ThreeAccountSnapshot { ... }
```

### 5.3 Tests cho selectors

```typescript
// tests/three-account-selectors.test.ts (NEW)
describe('getIncomeBalance')
  - empty ledger → 0
  - after CREATE_INCOME 5M → 5M
  - after CREATE_INCOME 5M + TRANSFER 3M out → 2M

describe('getSpendingBalance')
  - includes BILL_FUND in Phase 1
  - after TRANSFER income→spending 3M → 3M
  - after CREATE_EXPENSE 500k → 2.5M

describe('getSavingBalance')
  - sum of 3 sub-buckets
  - 0 when empty

describe('getSavingBreakdown')
  - returns { reserve, goals, investment, total }
  - total matches getSavingBalance

describe('getMonthlyBudget')
  - daily 10M + bills 5M → 15M
  - 0 + 0 → 0

describe('getDailyBudgetUsed')
  - filters out isBill=true entries
  - filters by monthKey
  - 0 for current month if no expenses

describe('getBillBudgetUsed')
  - only entries with isBill=true
  - separate from daily

describe('getUnpaidBills')
  - returns only !isPaid
  - returns empty array when all paid

describe('getOverdueBills')
  - dueDay < today + !isPaid
  - empty when all paid
  - boundary: dueDay === today → NOT overdue

describe('getSafeToSpend')
  - positive case: 19M + 800k - 9.8M - 5.15M - 1.7M = 3.15M
  - zero case: balanced inputs
  - negative case: budget > income

describe('getSafeToSpendStatusV2')
  - 1_500_000 → 'safe'
  - 1_000_000 → 'low'
  - 500_000 → 'low'
  - 0 → 'low' (boundary: 0 ≤ 1M)
  - -1 → 'negative'
  - -500_000 → 'negative'
```

---

## 6. Domain event adapter (Day 6-7)

### 6.1 File mới: `src/core/finance/domainEvents.ts`

Type definitions theo ADR §3.1:

```typescript
export type DomainEventType =
  | 'INCOME_RECEIVED'
  | 'ALLOCATE_TO_SPENDING'
  | 'ALLOCATE_TO_SAVING'
  | 'PAY_EXPENSE'
  | 'PAY_BILL'
  | 'MONTHLY_ROLLOVER'
  | 'REALLOCATE'
  | 'ADJUSTMENT'
  | 'REFUND';

export interface DomainEventBase {
  id: string;
  type: DomainEventType;
  amount: number;
  occurredAt: string;
  reason?: string;
  audit?: {
    actor: 'user' | 'system' | 'migration';
    sourceUI?: string;
    relatedEventId?: string;
  };
}

export interface IncomeReceivedEvent extends DomainEventBase {
  type: 'INCOME_RECEIVED';
  incomeKind: string;
  categoryId: string;
}

export interface AllocateToSpendingEvent extends DomainEventBase {
  type: 'ALLOCATE_TO_SPENDING';
  monthKey: string;
  allocationSessionId: string;
}

export interface AllocateToSavingEvent extends DomainEventBase {
  type: 'ALLOCATE_TO_SAVING';
  monthKey: string;
  allocationSessionId: string;
  buckets: { reserve: number; goals: number; investment: number };
  goalId?: string;
}

export interface PayExpenseEvent extends DomainEventBase {
  type: 'PAY_EXPENSE';
  categoryId: string;
}

export interface PayBillEvent extends DomainEventBase {
  type: 'PAY_BILL';
  billId: string;
  dueDay: number;
  paidOnTime: boolean;
}

export interface MonthlyRolloverEvent extends DomainEventBase {
  type: 'MONTHLY_ROLLOVER';
  monthKeyFrom: string;
  monthKeyTo: string;
  surplusAmount: number;
  audit: { actor: 'system'; sourceUI: 'rollover-job' };
}

export interface ReallocateEvent extends DomainEventBase {
  type: 'REALLOCATE';
  sourceAccountId: string;
  targetAccountId: string;
  reason: string;     // bắt buộc
  audit: { actor: 'user' | 'system'; sourceUI: string };
}

export type DomainEvent =
  | IncomeReceivedEvent
  | AllocateToSpendingEvent
  | AllocateToSavingEvent
  | PayExpenseEvent
  | PayBillEvent
  | MonthlyRolloverEvent
  | ReallocateEvent
  | (DomainEventBase & { type: 'ADJUSTMENT' | 'REFUND' });
```

### 6.2 File mới: `src/core/finance/domainAdapter.ts`

```typescript
import type { DomainEvent, AllocateToSavingEvent, ... } from './domainEvents';
import type { FinanceEvent } from './types';
import {
  INCOME_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
  BILL_FUND_ACCOUNT_ID,         // legacy — Phase 1 vẫn dùng
  INCOME_CLEARING_ACCOUNT_ID,
  EXPENSE_CLEARING_ACCOUNT_ID,
} from './accounts';
import { getAccountIdForSavingBucket } from './accountRoles';

/** Convert 1 domain event → 1 hoặc nhiều engine events. */
export function toEngineEvents(domain: DomainEvent): FinanceEvent[] {
  switch (domain.type) {
    case 'INCOME_RECEIVED':
      return [{
        id: `${domain.id}-engine`,
        type: 'CREATE_INCOME',
        amount: domain.amount,
        occurredAt: domain.occurredAt,
        targetAccountId: INCOME_ACCOUNT_ID,
        metadata: {
          domainEventId: domain.id,
          incomeKind: domain.incomeKind,
          categoryId: domain.categoryId,
        },
      }];

    case 'ALLOCATE_TO_SPENDING':
      return [{
        id: `${domain.id}-engine`,
        type: 'TRANSFER_MONEY',
        amount: domain.amount,
        occurredAt: domain.occurredAt,
        sourceAccountId: INCOME_ACCOUNT_ID,
        targetAccountId: SPENDING_ACCOUNT_ID,
        metadata: {
          domainEventId: domain.id,
          monthKey: domain.monthKey,
          allocationSessionId: domain.allocationSessionId,
        },
      }];

    case 'ALLOCATE_TO_SAVING':
      return ['reserve', 'goals', 'investment']
        .filter(b => domain.buckets[b] > 0)
        .map((bucket, idx) => ({
          id: `${domain.id}-engine-${bucket}`,
          type: 'TRANSFER_MONEY' as const,
          amount: domain.buckets[bucket],
          occurredAt: domain.occurredAt,
          sourceAccountId: INCOME_ACCOUNT_ID,
          targetAccountId: getAccountIdForSavingBucket(bucket as any),
          metadata: {
            domainEventId: domain.id,
            monthKey: domain.monthKey,
            allocationSessionId: domain.allocationSessionId,
            subBucket: bucket,
            goalId: domain.goalId ?? null,
          },
        }));

    case 'PAY_EXPENSE':
      return [{
        id: `${domain.id}-engine`,
        type: 'CREATE_EXPENSE',
        amount: domain.amount,
        occurredAt: domain.occurredAt,
        sourceAccountId: SPENDING_ACCOUNT_ID,
        metadata: {
          domainEventId: domain.id,
          categoryId: domain.categoryId,
          isBill: false,
        },
      }];

    case 'PAY_BILL':
      return [{
        id: `${domain.id}-engine`,
        type: 'CREATE_EXPENSE',
        amount: domain.amount,
        occurredAt: domain.occurredAt,
        sourceAccountId: SPENDING_ACCOUNT_ID,
        metadata: {
          domainEventId: domain.id,
          isBill: true,
          billId: domain.billId,
          dueDay: domain.dueDay,
          paidOnTime: domain.paidOnTime,
        },
      }];

    case 'MONTHLY_ROLLOVER':
      if (domain.surplusAmount <= 0) return [];
      return [{
        id: `${domain.id}-engine`,
        type: 'TRANSFER_MONEY',
        amount: domain.surplusAmount,
        occurredAt: domain.occurredAt,
        sourceAccountId: SPENDING_ACCOUNT_ID,
        targetAccountId: INCOME_ACCOUNT_ID,
        metadata: {
          domainEventId: domain.id,
          monthKeyFrom: domain.monthKeyFrom,
          monthKeyTo: domain.monthKeyTo,
          auditActor: domain.audit.actor,
          auditSourceUI: domain.audit.sourceUI,
        },
      }];

    case 'REALLOCATE':
      return [{
        id: `${domain.id}-engine`,
        type: 'TRANSFER_MONEY',
        amount: domain.amount,
        occurredAt: domain.occurredAt,
        sourceAccountId: domain.sourceAccountId,
        targetAccountId: domain.targetAccountId,
        metadata: {
          domainEventId: domain.id,
          auditActor: domain.audit.actor,
          auditSourceUI: domain.audit.sourceUI,
          reason: domain.reason,
        },
      }];

    case 'ADJUSTMENT':
    case 'REFUND':
      // TODO: implement in Phase 4+ when use case appears
      throw new Error(`Domain event ${domain.type} not yet implemented in Phase 1`);
  }
}
```

### 6.3 Tests cho adapter

```typescript
// tests/domain-adapter.test.ts (NEW)
test('INCOME_RECEIVED → 1 CREATE_INCOME with target=INCOME_ACCOUNT')
test('ALLOCATE_TO_SPENDING → 1 TRANSFER from INCOME to SPENDING with monthKey metadata')
test('ALLOCATE_TO_SAVING with all 3 buckets > 0 → 3 TRANSFER events')
test('ALLOCATE_TO_SAVING with reserve=0 → 2 TRANSFER events (skip zero)')
test('ALLOCATE_TO_SAVING preserves allocationSessionId on all engine events')
test('PAY_BILL with paidOnTime=true sets metadata.paidOnTime')
test('MONTHLY_ROLLOVER with surplus=0 → returns []')
test('MONTHLY_ROLLOVER with surplus=1M → 1 TRANSFER SPENDING→INCOME')
test('REALLOCATE requires reason — throws if missing')
test('All domain events propagate id as metadata.domainEventId')
```

---

## 7. Migration helper (Day 7-9)

### 7.1 File mới: `src/core/finance/migrations/legacyToThreeAccount.ts`

```typescript
import type { DomainEvent } from '../domainEvents';
import type { FinanceEvent } from '../types';
import { toEngineEvents } from '../domainAdapter';

export interface LegacyBalanceSnapshot {
  /** From useFinanceStore */
  mainBalance: number;
  billFundBalance: number;
  emergencyBalance: number;
  /** From useDashboardStore */
  reserveBalance: number;
  goalsBalance: number;
  investmentBalance: number;
}

export interface MigrationContext {
  userId: string;
  occurredAt: string;             // ISO timestamp
  /** Routing hint từ heuristic hoặc onboarding modal (ADR §13.2-13.3). */
  mainBalanceRoute: 'income' | 'spending' | 'split-70-30';
  /** Đã migrate trước đó (idempotent guard). */
  existingBatchId?: string;
}

export interface MigrationResult {
  batchId: string;
  domainEvents: DomainEvent[];
  engineEvents: FinanceEvent[];
  warnings: string[];             // ví dụ: "billFundBalance đã có ở ledger, skip"
}

export function planMigration(
  snapshot: LegacyBalanceSnapshot,
  context: MigrationContext,
): MigrationResult {
  const batchId = context.existingBatchId
    ?? `mig-${context.occurredAt.slice(0,10)}-${context.userId}`;

  // ── Idempotent guard ──
  // Caller phải check ledger trước: nếu có entry với migrationBatchId=batchId
  // thì skip toàn bộ migration.

  const domainEvents: DomainEvent[] = [];

  // 1. emergencyBalance → reserve (luôn direct)
  if (snapshot.emergencyBalance > 0) {
    domainEvents.push(buildAdjustmentForReserve(snapshot.emergencyBalance, context, batchId));
  }

  // 2. billFundBalance → spending (luôn direct)
  if (snapshot.billFundBalance > 0) {
    domainEvents.push(buildAdjustmentForSpending(snapshot.billFundBalance, context, batchId, 'bill_fund'));
  }

  // 3. reserveBalance / goalsBalance / investmentBalance → direct (nếu chưa có ở ledger)
  // (Lưu ý: balance dashboard hiện đang đứng riêng với ledger. Migrate cẩn thận.)

  // 4. mainBalance → theo route
  if (snapshot.mainBalance > 0) {
    switch (context.mainBalanceRoute) {
      case 'income':
        domainEvents.push(buildAdjustmentForIncome(snapshot.mainBalance, context, batchId, 'main_balance'));
        break;
      case 'spending':
        domainEvents.push(buildAdjustmentForSpending(snapshot.mainBalance, context, batchId, 'main_balance'));
        break;
      case 'split-70-30':
        domainEvents.push(buildAdjustmentForSpending(
          Math.round(snapshot.mainBalance * 0.7), context, batchId, 'main_balance_70'));
        domainEvents.push(buildAdjustmentForIncome(
          Math.round(snapshot.mainBalance * 0.3), context, batchId, 'main_balance_30'));
        break;
    }
  }

  const engineEvents = domainEvents.flatMap(toEngineEvents);

  return { batchId, domainEvents, engineEvents, warnings: [] };
}

/** Heuristic chọn route mainBalance — Leadership chốt 2026-05-19. */
export interface MainBalanceRouteSuggestion {
  /** Phân bổ đề xuất (tổng phải = mainBalance). */
  income: number;
  spending: number;
  /** 'high' khi user trả bill + có expense gần đây | 'medium' khi 1 dấu hiệu | 'low' khi thiếu data */
  confidence: 'high' | 'medium' | 'low';
  /** Giải thích cho UI hiển thị / log. */
  reason: string;
  /** TRUE → UI phải hiển thị onboarding modal, KHÔNG được auto-apply. */
  requiresUserConfirmation: boolean;
}

export interface SuggestMainBalanceRouteInput {
  mainBalance: number;
  totalCategoryLimits: number;
  totalFixedBills: number;
  recentExpenseCount: number;     // số expense trong 7 ngày
  hasPaidBillThisMonth: boolean;
  /** Demo/seed only flag — production user phải để FALSE. */
  isDemoUser?: boolean;
}

export function suggestMainBalanceRoute(
  input: SuggestMainBalanceRouteInput
): MainBalanceRouteSuggestion {
  // ── DEMO / DEV ONLY: auto-route 70/30 cho trải nghiệm đẹp ──
  // Leadership: không bao giờ trả route 70/30 cho production user.
  const isDevOrDemo =
    input.isDemoUser === true ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');

  if (
    isDevOrDemo &&
    input.hasPaidBillThisMonth &&
    input.mainBalance <= input.totalCategoryLimits + input.totalFixedBills &&
    input.recentExpenseCount >= 3
  ) {
    return {
      income: Math.round(input.mainBalance * 0.3),
      spending: Math.round(input.mainBalance * 0.7),
      confidence: 'high',
      reason: 'Demo/dev only: user has bill history + recent expenses + small main',
      requiresUserConfirmation: false,  // demo/dev path — auto OK
    };
  }

  // ── PRODUCTION DEFAULT: tất cả về Income, BẮT BUỘC confirm ──
  // Lý do: legacy mainBalance ambiguous, không tự chia rủi ro phá trust.
  return {
    income: input.mainBalance,
    spending: 0,
    confidence: 'low',
    reason: 'Legacy mainBalance ambiguous — defaulting to Income; user must confirm allocation',
    requiresUserConfirmation: true,  // production path — Phase 2 wiring sẽ show modal
  };
}
```

> **Quan trọng — leadership chốt rev 1**:
> - `planMigration` là **pure function**, không bao giờ auto-execute với user thật.
> - `suggestMainBalanceRoute` **chỉ trả suggestion**, không apply. Phase 2 wiring sẽ tôn trọng `requiresUserConfirmation`.
> - 70/30 split **chỉ tồn tại** cho demo/dev user. Production luôn default Income với `requiresUserConfirmation: true`.
> - Test phải cover **explicit** trường hợp production không auto-route.

### 7.2 ADJUSTMENT event support (tạm thời cho migration)

Vì `ADJUSTMENT` chưa support đầy đủ trong adapter (xem §6.2 — throw error), Phase 1 sẽ thêm 1 hỗ trợ giới hạn cho migration only:

```typescript
// src/core/finance/migrations/migrationAdapter.ts (NEW)
// Build engine event trực tiếp cho migration, không qua domain adapter
// để tránh phức tạp domain adapter ngay từ Phase 1.

export function buildMigrationCreateIncome(args: {
  amount: number;
  targetAccountId: string;
  batchId: string;
  legacySource: string;
  occurredAt: string;
}): FinanceEvent {
  return {
    id: `mig-${args.batchId}-${args.targetAccountId}-${args.legacySource}`,
    type: 'CREATE_INCOME',
    amount: args.amount,
    occurredAt: args.occurredAt,
    targetAccountId: args.targetAccountId,
    description: `Legacy migration: ${args.legacySource}`,
    metadata: {
      migrationBatchId: args.batchId,
      legacySource: args.legacySource,
      auditActor: 'migration',
      auditSourceUI: 'legacy-to-three-account-v1',
      _migration: true,
    },
  };
}
```

### 7.3 Tests cho migration

```typescript
// tests/migration-legacy-to-three-account.test.ts (NEW)
describe('planMigration')
  - empty snapshot → 0 events
  - only emergency 5M → 1 event, target=RESERVE
  - only billFund 3M → 1 event, target=SPENDING (qua BILL_FUND legacy)
  - only main 10M, route=income → 1 event, target=INCOME
  - only main 10M, route=spending → 1 event, target=SPENDING
  - only main 10M, route=split-70-30 → 2 events (7M spending + 3M income)
  - full snapshot → 5+ events tổng đúng

describe('idempotent guard')
  - same userId + occurredAt → same batchId
  - re-running with existingBatchId → caller should skip (guard ở Phase 2)

describe('suggestMainBalanceRoute heuristic')
  - happy path income (no bill paid, large mainBalance)
  - happy path split (bill paid + small main + recent expenses)
  - edge: exactly at boundary
  - empty inputs → 'income' default

describe('balance reconciliation')
  - apply engineEvents → 3-account balances match snapshot
  - sum(income+spending+saving) === sum(legacy fields)
```

### 7.4 Sample fixtures (10 fixtures cho gate)

| # | Scenario | mainBalance | billFund | emergency | reserve | goals | invest | Expected route | Expected new balances |
|---|----------|------------|----------|-----------|---------|-------|--------|---------------|----------------------|
| 1 | Empty | 0 | 0 | 0 | 0 | 0 | 0 | n/a | 0/0/0 |
| 2 | Only emergency | 0 | 0 | 5M | 0 | 0 | 0 | n/a | 0/0/5M |
| 3 | Only main, income route | 15M | 0 | 0 | 0 | 0 | 0 | income | 15M/0/0 |
| 4 | Only main, spending route | 15M | 0 | 0 | 0 | 0 | 0 | spending | 0/15M/0 |
| 5 | Split route | 15M | 0 | 0 | 0 | 0 | 0 | split-70-30 | 4.5M/10.5M/0 |
| 6 | Full demo seed | 15M | 8.5M | 5M | 3M | 2.5M | 1.2M | income | 15M/8.5M/11.7M |
| 7 | Heavy saver | 5M | 2M | 20M | 30M | 50M | 100M | income | 5M/2M/200M |
| 8 | Bill-heavy | 2M | 10M | 0 | 0 | 0 | 0 | split-70-30 | 0.6M/11.4M/0 |
| 9 | Idempotent rerun | (same as #6, existingBatchId) | | | | | | n/a | no new events |
| 10 | Rounding edge | 1.000.001 | 0 | 0 | 0 | 0 | 0 | split-70-30 | 300k/700k/0 (sum exact) |

**Gate**: tất cả 10 fixtures pass với sum(new balances) === sum(legacy balances) (exact match, no rounding drift > 1đ).

---

## 8. Wiring (Day 9)

### 8.1 useAccountOverviewStore — dual-read mode

```typescript
// src/stores/useAccountOverviewStore.ts (MODIFY)
import { isFeatureEnabled } from '@/lib/featureFlags';
import { buildThreeAccountSnapshot } from '@/core/finance/threeAccountSnapshot';

export function getAccountOverviewSnapshot(): AccountOverviewSnapshot {
  if (isFeatureEnabled('NEW_THREE_ACCOUNT_MODEL')) {
    // NEW PATH — read from threeAccountSnapshot
    return buildLegacyShapeFromThreeAccount({ ... });
  }
  // OLD PATH — unchanged
  return buildAccountOverviewSnapshot({ ... });
}

/** Convert ThreeAccountSnapshot → AccountOverviewSnapshot shape để giữ tương thích UI cũ. */
function buildLegacyShapeFromThreeAccount(args): AccountOverviewSnapshot {
  // Map new selectors → legacy shape
  // Phase 1 chỉ cần đảm bảo UI cũ hiện đúng số khi flag ON
}
```

### 8.2 Side-effect khác trong Phase 1

**KHÔNG đổi** trong Phase 1 (giữ cho phase sau):
- `useFinanceStore.payBill()` — vẫn trừ `billFundBalance` (Phase 4 sẽ flip)
- `useDashboardStore.splitFunds()` — vẫn như cũ (Phase 3 sẽ thay)
- Component nào (Phase 2)

**Tweaks cần thiết** trong Phase 1:
- `warnFinanceMismatchIfNeeded` — tắt warning khi flag ON (tránh false positive trong dual-write window)

---

## 9. Test matrix tổng

| Test file | Scope | Pass criteria |
|-----------|-------|--------------|
| `tests/feature-flags.test.ts` | FLAGS object + isFeatureEnabled | Env mapping đúng |
| `tests/account-roles.test.ts` | ROLE_TO_ACCOUNT_IDS + helpers | Mapping đầy đủ |
| `tests/three-account-selectors.test.ts` | 11 selectors | 30+ test cases pass |
| `tests/domain-adapter.test.ts` | toEngineEvents() | 10+ test cases pass |
| `tests/migration-legacy-to-three-account.test.ts` | planMigration + heuristic | 10 fixtures pass exactly |
| `tests/safe-to-spend.test.ts` | Boundary + status | 6 test cases pass |
| `tests/rollover-domain.test.ts` | MONTHLY_ROLLOVER edge cases | 4 test cases pass |

### 9.1 Test infrastructure

Project đã có 2 test runner script trong [package.json](package.json):
- `npm run test` → `tests/phase1-foundation.test.ts`
- `npm run test:phase2` → `tests/phase2-backdate.test.ts`

**Thêm script mới**:
```json
"test:three-account": "node -e \"...jiti.../tests/three-account-suite.ts\""
```

Tạo `tests/three-account-suite.ts` import tất cả test files của Phase 1 + run sequential.

### 9.2 Test pattern (theo synthetic test framework có sẵn)

Tham khảo `tests/synthetic/*.ts` để theo convention. Mỗi test file export default 1 function returning `{ name, run }[]`.

---

## 10. Acceptance criteria (per deliverable)

### 10.1 Feature flags ✅

- [ ] `src/lib/featureFlags.ts` exists
- [ ] 3 flags defined: `NEW_THREE_ACCOUNT_MODEL`, `NEW_OVERVIEW_UI`, `NEW_ALLOCATION_FLOW`
- [ ] `isFeatureEnabled()` helper returns boolean
- [ ] `.env.example` updated với 3 vars (commented out)
- [ ] Tests pass: env unset → false; env="true" → true; env="1" → false

### 10.2 Account roles ✅

- [ ] `src/core/finance/accountRoles.ts` exists
- [ ] `ROLE_TO_ACCOUNT_IDS` covers 3 roles
- [ ] `SAVING_BUCKET_TO_ACCOUNT_ID` covers 3 buckets
- [ ] Aliased deprecation comments on `MAIN_BANK_ACCOUNT_ID`, `EMERGENCY_FUND_ACCOUNT_ID`
- [ ] Existing imports không vỡ (grep ensure)

### 10.3 Selectors ✅

- [ ] `src/core/finance/threeAccountSelectors.ts` exists with 11 exports
- [ ] `src/core/finance/threeAccountSnapshot.ts` exists with `buildThreeAccountSnapshot()`
- [ ] All selectors are **pure functions** (no store access inside)
- [ ] All selectors typed strictly (no `any`)
- [ ] Test coverage ≥90% lines

### 10.4 Domain adapter ✅

- [ ] `src/core/finance/domainEvents.ts` exists với 9 event types
- [ ] `src/core/finance/domainAdapter.ts` exports `toEngineEvents()`
- [ ] All 7 implemented domain types pass adapter test
- [ ] `ADJUSTMENT` + `REFUND` throw explicit "not yet implemented in Phase 1" error
- [ ] Every engine event carries `metadata.domainEventId`

### 10.5 Migration ✅

- [ ] `src/core/finance/migrations/legacyToThreeAccount.ts` exists
- [ ] `planMigration()` is pure, no side effects
- [ ] `suggestMainBalanceRoute()` matches heuristic in ADR §13.2
- [ ] 10 sample fixtures (xem §7.4) all pass
- [ ] Idempotent guard: same `existingBatchId` returns empty events
- [ ] Migration audit metadata present on every event

### 10.6 Wiring ✅

- [ ] `useAccountOverviewStore` returns identical legacy snapshot when flag OFF
- [ ] `useAccountOverviewStore` returns new-shape-mapped legacy snapshot when flag ON
- [ ] No regression: `npm run dev` works with flag OFF (smoke test)
- [ ] Lint clean

---

## 11. Out of scope (KHÔNG làm trong Phase 1)

Liệt kê rõ để team không creep:

- ❌ Overview UI redesign (Phase 2)
- ❌ Allocation modal `<AllocationSheet />` (Phase 3)
- ❌ Refactor `splitFunds` → `allocateIncome` (Phase 3)
- ❌ Remove `billFundBalance` field (Phase 4)
- ❌ Change `payBill` để trừ Spending (Phase 4)
- ❌ E-learning module (Phase 5)
- ❌ Audit trail UI (Phase 5)
- ❌ `ADJUSTMENT` / `REFUND` domain event implementations (Phase 4+)
- ❌ Auto-execute migration cho user thật (Phase 2 wiring)
- ❌ Onboarding modal cho mainBalance route (Phase 2)

---

## 12. Effort estimate

| Deliverable | Effort | Risk |
|-------------|--------|------|
| Feature flags | 0.5 day | Low |
| Account roles + rename | 1 day | Low |
| 11 Selectors | 2 days | Low |
| Selector tests | 1 day | Low |
| Domain events + adapter | 1.5 days | Medium |
| Adapter tests | 0.5 day | Low |
| Migration helper | 2 days | High (heuristic) |
| Migration tests + fixtures | 1 day | Medium |
| Wiring dual-read | 0.5 day | Low |
| Acceptance review + fixes | 1 day | Medium |
| **Total** | **~11 days** | Estimate 2 tuần (10 working days) — có 1 day buffer |

---

## 13. Phase 1 specific risks

| # | Risk | Mitigation |
|---|------|-----------|
| P1-R1 | `mainBalance` heuristic edge case không cover hết | 10 fixtures + extensible heuristic function. Onboarding modal Phase 2 là fallback |
| P1-R2 | `getSpendingBalance` gộp BILL_FUND tạo dư balance giả | Document rõ. Phase 4 sẽ remove khi `payBill` đổi |
| P1-R3 | Selectors pure không truy cập store, nhưng UI mapping cần combine nhiều store → có thể chậm | Phase 2 ko phải vấn đề Phase 1. Selector chỉ là building block |
| P1-R4 | Test runner hiện tại không có jest-style describe — phải dùng synthetic framework | Theo convention `tests/synthetic/*` đã có |
| P1-R5 | Engineering reviewer chưa familiar với ledger pattern | Phase 1 PR có doc inline + link ADR |

---

## 13.6 — Leadership acceptance criteria (rev 1, bắt buộc trước merge Phase 1)

Bổ sung 10 tiêu chí từ leadership review:

| # | Tiêu chí | Cách verify |
|---|---------|-------------|
| LA1 | Flag OFF → hành vi 100% như hiện tại | Smoke test: build app với `NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL` unset, mọi store/UI snapshot identical |
| LA2 | Không có write/migration nào auto-chạy với user thật | Grep `useEffect` cho `planMigration`/`executeMany` từ migration → phải = 0 trong Phase 1 |
| LA3 | Selector mới là pure functions, không đọc Zustand state bên trong | Lint rule: file `threeAccountSelectors.ts` không được import `useFinanceStore` / `useBudgetStore` / `useDashboardStore`. Test pass với input thuần. |
| LA4 | Safe-to-Spend test cover: positive / low / negative / income-but-spending-short / no-saving-target / no-bills | Test file `tests/three-account/safe-to-spend.test.ts` có ≥6 cases với tên rõ |
| LA5 | Migration plan idempotent | Test: chạy `planMigration` 2 lần với cùng `existingBatchId` → return empty events lần 2 |
| LA6 | Migration plan tạo backup/snapshot payload, dù chưa execute | `planMigration` return có field `backupSnapshot: LegacyBalanceSnapshot` để caller lưu localStorage |
| LA7 | `'main_bank'` legacy string document rõ | JSDoc comment trên `INCOME_ACCOUNT_ID` giải thích lý do giữ string |
| LA8 | Không phát sinh XP trong Phase 1 | Grep `awardXP` trong code Phase 1 mới → phải = 0. Migration events `auditActor='migration'` skip XP trigger. |
| LA9 | `npm run build` + `npm run lint` clean | CI gate |
| LA10 | Test flag OFF và flag ON đều pass | Test runner chạy 2 lần với env khác nhau, cả 2 đều pass |

---

## 14. Definition of Done — Phase 1

- [x] §10 acceptance criteria all checked (10.1 → 10.6)
- [x] §13.6 leadership criteria all checked (LA1 → LA10) — see acceptance matrix below
- [x] All test files pass: `npm run test:three-account` → **194/194 pass** (Day 10 sweep)
- [x] `npm run build` succeeds — `✓ Compiled successfully`
- [x] `npm run lint` clean (Phase 1 code = 0 new errors/warnings; pre-existing 24E/25W tracked in debt doc)
- [x] PR description in [phase-1-pr-description.md](phase-1-pr-description.md)
- [ ] Engineering lead approval — **pending**
- [ ] Merged to main with feature flag OFF default — **pending merge**
- [x] No regression on existing UI when flag OFF (LA1) — wiring.test verifies legacy snapshot identical

### Acceptance matrix LA1–LA10 (Day 10 sweep, 2026-05-19)

| # | Criterion | Status | Evidence (file + test name) | Verify command |
|---|-----------|--------|-----------------------------|----------------|
| LA1 | Flag OFF preserves legacy behavior | ✅ | `tests/three-account/wiring.test.ts` → "produces equal output regardless of flag state" + "shape unchanged when flag OFF" | `npm run test:three-account` |
| LA2 | No auto-write/migration | ✅ | `planMigration` returns plan only; never calls `executeFinanceEvent`. Grep `useEffect.*planMigration` in src = 0 | `grep -R "executeMany.*migration" src/core/finance/migrations` (returns 0 matches) |
| LA3 | Selectors / snapshot / adapter / migration are pure | ✅ | 0 `from '@/stores'` imports in `src/core/finance/**`; `tests/three-account/snapshot.test.ts` "calling builder twice yields equal output" | `grep -R "from '@/stores'" src/core/finance` |
| LA4 | Safe-to-Spend covers 6 cases | ✅ | `tests/three-account/safe-to-spend.test.ts` — Case 1 (safe), Case 2 (low), Case 3 (negative), Case 4 (income-but-spending-short), Case 5 (no-saving-target), Case 6 (no-bills) | `npm run test:three-account` |
| LA5 | Migration idempotent | ✅ | `migration.test.ts` "Fixture 9 — same context → identical plan" + "existingBatchId → isNoOp" | `npm run test:three-account` |
| LA6 | Migration backup snapshot present | ✅ | `migration.test.ts` "LA6 — backupSnapshot payload always present" (4 subcases incl. no-op + immutability) | `npm run test:three-account` |
| LA7 | `'main_bank'` legacy ID documented | ✅ | `src/core/finance/accounts.ts:18-32` JSDoc; `account-roles.test.ts` "Legacy string values preserved (Phase 1 invariant LA7)" | `npm run test:three-account` |
| LA8 | No XP triggered in Phase 1 | ✅ | 0 `awardXP(` calls in `src/core/finance/` and `tests/three-account/` | `grep -R "awardXP\(" src/core/finance tests/three-account` |
| LA9 | Build pass, lint debt unchanged | ✅ | Build: `✓ Compiled successfully`. Lint baseline: 24E/25W = same as pre-Phase-1 (DEBT-001 resolved, 0 new) | `npm run build && npm run lint` |
| LA10 | Tests cover flag ON & OFF | ✅ | `wiring.test.ts` uses `withFlag(true, ...)` and `withFlag(false, ...)` for both gate + LA1 equivalence | `npm run test:three-account` |

→ Sau đó mới bắt đầu Phase 2 (Overview UI). Roadmap đề xuất ở [phase-1-pr-description.md §13](phase-1-pr-description.md).

---

## Phụ lục — Mapping checklist với ADR

| ADR section | Phase 1 deliverable | Phase |
|-------------|---------------------|-------|
| §2 Domain model | §4 (rename + roles) | P1 ✅ |
| §3 Event types | §6 (domain adapter) | P1 ✅ |
| §4 Safe-to-Spend | §5.1 selector 10-11 | P1 ✅ |
| §5 State machine | §6 (REALLOCATE/ROLLOVER stubs) | P1 ✅ partial |
| §6 Carry-over | §6 (MONTHLY_ROLLOVER adapter) | P1 ✅ |
| §7 Legacy mapping | §7 (planMigration) | P1 ✅ |
| §8 Files affected | §4–§8 | P1 ✅ phần engine/store |
| §9 splitFunds → allocateIncome | — | P3 (out of scope) |
| §10 Risks | §13 | P1 ✅ |
| §11 Rollback | §3 (feature flag) | P1 ✅ |
| §13 mainBalance heuristic | §7 (suggestMainBalanceRoute) | P1 ✅ |
| §14 Bill states | §5 selectors 8-9 (unpaid/overdue) | P1 ✅ |
| §15 Audit trail | §7 (migration audit metadata) | P1 ✅ partial |
