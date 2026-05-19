# Pre-Push Checklist — Production Prep cho Antigravity

| Field | Value |
|-------|-------|
| Status | **Active** — chạy trước mỗi lần đẩy lên GitHub `main` để ship cho user thật |
| Owner | Antigravity (Google IDE assistant) hoặc dev tự chạy |
| Last reviewed | 2026-05-19 |

## Mục đích

Repo này có hai loại data:

- **Demo data** (seed hard-coded trong store) — phục vụ dev, demo, mô phỏng UX khi chưa có user thật. Số liệu đẹp, history phong phú, balance to.
- **Dev tooling** (Dev Bypass Login button, debug widgets) — phục vụ test nhanh, không nên xuất hiện trước user thật.

Trước khi **đẩy production-ready code** lên GitHub, **Antigravity (hoặc bạn) phải chạy hết checklist dưới đây** để app khi user mới cài về thấy:

1. Mọi số liệu = 0 (clean slate)
2. Không có button bypass cho phép skip login
3. Không có debug widget lộ raw state

Sau khi checklist done → commit chung 1 lần với message `chore(release-prep): reset seed + remove dev tooling`.

---

## ☑ Checklist

### 1. Reset seed financial data về 0

**File: `src/stores/useFinanceStore.ts`**

#### 1.1 Xóa `generateSeedData()` hoặc replace return rỗng

Tìm function `generateSeedData()`:

```ts
function generateSeedData(): Transaction[] {
  // ... 14 ngày tạo income/expense giả ...
}
```

→ Thay bằng:

```ts
function generateSeedData(): Transaction[] {
  return [];
}
```

#### 1.2 Reset starter balances

```ts
export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: generateSeedData(),
  mainBalance: 15000000,        // ← đổi thành 0
  emergencyBalance: 5000000,    // ← đổi thành 0
  billFundBalance: 8500000,     // ← đổi thành 0
  fixedBills: SEED_BILLS,       // ← để [] nếu KHÔNG muốn pre-fill bill mẫu
  ...
}));
```

#### 1.3 SEED_BILLS

Quyết định: giữ template bills (Tiền nhà / Điện / Nước / Internet) cho user mới khỏi phải nhập, **hoặc** set `[]` để user tự thêm.

Đề xuất: **giữ template bills** nhưng tất cả `isPaid: false`. User dễ start hơn.

```ts
const SEED_BILLS: FixedBill[] = [
  // Giữ list nhưng đảm bảo:
  //   - mọi bill isPaid: false
  //   - amounts hợp lý làm template
  //   - HOẶC set = [] nếu muốn user nhập từ đầu
];
```

### 2. Reset seed budget categories

**File: `src/stores/useBudgetStore.ts`**

```ts
const SEED_BUDGETS: CategoryBudget[] = [
  { categoryId: 'food', monthlyLimit: 4_000_000, spent: 2_800_000, ... },
  // ...
];
```

→ Thay bằng:

```ts
const SEED_BUDGETS: CategoryBudget[] = [];
// Hoặc giữ category template nhưng spent=0:
// { categoryId: 'food', monthlyLimit: 0, spent: 0, month: getCurrentMonthKey() }
```

Reset `carryOver`:
```ts
carryOver: 800_000,  // ← đổi thành 0
```

### 3. Reset seed dashboard accounts + contributions

**File: `src/stores/useDashboardStore.ts`**

```ts
// SEED_CONTRIBUTIONS
const SEED_CONTRIBUTIONS: Record<string, FundContribution[]> = {
  reserve: [{ month: curM, amount: 500_000 }, { month: curM, amount: 300_000 }],
  goals: [{ month: curM, amount: 400_000 }, { month: curM, amount: 200_000 }],
  investment: [{ month: curM, amount: 300_000 }],
};
```

→ Thay bằng:

```ts
const SEED_CONTRIBUTIONS: Record<string, FundContribution[]> = {
  reserve: [],
  goals: [],
  investment: [],
};
```

```ts
// SEED_ACCOUNTS — set mọi balance = 0
const SEED_ACCOUNTS: DashboardAccounts = {
  income: { balance: 0, icon: 'Wallet' },
  spending: { balance: 0, limit: 0, icon: 'ShoppingBag' },
  fixed_bills: { balance: 0, pending_count: 0, icon: 'CreditCard' },
  reserve: { balance: 0, is_locked: true, icon: 'Lock' },
  goals: { balance: 0, target: 0, icon: 'Target' },
  investment: { balance: 0, growth: '0%', icon: 'TrendingUp' },
};
```

### 4. Reset seed goals

**File: `src/stores/useGoalsStore.ts`**

