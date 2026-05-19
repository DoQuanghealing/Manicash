# ADR 0001 — Mô hình 3 tài khoản (Income / Spending / Saving)

| Field | Value |
|-------|-------|
| Status | **Approved (conditional)** — Leadership sign-off 2026-05-19 |
| Date | 2026-05-19 (created), 2026-05-19 (rev 1: leadership decisions applied) |
| Author | ManiCash Architecture |
| Supersedes | Mô hình 3 ví cũ (Main / Emergency / BillFund) |
| Phase | Phase 0 — Product/Architecture Spec |
| Revision | rev 1 — Q1-Q6 resolved, domain event adapter layer added, reverse flows permitted with intent, mainBalance migration heuristic clarified |

---

## 1. Bối cảnh (Context)

### 1.1 Hiện trạng

ManiCash đang vận hành song song **2 hệ thống tài chính**:

| Layer | File | Vai trò | Trạng thái |
|-------|------|---------|-----------|
| **Legacy** | `useFinanceStore.ts` | 3 số dư rời: `mainBalance`, `emergencyBalance`, `billFundBalance` + `fixedBills[]` | Source of truth cho UI |
| **Core (ledger)** | `useFinanceCoreStore.ts` + `src/core/finance/*` | Double-entry ledger với 8 account IDs (`MAIN_BANK`, `SPENDING`, `BILL_FUND`, `EMERGENCY_FUND`, `GOAL_FUND`, `INVESTMENT_FUND`, `INCOME_CLEARING`, `EXPENSE_CLEARING`) | Đang migrate dần — hiện chỉ mirror split funds, dashboard đọc khi `ledgerEntries.length > 0` |
| **Read model** | `useAccountOverviewStore.ts` | Khái niệm 3 TK `income / expense / saving` đã có ở UI selector nhưng dữ liệu vẫn lắp ráp từ legacy | Bridge tạm |

Engine core (`src/core/finance/engine.ts`) đã có **3 event types** (`CREATE_INCOME`, `CREATE_EXPENSE`, `TRANSFER_MONEY`) và cơ chế ledger double-entry với `INCOME_CLEARING` / `EXPENSE_CLEARING` accounts. Đây là **tài sản kiến trúc** cần tận dụng — không xây lại từ đầu.

### 1.2 Vấn đề

1. **Mental model bị vỡ**: 3 ví hiện tại (Main / Emergency / BillFund) không phản ánh tư duy "tiền vào → quyết định → tiền ra" mà user thật sự cần học.
2. **BillFund là tài khoản tốn cognitive load**: user phải nhớ "đã chuyển đủ tiền vào BillFund chưa". Đáng lẽ Bill chỉ là một nhóm chi tiêu.
3. **Safe-to-Spend hiện đang trộn lẫn**: công thức ở `accountOverviewMath.ts` đã đúng phương trình, nhưng UI hiển thị như thể là "số dư ví" — gây hiểu nhầm.
4. **`splitFunds` ép user phân bổ ngay tại Income**: thiếu lựa chọn "Để sau / Giữ lại Thu nhập".
5. **Nợ kỹ thuật dual-write**: `splitFunds` ghi cả Legacy lẫn Core và đã có `warnFinanceMismatchIfNeeded` cho thấy đã từng có drift.

### 1.3 Mục tiêu của ADR này

Khóa kiến trúc đích để Phase 1+ triển khai mà không cần thiết kế lại giữa chừng. **Không** code production trong phase này.

---

## 2. Quyết định (Decision)

### 2.1 Domain model đích

ManiCash chuyển sang **3 tài khoản logical** ở tầng UI/product, gắn với **6 account IDs ở tầng ledger** (giữ nguyên engine, chỉ rename/rearrange).

```
┌─────────────────────────────────────────────────────────────┐
│  3 LOGICAL ACCOUNTS (UI/product)                            │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │  THU NHẬP    │   │  CHI TIÊU    │   │  TIẾT KIỆM   │    │
│  │              │   │              │   │              │    │
│  │ Tiền vào,    │   │ Sống trong   │   │ Xây dựng     │    │
│  │ chưa allocate│   │ tháng này    │   │ tương lai    │    │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘    │
│         │                  │                  │             │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────┐
│  6 LEDGER ACCOUNT IDs (engine)                              │
│                                                             │
│  INCOME_ACCOUNT     SPENDING_ACCOUNT      SAVING_ACCOUNT    │
│  (gốc MAIN_BANK,    (gốc SPENDING +       split thành:      │
│   rename)            BILL_FUND merged)     - RESERVE_FUND   │
│                                            - GOAL_FUND      │
│                                            - INVESTMENT_FUND│
│                                                             │
│  + INCOME_CLEARING / EXPENSE_CLEARING (giữ nguyên)          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Sub-buckets (chỉ áp dụng cho Saving)

| Logical account | Sub-bucket | Account ID ledger | Hiển thị Overview |
|----------------|-----------|-------------------|-------------------|
| Income | (none) | `INCOME_ACCOUNT` | 1 số tổng |
| Spending | **Daily** (chi tiêu hằng ngày — phân biệt qua `metadata.category`) | `SPENDING_ACCOUNT` (chung) | Breakdown: Daily vs Bill |
| Spending | **Bill** (bill cố định — phân biệt qua `metadata.isBill: true`) | `SPENDING_ACCOUNT` (chung) | Breakdown: Daily vs Bill |
| Saving | Dự phòng | `RESERVE_FUND` (rename từ `EMERGENCY_FUND`) | Ẩn sau click |
| Saving | Mục tiêu | `GOAL_FUND` | Ẩn sau click |
| Saving | Đầu tư | `INVESTMENT_FUND` | Ẩn sau click |

> **Quan trọng**: Bill **không** là account ID riêng. Bill là một `metadata.isBill: true` trên `CREATE_EXPENSE` event với `sourceAccountId = SPENDING_ACCOUNT`. Selector tự aggregate Bill vs Daily.

### 2.3 Account-role mapping (read model)

```typescript
// src/core/finance/accountRoles.ts (NEW)
export const ACCOUNT_ROLES = {
  income:  ['INCOME_ACCOUNT'],
  spending:['SPENDING_ACCOUNT'],
  saving:  ['RESERVE_FUND', 'GOAL_FUND', 'INVESTMENT_FUND'],
} as const;

