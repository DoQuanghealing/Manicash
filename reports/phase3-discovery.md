# Phase 3 Discovery Report

## 1.1 XP System Audit

### Defined actions in xpEngine
```typescript
export type XPActionType =
  | 'INCOME_LOGGED'
  | 'EXPENSE_LOGGED'
  | 'RESIST_SPENDING'
  | 'MISSION_COMPLETE'
  | 'DAILY_STREAK'
  | 'STREAK_BONUS'
  | 'BUDGET_ON_TRACK'
  | 'SAVINGS_DEPOSIT'
  | 'TASK_COMPLETE'
  | 'TASK_OVERDUE'
  | 'WEBHOOK_CONFIRMED';
```

### Where awardXP is called (verified)
| File | Line | Action | Notes |
|------|------|--------|-------|
| `TransactionInput.tsx` | 93 | `INCOME_LOGGED` / `EXPENSE_LOGGED` | ✅ Đã wired. Dùng getState().awardXP. |
| `TransactionInput.tsx` | 288 | `RESIST_SPENDING` | ✅ Đã wired. Truyền via `onResist` cho `BreathGate`. |
| `WishlistPopup.tsx` | 71 | `SAVINGS_DEPOSIT` | ✅ Đã wired khi nạp tiền vào mục tiêu. |
| `useDashboardStore.ts` | 311 | `SAVINGS_DEPOSIT` | ✅ Đã wired khi bỏ ống heo. |
| `useGoalsStore.ts` | 95 | `SAVINGS_DEPOSIT` | ✅ Đã wired khi đóng góp tiền mục tiêu dài hạn. |
| `useTaskStore.ts` | 159 | `TASK_COMPLETE` | ✅ Đã wired, bao gồm cả earlyBonus. |
| `useTaskStore.ts` | 179 | `TASK_OVERDUE` | ✅ Đã wired để trừ XP penalty. |
| `useBudgetStore.ts` | 219 | `BUDGET_ON_TRACK` | ✅ Đã wired trong logic rollover cuối tháng. |
| `useMissionStore.ts` | 31 | `MISSION_COMPLETE` | ✅ Đã wired. |
| `useAuthStore.ts` | 139 | `DAILY_STREAK` | ✅ Đã wired khi check streak. |
| `useAuthStore.ts` | 141 | `STREAK_BONUS` | ✅ Đã wired cho mốc 7 ngày. |
| `usePendingTransactions.ts` | 110 | `WEBHOOK_CONFIRMED` | ✅ Đã wired. |

### Missing wires (display only, not actually awarded)
| Where | Action expected | Severity |
|-------|----------------|----------|
| **KHÔNG CÓ** | N/A | Khác với `PENDING_FEATURES.md` đã mô tả, kiểm tra code thực tế cho thấy các missing wires (RESIST_SPENDING, TASK_COMPLETE, v.v.) **đều đã được hook** gọi `awardXP` đầy đủ. File `PENDING_FEATURES.md` bị outdated về phần này. |

### Orphan actions (defined but never called)
- **KHÔNG CÓ**. Toàn bộ 11 action trong định nghĩa đều được sử dụng ít nhất một lần.

---

## 1.2 Toast Audit
- **Hiện trạng:** Codebase **ĐÃ CÓ** hệ thống Toast riêng, hoàn chỉnh, không cần cài thêm thư viện (nằm tại `src/components/ui/XPToast.tsx`).
- **Pattern:** Sử dụng `EventTarget` singleton tại `src/lib/xpEvents.ts`. Hàm `useAuthStore.awardXP` sẽ emit event `xp_granted`. Component `<XPToastHost />` (được mount 1 lần ở `src/app/(app)/layout.tsx`) lắng nghe event này để render toast theo dạng xếp chồng (stack) góc trên bên phải (top-right). Có sẵn animation và tự dismiss sau 3s.
- **Đề xuất:** Không cần implement thêm, UX/UI hiện tại đã đúng chuẩn.

---

## 1.3 Demo Mode Audit  
- **Vấn đề Bypass Login:** Nút **"DEV BYPASS LOGIN"** vẫn còn nằm lộ thiên trong file `src/app/(auth)/login/LoginForm.tsx` (dòng 126). 
- **Quirks đã fix:** Các lỗi trong tài liệu cũ như "Profile null ở demo mode" hoặc "Rollover tháng đầu tiên sai delta XP" thực tế **đã được fix** (profile cứng đã được set tại hàm `handleDevBypass` và lazy-init delta XP đã được thêm vào `useBudgetStore`).
- **Lỗi hiện tại:** Nếu người dùng thường bấm nhầm nút Bypass, app sẽ ghi đè session của họ bằng account `demo-user-123` làm hỏng luồng trải nghiệm thật. Cần phải tháo gỡ nút bypass này.

---

## 1.4 SMS Template Audit
- **Vị trí file:** Nằm tại `src/lib/sms/parsers/*` (đã có file cho VCB, VPBank, TPBank và một file common xử lý Regex chung).
- **Ngân hàng hỗ trợ (concept):** Đã phân chia interface cho 7 bank nhưng hiện chỉ có VCB, VPBank, TPBank có mock file.
- **Test kết quả parse:** Khi test logic `parseStandardSms` từ `_common.ts` với chuỗi `TK 0001234567890 (VCB): -250,000 VND luc 25/04/2026 14:30. So du 1,234,567 VND. ND: GRAB FOOD HCMC`, regex chung parse ra số tiền khá ổn, nhưng sẽ thiếu tính ổn định khi format biến đổi quá phức tạp. Hiện tại chưa cần fix gấp vì là tính năng PRO.

---

## ⚖️ ĐỀ XUẤT IMPLEMENTATION

### Priority order
Do phần lớn core bugs mô tả trong tài liệu đã được ai đó fix, scope công việc hiện tại khá nhẹ nhàng:
1. **Low (Demo Mode Polish):** Xóa nút DEV BYPASS LOGIN trong LoginForm để chuẩn bị public. (Quick win).
2. **Low (Documentation):** Cập nhật lại file `PENDING_FEATURES.md` để bỏ đi những TODO đã hoàn thành (XP Missing Wires, Toast, Demo mode data quirks) tránh gây nhầm lẫn về sau.
3. **Low (SMS Templates):** Thêm 1-2 unit test thực tế cho file `vietcombank.ts` bằng sms thật để đảm bảo parser chung không bị crash (tính năng PRO nên không block luồng release).

### Plan từng task
**Task 1: Clean up Demo Bypass (Login)**
- **File sửa:** `src/app/(auth)/login/LoginForm.tsx`
- **Thay đổi:** Xóa toàn bộ đoạn code render `<button onClick={handleDevBypass}>` và function `handleDevBypass` không cần thiết.
- **Risk:** Zero. Không đụng business logic.

**Task 2: Clean up Pending Features Document**
- **File sửa:** `PENDING_FEATURES.md`
- **Thay đổi:** Gạch bỏ/xóa các mục 1, 2, 3, 4, 5, 6 trong phần XP system gaps và Demo data quirks vì codebase đã implement.
- **Risk:** Zero.

### Câu hỏi quyết định
1. Anh có muốn em dọn dẹp luôn nút Bypass Login trong hôm nay không ạ?
2. Có cần em viết thêm Unit Test cho SMS Parser của VCB luôn không, hay tạm thời ưu tiên các flow UI khác?
