# AI Money Chat Phase 9 Report

Date: 2026-06-02
Branch: codex/ai-money-chat

## Muc tieu

Them Bank Balance Reconciliation de nguoi dung doi chieu so du ngan hang voi so dang luu trong ManiCash.

Trong phase nay, muc tieu la kiem tra lech so du, chua tu dong sua tien trong app.

## Da hoan thanh

- Them pure reconciliation engine `createBalanceReconciliationReport`.
- Gom he 6 tai khoan hien tai ve 3 nhom nguoi dung de hieu:
  - Thu nhap = `accounts.income.balance`.
  - Chi tieu = `accounts.spending.balance + accounts.fixed_bills.balance`.
  - Tiet kiem = `reserve + goals + investment`.
- Them form doi chieu trong `/chat`.
- Nguoi dung nhap so du thuc te cua 3 tai khoan ngan hang.
- ManiCash bao:
  - Tong so trong app.
  - Tong so ngan hang da nhap.
  - Tong chenh lech.
  - Tai khoan nao khop, lech nhe, lech lon.
  - Goi y hanh dong tiep theo.
- Them unit test rieng cho reconciliation.

## Files changed

- `src/lib/aiMoneyChat/balanceReconciliation.ts`
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`
- `tests/ai-money-reconciliation.test.ts`
- `package.json`
- `docs/AI_MONEY_CHAT_ROADMAP.md`

## User flows

1. Nguoi dung vao `/chat`.
2. Bam `Doi chieu so du`.
3. App hien 3 o nhap:
   - Tai khoan thu nhap.
   - Tai khoan chi tieu.
   - Tai khoan tiet kiem.
4. Nguoi dung nhap so du thuc te tren ngan hang.
5. App bao cao chenh lech va nhac tim giao dich bi quen ghi.

## Data logic

- Sai lech <= 1.000 VND: xem la khop.
- Sai lech <= 50.000 VND: lech nhe.
- Sai lech > 50.000 VND: lech lon, can kiem tra truoc khi tin bao cao.
- Engine khong goi AI va khong ton credit.
- Engine khong tu dong mutate finance/dashboard store.

## Tests

Da chay:

- `npm run test:ai-reconciliation`
- `npm run test:ai-checkin`
- `npm run test:ai-reaction`
- `npm run test:ai-quota`
- `npm run test:ai-fallback`
- `npm run test:ai-memory`
- `npm run test:ai-chat`
- `npm run test`
- `npm run build`

Tat ca pass.

## Ket qua

Phase 9 da hoan thanh o muc beta local. Nguoi dung da co cach doi chieu so du nhanh trong chat, giup giam rui ro "thieu 1 giao dich lam sai ca he thong".

## Rui ro con lai

- Chua co thao tac "cap nhat so du app" sau khi phat hien lech.
- Chua luu lich su cac lan doi chieu.
- Chua gan voi tai khoan ngan hang cu the trong `useWalletBankStore`.
- Chua co flow goi y tim giao dich nghi bi thieu theo ngay/danh muc.

## Viec tiep theo

Group 5 Phase 11: HTML CFO Report.

- Dung du lieu thu/chi/muc tieu/budget de tao report thang.
- Giu report dep, hien dai, khong qua dev.
- AI narration de sau khi co local report va aggregate data on dinh.