export const SAVING_SUB_BUCKETS = {
  reserve:    'RESERVE_FUND',
  goals:      'GOAL_FUND',
  investment: 'INVESTMENT_FUND',
} as const;
```

---

## 3. Event types — Domain layer + Engine layer

Leadership chốt: code phải có **2 tầng event rõ rệt** để team đọc logic mà không cần hiểu ledger:

```
┌───────────────────────────────────────────────────┐
│  DOMAIN EVENTS (product/business semantic)        │
│  src/core/finance/domainEvents.ts (NEW)           │
│                                                   │
│  INCOME_RECEIVED                                  │
│  ALLOCATE_TO_SPENDING                             │
│  ALLOCATE_TO_SAVING       (savingBucket)          │
│  PAY_EXPENSE                                      │
│  PAY_BILL                 (billId, dueDay)        │
│  MONTHLY_ROLLOVER                                 │
│  REALLOCATE / ADJUSTMENT / REFUND                 │
└───────────────────────┬───────────────────────────┘
                        │
                        │  adapter (1-to-N mapping)
                        ▼
┌───────────────────────────────────────────────────┐
│  ENGINE EVENTS (ledger primitives — không đổi)    │
│  src/core/finance/types.ts                        │
│                                                   │
│  CREATE_INCOME / CREATE_EXPENSE / TRANSFER_MONEY  │
└───────────────────────────────────────────────────┘
```

### 3.1 Domain event catalog

```typescript
// src/core/finance/domainEvents.ts
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
  reason?: string;          // BẮT BUỘC cho REALLOCATE / ADJUSTMENT / REFUND
  audit?: {                 // BẮT BUỘC cho REALLOCATE / ADJUSTMENT / REFUND
    actor: 'user' | 'system' | 'migration';
    sourceUI?: string;      // ví dụ 'overview-edit', 'rollover-job'
    relatedEventId?: string;
  };
}
```

### 3.2 Mapping domain → engine

| Domain event | Engine event(s) | source / target | Metadata bắt buộc |
|-------------|-----------------|-----------------|-------------------|
| `INCOME_RECEIVED` | `CREATE_INCOME` | `target = INCOME_ACCOUNT` | `incomeKind`, `categoryId` |
| `ALLOCATE_TO_SPENDING` | `TRANSFER_MONEY` | `INCOME → SPENDING_ACCOUNT` | `monthKey`, `allocationSessionId` |
| `ALLOCATE_TO_SAVING` | 1–3 `TRANSFER_MONEY` (1 cho mỗi sub-bucket > 0) | `INCOME → {RESERVE_FUND, GOAL_FUND, INVESTMENT_FUND}` | `monthKey`, `subBucket`, `allocationSessionId`, `goalId?` |
| `PAY_EXPENSE` | `CREATE_EXPENSE` | `source = SPENDING_ACCOUNT` | `categoryId`, `isBill: false` |
| `PAY_BILL` | `CREATE_EXPENSE` | `source = SPENDING_ACCOUNT` | `isBill: true`, `billId`, `dueDay`, `paidOnTime: boolean` |
| `MONTHLY_ROLLOVER` | 0–1 `TRANSFER_MONEY` (Spending dư → Income) + adjustment markers | `SPENDING → INCOME_ACCOUNT` | `monthKeyFrom`, `monthKeyTo`, `surplusAmount`, `audit.actor: 'system'` |
| `REALLOCATE` | 1 `TRANSFER_MONEY` (chiều bất kỳ) | bất kỳ → bất kỳ | `reason` (bắt buộc), `audit.actor: 'user'`, `originalEventId?` |
| `ADJUSTMENT` | `CREATE_INCOME` hoặc `CREATE_EXPENSE` (1 bên) | depend | `reason` (bắt buộc), `audit.actor: 'system'|'migration'` |
| `REFUND` | `CREATE_INCOME` hoặc `TRANSFER_MONEY` | `EXTERNAL → SPENDING_ACCOUNT` (default) | `reason`, `originalExpenseEventId` |

### 3.3 Adapter signature

```typescript
// src/core/finance/domainAdapter.ts (NEW)
export function toEngineEvents(domain: DomainEvent): FinanceEvent[];
export function fromLedgerEntry(entry: LedgerEntry): DomainEventSummary;
```

Adapter là **chiều một** (domain → engine) khi ghi. Khi đọc, selectors group ledger entries theo `metadata.domainEventId` để hiển thị semantics.

### 3.4 XP trigger map

| Domain event | XP action | Ghi chú |
|-------------|-----------|---------|
| `INCOME_RECEIVED` | `INCOME_LOGGED` | Reward nhập thu nhập |
| `ALLOCATE_TO_SAVING` (1 sự kiện = 1 lần grant, bất kể chia bao nhiêu sub-bucket) | `SAVINGS_DEPOSIT` | Anti-spam: 1 domain event = 1 XP grant, dù emit nhiều `TRANSFER_MONEY` ở engine |
| `ALLOCATE_TO_SPENDING` | (none) | Không reward — đây là move cơ bản |
| `PAY_EXPENSE` | `EXPENSE_LOGGED` | Reward kỷ luật log chi |
| `PAY_BILL` (paidOnTime: true) | `EXPENSE_LOGGED` + báo `bills_on_time++` | Vào butler report |
| `PAY_BILL` (paidOnTime: false / overdue) | `EXPENSE_LOGGED` | Không reward thêm, không phạt — UI đã có copy nhắc |
| Goal hoàn thành (riêng) | `GOAL_COMPLETED` (NEW XP action — Phase 2+) | Tách hẳn khỏi SAVINGS_DEPOSIT |
| `REALLOCATE` / `ADJUSTMENT` / `REFUND` | (none) | Không reward, không phạt — chỉ ledger |

---

## 4. Công thức Safe-to-Spend

### 4.1 Công thức chính (planning-level)

```
SafeToSpend = monthlyIncome + carryOver − monthlyBudget − monthlySavingsTarget

