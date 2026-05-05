# Synthetic User Testing - Intermediate Phase 0+1

## Scope

- Window: ngay 1-30, bat dau 2025-08-01.
- Layer 1: deterministic ledger + invariant checks.
- Layer 2: da tao diary 30 ngay dau va UX findings tam thoi; se append tiep sau Phase 2/3.
- App code khong bi sua trong phase run.

## Summary

- Personas run: 3
- Total invariant violations: 0
- Status: Phase 0+1 da chay xong tren synthetic adapter. Chua noi vao browser/Zustand that vi repo chua co test runner/path-alias loader on dinh.

## Persona Totals

| Persona | Days | Income | Expense | Savings | Violations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Minh | 28 | 33.333.333d | 18.593.848d | 8.333.333d | 0 |
| Huong | 30 | 22.000.000d | 17.130.686d | 6.600.000d | 0 |
| Tuan | 28 | 9.333.334d | 7.560.000d | 1.400.000d | 0 |

## Violations By Invariant

- Khong co invariant violation trong adapter mo phong Phase 0+1.

## First Violations

- Khong co violation tu dong de hien thi.

## Phase 2 Adjustments Proposed

- Noi them adapter voi store/browser that truoc khi chay edge case xoa giao dich va sua bill, neu khong report se chi la mo phong tham chieu.
- Backdate la case can verify truc tiep trong UI vi source hien tai khong thay date picker trong TransactionInput.
- Delete transaction la case Phase 2 can verify truc tiep vi source hien tai chua thay action xoa giao dich trong FinanceStore.
