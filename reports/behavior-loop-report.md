# Behavior Loop Report

Date: 2026-06-02
Branch: codex/ai-money-chat

## Muc tieu

Group 4 bien AI Money Chat tu cong cu ghi giao dich thanh quan gia tai chinh co vong lap hanh vi:

- Phan hoi sau khi thu/chi.
- Check-in dung thoi diem trong ngay.
- Nhac doi chieu so du de bao cao khong bi sai.

## Da hoan thanh

- Phase 7: Money Reaction Engine.
- Phase 8: Daily Check-ins 12h/21h.
- Phase 9: Bank Balance Reconciliation.

## Files changed

- `src/lib/aiMoneyChat/moneyReaction.ts`
- `src/lib/aiMoneyChat/dailyCheckin.ts`
- `src/lib/aiMoneyChat/balanceReconciliation.ts`
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`
- `tests/ai-money-reaction.test.ts`
- `tests/ai-money-daily-checkin.test.ts`
- `tests/ai-money-reconciliation.test.ts`

## User flows

Money reaction:

- User confirm giao dich.
- App luu giao dich.
- Lord Diamond phan hoi theo loai giao dich, so tien, danh muc va muc tieu.

Daily check-in:

- User bam `12h` hoac `21h`.
- App hien bao cao thu/chi, dong tien rong, nguong chi con lai, tiet kiem uoc tinh va bill status.

Balance reconciliation:

- User bam `Doi chieu so du`.
- User nhap so du ngan hang cho 3 nhom tai khoan.
- App bao lech va goi y kiem tra giao dich bi thieu.

## Data logic

- Tat ca logic Group 4 local-first, khong goi AI.
- Khong co flow nao tu dong ghi tien ma khong co xac nhan.
- Reconciliation chi bao lech, chua sua so du.
- Check-in dung transactions, budget, bill fund va goals hien co.

## Tests

Da chay:

- `npm run test:ai-reaction`
- `npm run test:ai-checkin`
- `npm run test:ai-reconciliation`
- `npm run test:ai-quota`
- `npm run test:ai-fallback`
- `npm run test:ai-memory`
- `npm run test:ai-chat`
- `npm run test`
- `npm run build`

Tat ca pass.

## Ket qua

Group 4 da hoan thanh ban beta local. AI Money Chat bay gio co vong lap hanh vi co gia tri: ghi tien, phan hoi, bao cao nhanh, doi chieu so du.

## Rui ro con lai

- Chua co scheduler/push notification that cho 12h/21h.
- Chua co tone setting cho Money Reaction.
- Chua co lich su reconciliation.
- Chua co flow tu dong tim transaction bi thieu khi so du lech.
- Seed data/label tieng Viet trong mot so store cu dang bi loi encoding tu truoc.

## Viec tiep theo

Group 5: Monthly CFO Report.

Nen lam local HTML report truoc, AI narration sau. Report thang se co gia tri Pro cao hon khi parser, memory, quota va behavior loop da on dinh.