monthlyBudget = dailySpendingLimit + fixedBillsTotal
monthlySavingsTarget = reserveTarget + goalTarget + investmentTarget
```

### 4.2 Phân giải từng biến

| Biến | Nguồn dữ liệu | Ghi chú |
|------|---------------|---------|
| `monthlyIncome` | Tổng `CREATE_INCOME` của tháng hiện tại | Lấy từ ledger event history, không phải số dư |
| `carryOver` | Snapshot `xpAtMonthStart` style: lưu khi rollover | Mặc định = `INCOME_ACCOUNT.balance` cuối tháng trước (xem §6) |
| `dailySpendingLimit` | `useBudgetStore.getTotalCategoryLimits()` | Đã có sẵn |
| `fixedBillsTotal` | Σ `fixedBills[].amount` (chưa bị xóa khỏi `useFinanceStore`) | Phase 4 sẽ chuyển vào `useBudgetStore` |
| `reserveTarget` / `goalTarget` / `investmentTarget` | **NEW field**: `useBudgetStore.savingsTargets[monthKey]` | Chưa tồn tại, cần thêm |

### 4.3 Trạng thái UI (Leadership chốt)

```typescript
type SafeToSpendStatus = 'safe' | 'low' | 'negative';

function getStatus(amount: number): SafeToSpendStatus {
  if (amount < 0) return 'negative';     // coaching, KHÔNG panic
  if (amount <= 1_000_000) return 'low';
  return 'safe';                          // > 1.000.000đ
}
```

**Migration vs hiện tại**: `'danger'` (cũ, gộp ≤0) **rename → `'negative'`**. Không thêm trạng thái trung gian — leadership muốn UI đơn giản 3 mức.

### 4.4 Copy quy chuẩn (locked — không sửa khi implement)

| Status | Tiêu đề lớn | Sub-copy |
|--------|------------|----------|
| `safe` | `Số dư chi tiêu an toàn` | *"Bạn còn Xđ linh hoạt sau khi đã tính chi tiêu và tiết kiệm tháng này."* |
| `low` | `Số dư chi tiêu an toàn` | *"Còn Xđ — gần hết chỗ linh hoạt. Cân nhắc trước khi tăng chi tiêu."* |
| `negative` | `Số dư chi tiêu an toàn` | *"Kế hoạch đang thiếu Xđ so với nguồn tiền hiện tại. Bạn có thể giảm ngân sách, giảm mục tiêu tiết kiệm hoặc bổ sung thu nhập."* |

**Cấm dùng**: "vỡ kế hoạch", "nguy hiểm", "âm tiền", "báo động", icon đỏ rực, emoji 😱/💀.

**Yêu cầu visual**: status `negative` dùng tone cam/vàng (không đỏ) + icon coaching (không icon cảnh báo).

### 4.4 Tính chất quan trọng

- Safe-to-Spend là **số ảo** (planning metric), **không phải** số dư của bất kỳ account nào.
- Tiền đại diện cho Safe-to-Spend có thể **vẫn nằm ở `INCOME_ACCOUNT`** — user vẫn dùng được, chỉ là app cho biết "đây là phần còn lại an toàn".
- Khi user transfer từ Income → Spending/Saving, các biến `monthlyBudget` và `monthlySavingsTarget` **không** đổi → Safe-to-Spend **không** đổi. Đây là điểm gây hiểu nhầm nếu thiết kế UI sai.

---

## 5. State machine dòng tiền

### 5.1 Sơ đồ chính

```
                     ┌─────────────────────────────────┐
                     │       NGOÀI HỆ THỐNG            │
                     │ (Lương, freelance, được tặng)   │
                     └────────────────┬────────────────┘
                                      │  INCOME_RECEIVED
                                      ▼
                     ┌─────────────────────────────────┐
              ┌──────│       TÀI KHOẢN THU NHẬP        │──────┐
              │      │    INCOME_ACCOUNT (asset)       │      │
              │      └────────────────┬────────────────┘      │
              │  ALLOCATE_TO_SPENDING │  (giữ lại — default)  │ ALLOCATE_TO_SAVING
              ▼                       ▼                       ▼
   ┌─────────────────────┐  ┌──────────────────┐    ┌─────────────────────┐
   │  TÀI KHOẢN CHI TIÊU │  │   THU NHẬP       │    │  TÀI KHOẢN TIẾT KIỆM│
   │  SPENDING_ACCOUNT   │  │   (giữ lại)      │    │  (3 sub-buckets)    │
   │ ┌─────────────────┐ │  │                  │    │ ┌─────────────────┐ │
   │ │ Daily expenses  │ │  │  Carry-over →    │    │ │ RESERVE_FUND    │ │
   │ │ Bills           │ │  │  Income tháng sau│    │ │ GOAL_FUND       │ │
   │ └─────────────────┘ │  └──────────────────┘    │ │ INVESTMENT_FUND │ │
   └──────────┬──────────┘                           │ └─────────────────┘ │
              │ PAY_EXPENSE / PAY_BILL               └─────────────────────┘
              ▼
   ┌─────────────────────┐
   │   NGOÀI HỆ THỐNG    │
   │ (tiêu thực tế)      │
   └─────────────────────┘
