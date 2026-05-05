# Bugs - Synthetic User Testing

## BUG #1 - [Severity: High]

- File: src/stores/useFinanceStore.ts; src/components/ui/TransactionInput.tsx
- Repro: Persona Minh, Ngay 14, nhap bu giao dich ngay 12-13. Persona Tuan, Ngay 12, nhap bu giao dich ngay 8-11.
- Expected: Flow nhap giao dich cho phep chon ngay giao dich cu; `dateKey` cua transaction phai la ngay duoc chon va monthly snapshot cua thang do duoc tinh lai.
- Actual: `addTransaction` tu tao `date`, `dateKey` bang `new Date()` va `TransactionInput` khong truyen ngay tuy chon. Search source chua thay action backdate rieng.
- Invariant violated: #7 khi noi adapter vao UI/store that.
- Suggested fix: them truong ngay giao dich vao input va cho `addTransaction` nhan optional transaction date; sau do recalculate budget/month snapshot theo thang cua transaction date.

## BUG #2 - [Severity: Medium]

- File: src/stores/useFinanceStore.ts; src/app/(app)/ledger/_components/LedgerContent.tsx
- Repro: Phase 2, Persona Huong, Ngay 38, xoa mot giao dich nhap sai cach day 5 ngay.
- Expected: Co action xoa transaction va rollback balance, category spent, monthly snapshot, chart contribution neu lien quan.
- Actual: Source hien tai khong thay `deleteTransaction/removeTransaction`; ledger chi loc/xem transaction.
- Invariant violated: #8 khi toi Phase 2.
- Suggested fix: thiet ke action xoa/sua transaction trong FinanceStore truoc, gom rollback side effects vao mot duong duy nhat.

> Note: day la finding tu doc source trong luc chay Phase 0+1 setup, can verify lai bang UI/browser truoc khi fix theo canh bao false positive cua plan.