Tìm `SEED_GOALS` (4 goals: nhà 6B, emergency 50M, xe 800M, đầu tư 200M).

→ Thay bằng `[]` hoặc giữ 1-2 goal nhẹ nhàng làm onboarding hint với `currentAmount: 0`.

### 5. Reset seed tasks

**File: `src/stores/useTaskStore.ts`**

Tìm `SEED_TASKS` (5 task: freelance, shopee, ...).

→ Thay bằng `[]`.

### 6. Reset wishlist (nếu có seed)

**File: `src/stores/useWishlistStore.ts`**

Tìm `SEED_ITEMS` (nếu có).

→ Thay bằng `[]`.

### 7. Gỡ Dev Bypass Login button

**File: `src/app/(auth)/login/LoginForm.tsx`**

Tìm block (khoảng line 128-149):

```tsx
{/* ⚠️ DEV ONLY — Remove before public launch */}
<button
  onClick={handleDevBypass}
  ...
>
  🛠️ Dev Bypass Login
</button>
```

→ **XÓA hoàn toàn** đoạn JSX này (cả `handleDevBypass` function nếu không còn caller).

Verify sau khi xóa:
```bash
grep -n "DevBypass\|handleDevBypass\|setDemoMode" src/app/\(auth\)/login/LoginForm.tsx
# → 0 matches
```

### 8. Verify không còn debug widget nào lộ state

```bash
grep -rn "JSON.stringify.*null, 2" src/components src/app
grep -rn "NODE_ENV.*development.*<pre>" src/
```

Cả 2 grep nên trả về **0 matches** (đã fix ở commit `3480033` — TransactionInput debug dump). Nếu phát hiện chỗ mới → xóa hoặc gate bằng flag `NEXT_PUBLIC_ENABLE_DEBUG` không phải NODE_ENV.

### 9. Verify auth bootstrap không hard-code demo user

```bash
grep -rn "demo-user-123" src/
```

→ Chỉ còn ở những chỗ KHÔNG ảnh hưởng production (e.g. test file). Không có production code path tạo demo user mặc định.

### 10. Build + lint sạch trước khi push

```bash
npm install   # đảm bảo lockfile fresh
npm run lint  # baseline 49 problems pre-Phase-1 → check không phát sinh thêm
npm run build # phải Compiled successfully
npm run test:three-account  # 194/194 PASS
npm run test:phase2         # all PASS
```

Nếu lint tăng → diff với `git diff` để tìm chỗ mới phát sinh.

---

## Sample diff áp dụng tất cả

Sau khi chạy hết 1-10, `git diff --stat` đại loại sẽ thấy:

```
src/stores/useFinanceStore.ts        | ~30 lines (seed cleared)
src/stores/useBudgetStore.ts         | ~10 lines
src/stores/useDashboardStore.ts      | ~15 lines
src/stores/useGoalsStore.ts          | ~25 lines
src/stores/useTaskStore.ts           | ~35 lines
src/app/(auth)/login/LoginForm.tsx   | ~30 lines (dev bypass block removed)
```

Commit:

```bash
git add -A
git commit -m "chore(release-prep): zero out seed data + remove dev bypass

Prep cho public release per docs/plans/pre-push-checklist.md.

Seed data:
- useFinanceStore: mainBalance/emergency/billFund → 0, transactions []
- useBudgetStore: carryOver 0, categories []
- useDashboardStore: 6 accounts balance 0, contributions {}
- useGoalsStore: goals []
- useTaskStore: tasks []

Dev tooling removed:
- LoginForm: Dev Bypass Login button + handler
- (TransactionInput debug dump đã gỡ ở commit 3480033)

App khi user mới cài về: clean slate, không bypass được login."
```

---

## Sau khi release-prep merged

User thật vào app:
1. Login Google → tạo UserProfile fresh
2. Mọi balance = 0, không có giao dịch giả
3. Bill template có sẵn (template thật cho VN: nhà/điện/nước/internet) — họ edit số tiền theo thực tế
4. Profile có thể đổi tên/avatar/email/năm sinh
5. Nút "Xóa toàn bộ dữ liệu" trong /profile reset về 0 nếu lỡ tay nhập sai → giúp user "làm lại từ đầu" không phải re-install

---

## Rollback nếu release-prep gây vấn đề

Nếu sau release thấy seed cần thiết cho demo/marketing:

```bash
git revert <release-prep-commit-hash>
```

Hoặc tạo branch `demo-data` giữ seed cho video/screenshot.

---

## Update log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-19 | Phase 2 | Initial checklist — list 10 mục cần xử lý trước push |