```

### 5.2 Chiều thuận (primary flow — 95% use case)

- `INCOME → SPENDING`
- `INCOME → SAVING.{reserve, goals, investment}`
- `SPENDING → external (expense/bill)`

### 5.3 Chiều ngược (allowed, có chủ đích — không expose phổ thông trong UI)

| Flow ngược | Domain event | Use case | UI access |
|-----------|--------------|----------|-----------|
| `SPENDING → INCOME` | `MONTHLY_ROLLOVER` (system) hoặc `REALLOCATE` (user) | Cuối tháng auto rollover dư; user sửa lỗi allocate | Auto + edit nâng cao |
| `SAVING.* → INCOME` hoặc `SAVING.* → SPENDING` | `REALLOCATE` | User rút tiết kiệm khi khẩn cấp; sửa allocate nhầm | Settings → "Rút từ tiết kiệm" (chậm 2 click) |
| `EXTERNAL → SPENDING` | `REFUND` | Hoàn tiền chi tiêu | Từ chi tiết transaction |
| Bất kỳ | `ADJUSTMENT` | Migration, sửa số liệu bị lệch | Admin only |

**Yêu cầu cứng cho chiều ngược**:
- Bắt buộc `reason` (string, ≥10 ký tự).
- Bắt buộc `audit.actor` ∈ `{user, system, migration}`.
- Bắt buộc log vào audit trail (xem §13).
- UI **không show** action chiều ngược cho user thường — chỉ qua menu "Sửa giao dịch" hoặc "Rút từ tiết kiệm".

### 5.4 Tính chất state machine sau revision

- **Tiết kiệm là 1 chiều ở UI thường**: chỉ chảy vào. Nhưng domain/engine **cho phép** chảy ra qua `REALLOCATE` với reason.
- **Income → Spending là 1 chiều trong UI thường**, nhưng cho phép REALLOCATE ngược trong settings nâng cao.
- **Spending dư cuối tháng**: MVP **auto-transfer về Income carry-over tháng mới** qua `MONTHLY_ROLLOVER` (xem §6).
- **Saving không reset** khi rollover tháng.
- **Audit metadata bắt buộc** cho mọi flow ngược — đảm bảo ledger luôn truy vết được "ai/khi nào/vì sao".

---

## 6. Định nghĩa Carry-Over (chốt v1)

### 6.1 Công thức

```
carryOver_tháng_N = INCOME_ACCOUNT.balance tại 23:59:59 ngày cuối tháng (N-1)

Trong đó: ngay trước snapshot, hệ thống thực hiện MONTHLY_ROLLOVER:
   IF SPENDING_ACCOUNT.balance > 0:
      emit TRANSFER_MONEY (SPENDING → INCOME, amount=spending.balance,
                           domain: MONTHLY_ROLLOVER, actor='system')
```

### 6.2 Lý do (leadership confirmed)

- Một nguồn duy nhất: `INCOME_ACCOUNT` — tránh user nhầm chỗ tìm carry-over.
- MVP **không** ép Spending dư đi vào Saving (tránh paternalism). Đẩy về Income để tháng mới user **chủ động allocate lại**.
- Phase 5+ có thể cho user chọn 3 đường: giữ ở Spending / về Income / sang Saving.

### 6.3 Implementation

| Step | File | Hành động |
|------|------|----------|
| 1 | `useBudgetStore.checkAndRollover()` | Trước khi reset `categoryBudgets`, gọi `useFinanceCoreStore.execute(MONTHLY_ROLLOVER)` |
| 2 | Adapter `MONTHLY_ROLLOVER → TRANSFER_MONEY` | `SPENDING → INCOME` với `metadata.surplusAmount` |
| 3 | `MonthlySnapshot` (existing type) | Field `carryOver` lưu `INCOME_ACCOUNT.balance` sau rollover |
| 4 | Overview UI | Hiển thị *"Dư tháng trước: 800.000đ"* + tooltip giải thích |
| 5 | Audit log | Mỗi rollover sinh 1 entry `audit.actor='system'`, `audit.sourceUI='rollover-job'`, `metadata.monthKeyFrom/To` |

### 6.4 Edge cases

| Trường hợp | Hành vi |
|-----------|---------|
| Spending dư = 0 | Không emit transfer, snapshot vẫn ghi `carryOver = INCOME.balance` |
| Spending balance âm (do over-spend) | **Không** rollover từ Spending. carryOver chỉ lấy từ Income hiện tại. Snapshot lưu `spendingDeficit` riêng để butler report cảnh báo. |
| App offline qua giao điểm tháng | `checkAndRollover()` idempotent — chỉ chạy khi mở app và phát hiện `currentMonth !== actualMonth` |
| User rollback manual trong tháng | Không hỗ trợ — rollover là 1-way |

---

## 7. Mapping Legacy → New Model

### 7.1 Account ID mapping

| Legacy ID | New ID | Lý do |
|-----------|--------|-------|
| `MAIN_BANK_ACCOUNT_ID = 'main_bank'` | `INCOME_ACCOUNT_ID = 'income_account'` | Đây là nơi income thật sự rơi vào — đổi tên cho đúng vai trò |
| `SPENDING_ACCOUNT_ID = 'spending'` | `SPENDING_ACCOUNT_ID = 'spending'` | **Giữ nguyên**, nhưng giờ ôm cả bill |
| `BILL_FUND_ACCOUNT_ID = 'bill_fund'` | (**xóa khỏi top-level**) | Tiền BillFund cũ → merge vào SPENDING. Lưu trữ metadata `_legacy: 'bill_fund'` để debug |
| `EMERGENCY_FUND_ACCOUNT_ID = 'emergency_fund'` | `RESERVE_FUND_ACCOUNT_ID = 'reserve_fund'` | Đổi tên cho đồng bộ UI ("Dự phòng") |
| `GOAL_FUND_ACCOUNT_ID = 'goal_fund'` | (giữ nguyên) | — |
| `INVESTMENT_FUND_ACCOUNT_ID = 'investment_fund'` | (giữ nguyên) | — |
| `INCOME_CLEARING_ACCOUNT_ID` | (giữ nguyên) | Engine internal |
| `EXPENSE_CLEARING_ACCOUNT_ID` | (giữ nguyên) | Engine internal |

### 7.2 Balance mapping

| Legacy field | New target | Migration formula |
|-------------|------------|-------------------|
| `useFinanceStore.mainBalance` | `INCOME_ACCOUNT.balance` | Direct (1:1) |
| `useFinanceStore.billFundBalance` | `SPENDING_ACCOUNT.balance` (cộng dồn) | `SPENDING += billFundBalance` |
| `useFinanceStore.emergencyBalance` | `RESERVE_FUND.balance` | Direct (1:1) |
| `useDashboardStore.accounts.reserve.balance` | `RESERVE_FUND.balance` | Direct |
| `useDashboardStore.accounts.goals.balance` | `GOAL_FUND.balance` | Direct |
| `useDashboardStore.accounts.investment.balance` | `INVESTMENT_FUND.balance` | Direct |
| `useDashboardStore.accounts.spending.balance` | `SPENDING_ACCOUNT.balance` (cộng dồn) | `SPENDING += spending.balance` (nếu chưa migrate) |

### 7.3 Migration helper signature (Phase 1 sẽ implement)

```typescript
// src/core/finance/migrations/legacyToThreeAccount.ts
export interface LegacyBalanceSnapshot {
  mainBalance: number;
  billFundBalance: number;
  emergencyBalance: number;
  reserveBalance: number;
  goalsBalance: number;
  investmentBalance: number;
}

