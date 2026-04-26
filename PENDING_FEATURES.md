# PENDING FEATURES — manicash

Discoveries phát hiện trong quá trình implement task XP Triggers (branch `feat/xp-triggers`) — ngoài scope, không tự sửa, track ở đây để follow-up.

## XP system gaps

### 1. Existing XP types compute-only, không persist
**File**: `src/components/ui/TransactionInput.tsx:87`

`calculateXP()` được gọi cho `INCOME_LOGGED` và `EXPENSE_LOGGED` nhưng kết quả chỉ truyền vào `CelebrationModal` để hiển thị "+X XP". Không có `awardXP()` call → user.xp không bao giờ tăng. Nghĩa là toàn bộ XP system trước task này là **cosmetic display only**.

**Fix**: thêm `useAuthStore.getState().awardXP(xpAction)` ngay sau `calculateXP()`. Sau task này hạ tầng đã có (`useAuthStore.awardXP` đã build).

### 2. RESIST_SPENDING / TASK_COMPLETE / TASK_OVERDUE chưa wire ở đâu
**Files**: chỉ tồn tại trong `src/types/gamification.ts` + `src/lib/xpEngine.ts`. Không có caller nào.

- `RESIST_SPENDING`: cần hook khi user nhấn "Cancel" trên `BreathGate.tsx` (đang reject expense lớn).
- `TASK_COMPLETE`: cần hook trong `useTaskStore.completeTask` (đã có function, chưa grant XP).
- `TASK_OVERDUE`: cần hook trong `useTaskStore.deleteOverdueTask` (đang gắn penalty multiplier qua `xpPenalties`, nhưng chưa trừ XP trực tiếp -15).

**Fix**: thêm `useAuthStore.getState().awardXP(...)` ở 3 chỗ trên.

### 3. XP toast UI feedback chưa có
Per task spec Phần 1, cần toast "+X XP — Đã gửi tiết kiệm" khi SAVINGS_DEPOSIT. Hiện tại không có toast lib → grant XP silent. Tương tự cho DAILY_STREAK, BUDGET_ON_TRACK.

**Fix**: chọn 1 trong 3 hướng:
- (a) Tạo `<XPToast>` component nhẹ + global event bus.
- (b) Wrap `useAuthStore.awardXP` để emit qua `EventTarget`, listener mount ở app shell render toast.
- (c) Cài lib `sonner` hoặc `react-hot-toast`, wire vào `awardXP` để emit.

## Demo data quirks

### 4. UserProfile null trong demo mode
`useAuthStore.user` mặc định `null`. Mọi `awardXP` no-op cho đến khi profile được khởi tạo qua login (Firebase) hoặc demo seed.

`MoneyContent.tsx` dùng hardcoded `DEMO_XP = 1_250` cho HallOfFame — bypass store. Sau khi awardXP thực sự active, demo seed cần khởi tạo `useAuthStore.user` với giá trị có ý nghĩa thay vì null.

### 5. `xpAtMonthStart` initial = 0 → first-month rollover XP earned bị inflated
`useBudgetStore.xpAtMonthStart` init = 0. Nếu demo user bắt đầu tháng với xp=1250, rollover đầu tiên sẽ report "+1250 XP" sai. Sau lần đầu, hoạt động đúng.

**Fix**: khi auth profile được set lần đầu, đồng bộ `xpAtMonthStart = user.xp`. Hoặc lazy: rollover đầu tiên bỏ qua field XP nếu xpAtMonthStart === 0 và user.xp > 0.

### 6. Bill `isPaid` flag không reset khi rollover
Pre-existing TODO trong `src/hooks/useCFOSnapshot.ts:53` — đã ghi nhận. Dẫn đến report "bills paid on time" có thể sai sau tháng đầu. Cần fix trong `checkAndRollover` (clone fixedBills + reset isPaid).

## Architecture

### 7. Cross-store calls (`useAuthStore.getState().awardXP()` từ trong store khác)
Pattern này dùng trong:
- `useGoalsStore.addFundsToGoal`
- `useDashboardStore.addFundContribution`
- `useFinanceStore.addTransaction`
- `useBudgetStore.checkAndRollover`
- `useMissionStore.completeMission`

Hoạt động OK với Zustand vì mỗi store là singleton. Nhưng làm test khó hơn (không thể mock dễ). Future: cân nhắc event bus hoặc inject awardXP qua param khi store cần test.