export function migrateLegacyToThreeAccount(
  legacy: LegacyBalanceSnapshot,
  occurredAt: string,
): FinanceEvent[] {
  // Tạo 1 CREATE_INCOME tổng + N TRANSFER để fund các account đích.
  // Idempotent: dùng deterministic event IDs theo timestamp + checksum.
}
```

---

## 8. Files / Stores / Components bị ảnh hưởng

### 8.1 Core engine (ít thay đổi — đã sẵn nền tảng)

| File | Loại thay đổi | Phase |
|------|--------------|-------|
| `src/core/finance/accounts.ts` | Rename `MAIN_BANK → INCOME_ACCOUNT`, `EMERGENCY_FUND → RESERVE_FUND`. Giữ alias export 30 ngày. | P1 |
| `src/core/finance/types.ts` | Thêm `AllocationMetadata` type guard. | P1 |
| `src/core/finance/accountRoles.ts` | **NEW**: mapping role → account IDs | P1 |
| `src/core/finance/engine.ts` | Không đổi (engine generic) | — |
| `src/core/finance/selectors.ts` | Thêm `getBalanceByRole(role)`, `getSpendingBreakdown()` (daily/bill) | P1 |
| `src/core/finance/dashboardSelectors.ts` | Refactor `CoreDashboardBalances` → expose 3 logical balances | P1 |

### 8.2 Stores

| File | Loại thay đổi | Phase |
|------|--------------|-------|
| `src/stores/useFinanceCoreStore.ts` | Thêm `migrateFromLegacy()` action | P1 |
| `src/stores/useFinanceStore.ts` | **Deprecate** `billFundBalance`, `emergencyBalance`. Giữ field = 0 sau migrate. `payBill()` chuyển sang trừ Spending. | P4 |
| `src/stores/useAccountOverviewStore.ts` | Refactor `buildAccountOverviewSnapshot` đọc từ core selectors. Bỏ source `useFinanceStore.billFundBalance`. | P2 |
| `src/stores/useBudgetStore.ts` | Thêm `savingsTargets[monthKey]`, refactor `getSafeToSpend()` lấy từ snapshot mới | P1 |
| `src/stores/useDashboardStore.ts` | Refactor `splitFunds` thành `allocateIncome` (xem §9). Bỏ side-effect cập nhật `useFinanceStore` legacy fields. | P3 |

### 8.3 Logic library

| File | Loại thay đổi | Phase |
|------|--------------|-------|
| `src/lib/accountOverviewMath.ts` | Mở rộng `SafeToSpendStatus` thêm `'negative'`, `'warning'` | P1 |
| `src/lib/butlerReport.ts` | Chuyển input từ `emergencyBalance` → `reserveBalance` | P1 |
| `src/lib/cfoHealthScore.ts` | Refactor `emergencyFundScore` đọc `RESERVE_FUND` | P1 |

### 8.4 UI components

| File | Loại thay đổi | Phase |
|------|--------------|-------|
| Overview page (`src/app/(app)/overview/`) | **Rewrite**: 4 chỉ số mới (`SafeToSpendHero`, `IncomeAccountCard`, `SpendingAccountCard`, `SavingAccountCard`) | P2 |
| `MonthlyBudgetBlock` (NEW) | Component chung cho ngân sách tháng (daily + bills breakdown) | P2 |
| Modal `AllocationSheet` (NEW) | 3 preset + slider + "Để sau" | P3 |
| `BillSettings` / `BillBreakdown` | Move bill payment logic: trừ Spending, không trừ BillFund | P4 |
| Ledger page filter | Thêm filter "Bill" tách riêng "Expense" | P4 |

### 8.5 Feature flag

- **NEW**: `src/lib/featureFlags.ts` (nếu chưa có) — export `NEW_THREE_ACCOUNT_MODEL: boolean` (env `NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL`).
- Dùng để gate UI mới (Phase 2) và migration trigger (Phase 1).

---

## 9. API thay đổi — `splitFunds` → `allocateIncome`

### 9.1 Hiện tại (sẽ deprecate)

```typescript
useDashboardStore.splitFunds({
  sourceAmount, billPercent, savingsPercent,
  savingsBreakdown: { reserve, goals, investment }
});
```

### 9.2 Mới (Phase 3)

```typescript
useFinanceCoreStore.allocateIncome({
  sourceAmount,
  toSpending: number,                        // VND, không phải %
  toSaving: {
    reserve: number,
    goals: number,
    investment: number,
  },
  hold: number,                              // giữ lại ở Income
  sourceIncomeEventId?: string,              // optional link
  monthKey: string,
  allocationSessionId: string,               // để XP anti-spam
});
```

**Validation**:
- `toSpending + reserve + goals + investment + hold ≤ sourceAmount` (cho phép dư = hold mặc định)
- Tất cả ≥ 0
- Nếu `hold === sourceAmount` (user chọn "Để sau") → **không emit event**, chỉ ghi `AllocationPostponed` log.

**Quan trọng**: hàm **không** tự tính %. UI tự convert preset (70/20/10) → VND.

---

## 10. Rủi ro Migration

| # | Rủi ro | Khả năng | Tác động | Mitigation |
|---|--------|----------|----------|-----------|
| R1 | Mất tiền user do mapping sai | Thấp | 🔴 Cao | Migration script deterministic + idempotent. Dual-write 30 ngày. Daily reconciliation job log mismatch. |
| R2 | Số dư hiển thị âm cho user thật | Trung | 🟠 Trung | Migration script bù chênh lệch bằng `MIGRATION_ADJUSTMENT` event (metadata flag). |
| R3 | XP grant trùng do gọi 2 lần (`SAVINGS_DEPOSIT` legacy + new) | Cao nếu không guard | 🟠 Trung | Dual-write: chỉ MỘT codepath emit XP. Legacy path bị silenced bằng flag. |
| R4 | User confuse: bill thấy 2 chỗ (Spending breakdown + Bill list cũ) | Cao | 🟠 Trung | Phase 4 phải xóa hẳn UI Bill cũ. Không A/B test riêng — đi cùng với P2. |
| R5 | Safe-to-Spend âm gây panic, user uninstall | Trung | 🟡 Thấp-Trung | Copy coaching (xem §4.3). Animation "calm" (không đỏ rực). |
| R6 | Demo seed data không migrate được sạch | Cao (Phase 1 dev) | 🟡 Thấp | Seed data tách riêng, có function `regenerateSeed()` chạy lại từ đầu. |
| R7 | Existing `splitFunds` callers vỡ | Cao | 🟠 Trung | Giữ `splitFunds` là wrapper gọi `allocateIncome` trong 30 ngày. Eslint rule `no-deprecated-splitfunds` cảnh báo. |
| R8 | `useAccountOverviewStore.warnFinanceMismatchIfNeeded` log nhiễu | Thấp | 🟡 Thấp | Tắt warning trong Phase 1 dual-write window. |

---

## 11. Rollback plan (Feature flag)

### 11.1 Cơ chế

```typescript
// src/lib/featureFlags.ts (NEW)
export const FLAGS = {
  NEW_THREE_ACCOUNT_MODEL: process.env.NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL === 'true',
  NEW_OVERVIEW_UI: process.env.NEXT_PUBLIC_ENABLE_NEW_OVERVIEW === 'true',
  NEW_ALLOCATION_FLOW: process.env.NEXT_PUBLIC_ENABLE_ALLOCATION_FLOW === 'true',
} as const;
```

### 11.2 Rollback decision tree

| Vấn đề phát hiện ở phase nào | Hành động |
|-----------------------------|-----------|
| Phase 1 (data model) | Tắt `NEW_THREE_ACCOUNT_MODEL` → `useAccountOverviewStore` fallback đọc legacy. Migration đã chạy thì xóa ledger entries với `metadata._migration: true`. |
| Phase 2 (UI) | Tắt `NEW_OVERVIEW_UI` → render Overview cũ. Data layer mới vẫn chạy ngầm. |
| Phase 3 (allocation) | Tắt `NEW_ALLOCATION_FLOW` → ẩn modal, giữ `splitFunds` cũ. |
| Phase 4 (bill merge) | **Không rollback được dễ** — bill UI đã bị xóa. Cần forward-fix. → Phase 4 phải có canary 1 tuần. |
| Phase 5 (cleanup) | Đã xóa code legacy. Rollback bằng git revert + redeploy. |

### 11.3 Canary rollout

| Phase | Audience | Duration | Gate để mở rộng |
|-------|----------|----------|----------------|
| P1 | Dev only (dual-write trên all users, KHÔNG đổi UI) | 1 tuần | 0 mismatch warning |
| P2 | 5% → 25% → 50% → 100% | 2 tuần | Quiz hiểu Safe-to-Spend ≥70%, retention không giảm |
| P3 | 10% → 50% → 100% | 1 tuần | Allocation/24h ≥40% |
| P4 | 100% (không A/B vì legacy UI đã xóa) | 1 tuần canary | 0 user còn `billFundBalance > 0` |
| P5 | 100% | — | 0 import legacy |

---

## 12. Quyết định Leadership (Q1–Q6 đã chốt 2026-05-19)

| # | Quyết định | Tham chiếu |
|---|-----------|-----------|
| Q1 — Safe-to-Spend âm | **Cho phép**. 3 status: `safe` (>1M), `low` (0–1M), `negative` (<0). Copy coaching, không panic. | §4.3, §4.4 |
| Q2 — Spending dư cuối tháng | **Auto-transfer về Income** (`MONTHLY_ROLLOVER` event). MVP không cho user chọn, Phase 5+ sẽ có 3 option (giữ/về thu nhập/sang tiết kiệm). | §6 |
| Q3 — `monthlySavingsTarget` nguồn | **Field riêng ở Budget settings**, không derive từ balance. Default 0. Có thể derive từ `monthlyContributions` target nếu user đã set, hoặc từ active goals nếu user opt-in. | §4.2 |
| Q4 — Bill còn nợ/quá hạn | Bill còn nợ = `!isPaid` trong tháng. Bill quá hạn = `!isPaid && dueDay < today`. Bill sắp đến hạn = `!isPaid && dueDay ∈ [today, today+3]`. 4 UI states: Đã trả / Chưa trả / Sắp đến hạn / Quá hạn. Trả bill **reject nếu Spending thiếu** (không clamp). | §14 (mới) |
| Q5 — XP SAVINGS_DEPOSIT | **1 lần / `ALLOCATE_TO_SAVING` domain event**, dù emit nhiều `TRANSFER_MONEY`. Hoàn thành goal lớn → event riêng `GOAL_COMPLETED`. | §3.4 |
| Q6 — Copy Income | Primary: `Tài khoản thu nhập`. Sub: *"Tiền đã nhận, chưa phân bổ hết"*. **Cấm** từ "tiền dư" ở label chính. | §4.4, §15 |

### Quyết định bổ sung từ leadership review

| # | Quyết định | Tham chiếu |
|---|-----------|-----------|
| L1 — State machine | Cho phép chiều ngược qua domain events `REALLOCATE / ADJUSTMENT / REFUND / MONTHLY_ROLLOVER` với `reason` + `audit.actor` bắt buộc. UI thường không expose. | §5.3 |
| L2 — Domain event layer | Bắt buộc tách 2 tầng: domain events (semantic) → engine events (ledger). Có adapter rõ. | §3 |
| L3 — `mainBalance` migration | **Không** map máy móc. Có heuristic + onboarding hỏi user nếu ambiguous. Backup snapshot trước migrate. | §13 (mới) |
| L4 — Audit trail | Mọi flow ngược + migration phải log audit. Lưu được, truy vết được. | §15 (mới) |

---

## 13. Migration heuristic cho `mainBalance` (leadership concern L3)

### 13.1 Vấn đề

Legacy `useFinanceStore.mainBalance` đang vừa là **tiền nhận vào** (income landing) vừa là **nguồn trả expense**. Không có flag phân biệt. Migration máy móc có 2 trade-off:

- Map toàn bộ `mainBalance → SPENDING`: an toàn cho thanh toán bill ngay, nhưng phá khái niệm "user phải allocate".
- Map toàn bộ `mainBalance → INCOME`: đúng tinh thần mới, nhưng user có thể bị "không có tiền trong Spending" lúc cần trả bill.

### 13.2 Quyết định (leadership-confirmed)

**Mặc định**: `mainBalance → INCOME_ACCOUNT`. User sẽ thấy onboarding "1 lần" sau migrate, dẫn họ allocate.

**Ngoại lệ — auto-route sang SPENDING** khi tất cả điều kiện sau đúng:
- Có bill đã trả trong tháng hiện tại (proxy: user đã từng tự fund Spending).
- `mainBalance ≤ getTotalCategoryLimits() + getTotalFixedBillsAmount()` (số tiền vừa khít ngân sách tháng).
- Có ≥3 expense transactions trong 7 ngày gần nhất.

Khi rơi vào ngoại lệ: route theo tỷ lệ `mainBalance × 0.7 → SPENDING`, `mainBalance × 0.3 → INCOME` (heuristic 70/30 thiên về user đã chủ động).

### 13.3 Onboarding modal (cho user thật, ambiguous case)

Hiển thị **trước khi commit migration** nếu legacy `mainBalance > 0` và không match ngoại lệ §13.2:

> **Bạn muốn số tiền hiện tại nằm ở đâu?**
> 
> ManiCash đang chuyển sang mô hình 3 tài khoản: Thu nhập / Chi tiêu / Tiết kiệm.
> 
> Bạn có **X.XXX.XXXđ** chưa phân loại. Bạn muốn coi đây là:
> 
> - [ ] **Tài khoản thu nhập** (chưa phân bổ) — khuyên dùng nếu bạn vừa nhận lương
> - [ ] **Tài khoản chi tiêu** (sẵn để dùng) — khuyên dùng nếu đây là tiền đã định để tiêu tháng này
> - [ ] **Tự chia** — chia theo % cho cả hai

### 13.4 Demo / seed data

Demo seed **regenerate** từ đầu theo mô hình 3 TK — không migrate. Lý do: seed chỉ phục vụ DX, không có data thật.

### 13.5 Backup & rollback

| Step | Hành động |
|------|----------|
| 1 | Trước migrate, snapshot toàn bộ state vào localStorage: `manicash:legacy-snapshot:<timestamp>` |
| 2 | Migration emit events có `metadata.migrationBatchId` chung |
| 3 | Rollback bằng cách: lọc ledger entries theo `migrationBatchId` → xóa → restore localStorage snapshot |
| 4 | Migration job idempotent: chạy lại không tạo duplicate ledger entries (check `migrationBatchId` đã tồn tại) |

---

## 14. Bill semantics (Q4 detail)

### 14.1 4 trạng thái UI

| State | Điều kiện | UI badge | Hành động cho phép |
|-------|----------|----------|--------------------|
| **Đã trả** | `isPaid === true` | Xanh, ✓ | Xem chi tiết, undo (REALLOCATE) |
| **Chưa trả** | `!isPaid && dueDay ≥ today + 3` | Trung tính (xám) | Trả ngay |
| **Sắp đến hạn** | `!isPaid && today ≤ dueDay < today + 3` | Vàng, ⏰ | Trả ngay (highlight) |
| **Quá hạn** | `!isPaid && dueDay < today` | Cam (không đỏ), ⚠ | Trả ngay + copy coaching |

### 14.2 Hành vi trả bill

```
PAY_BILL(billId, amount):
  IF SPENDING_ACCOUNT.balance < amount:
    REJECT — return { ok: false, shortage: amount - balance }
    UI hiện: "Thiếu Xđ trong tài khoản chi tiêu. Bạn có muốn chuyển từ thu nhập sang không?"
  ELSE:
    emit CREATE_EXPENSE source=SPENDING_ACCOUNT, metadata={isBill:true, billId, dueDay, paidOnTime: today ≤ dueDay}
    set bill.isPaid = true
    grant XP EXPENSE_LOGGED
    IF paidOnTime: increment butler_report.billsOnTime
```

**Cấm**: clamp về 0 hoặc trả 1 phần. Một bill được trả → trả đủ amount.

### 14.3 Bill quá hạn không phạt XP

Leadership chốt: **không phạt XP** khi bill quá hạn. UI chỉ coaching: *"Bill này quá hạn N ngày. Trả ngay để không bị phạt từ nhà cung cấp dịch vụ."*

Lý do: gamification phải khuyến khích hành vi tốt, không trừng phạt hành vi thực tế cuộc sống (user có thể bận, ốm).

---

## 15. Audit trail & traceability (leadership concern L4)

### 15.1 Yêu cầu

Mỗi event có 3 loại metadata bắt buộc theo context:

| Loại | Bắt buộc khi | Field |
|------|--------------|-------|
| **Domain link** | Mọi event | `metadata.domainEventId` (link engine event ↔ domain event) |
| **Allocation session** | `ALLOCATE_TO_SPENDING`, `ALLOCATE_TO_SAVING` | `metadata.allocationSessionId` (anti-spam XP) |
| **Audit** | `REALLOCATE`, `ADJUSTMENT`, `REFUND`, `MONTHLY_ROLLOVER` | `audit.actor`, `audit.sourceUI`, `audit.reason` (nếu manual), `audit.relatedEventId?` |

### 15.2 Migration audit

| Field | Giá trị mẫu |
|-------|------------|
| `audit.actor` | `'migration'` |
| `audit.sourceUI` | `'legacy-to-three-account-v1'` |
| `metadata.migrationBatchId` | `'mig-2026-05-19-{userUid}'` |
| `metadata.legacySource` | `'mainBalance'` / `'billFundBalance'` / `'emergencyBalance'` |
| `metadata.legacyValue` | original numeric value |

### 15.3 Audit trail UI (sau Phase 5)

- `/admin/audit-trail?userUid=X&month=2026-05` — list tất cả `audit.actor='system'|'migration'` events.
- User-facing: trong từng transaction detail có "Lịch sử thao tác" hiện các REALLOCATE/REFUND đã apply.

---

## 16. Definition of Done — ADR này

ADR được coi là chốt khi:

- [x] ~~Leadership review và xác nhận Q1–Q6~~ ✓ Done 2026-05-19 (xem §12)
- [x] ~~Leadership review L1–L4 (state machine, domain events, mainBalance migration, audit)~~ ✓ Done 2026-05-19
- [ ] Engineering lead xác nhận mapping §7 + §13 không phá data thật
- [ ] Product confirm copy Vietnamese cho 3 tài khoản + 3 sub-buckets + Safe-to-Spend (§4.4)
- [ ] PR mở để track Phase 1 với checklist deliverable (xem `docs/plans/phase-1-read-model.md`)
- [ ] Feature flag (`NEW_THREE_ACCOUNT_MODEL`, `NEW_OVERVIEW_UI`, `NEW_ALLOCATION_FLOW`) được merge vào main (default = false)

Sau khi 4 mục còn lại được tick → bắt đầu Phase 1.

---

## Phụ lục A — Glossary

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| **Logical account** | Khái niệm UI (Thu nhập / Chi tiêu / Tiết kiệm) |
| **Ledger account ID** | ID kỹ thuật trong engine (`INCOME_ACCOUNT`, `SPENDING_ACCOUNT`, ...) |
| **Sub-bucket** | Phân loại trong Saving (Dự phòng / Mục tiêu / Đầu tư) |
| **Allocation** | Hành vi user chuyển tiền từ Income → Spending hoặc Saving |
| **Carry-over** | Số dư Income tháng trước được "rolled over" sang tháng mới |
| **Safe-to-Spend** | Số ảo (planning metric), không phải balance bất kỳ account nào |
| **Dual-write** | Ghi cả legacy lẫn new để cross-check trong giai đoạn migrate |

---

## Phụ lục B — Đối chiếu với engine hiện có

Engine `executeFinanceEvent` hiện tại trong `src/core/finance/engine.ts` đã support đầy đủ event flows ADR mô tả. Cụ thể:

- ✅ `CREATE_INCOME` → debit clearing, credit target → có thể dùng cho `INCOME_ACCOUNT`.
- ✅ `TRANSFER_MONEY` → debit source, credit target → dùng cho mọi allocation.
- ✅ `CREATE_EXPENSE` → debit source, credit clearing → dùng cho daily + bills.

**Không cần thêm event type mới**. Toàn bộ semantics 3-account model là **rename + metadata convention + selector layer**.

Đây là lý do ADR khả thi trong 8 tuần thay vì 6 tháng.
