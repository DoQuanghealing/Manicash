# AI Money Chat Phase 2 Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Ket noi `/chat` voi local parser, hien confirmation card co the sua, va chi luu giao dich sau khi user bam xac nhan.

## Da hoan thanh

- Noi chat input voi `parseMoneyText(input)`.
- Hien message thread co user/assistant/system message.
- Them example chips:
  - `mua tra sua 50k`
  - `di sieu thi het 1300k`
  - `nhan luong 20tr`
- Tao confirmation card cho:
  - Loai giao dich.
  - So tien.
  - Danh muc.
  - Vi.
  - Ngay.
  - Ghi chu.
- Cho user sua cac field truoc khi luu.
- Them goi y category alternatives khi parser co du lieu.
- Them helper `recordConfirmedMoneyIntent`.
- Khi confirm:
  - Ghi vao `useFinanceStore.addTransaction`.
  - Mirror income/expense sang `useFinanceCoreStore.execute`.
  - Award XP qua `useAuthStore.awardXP`.
- Khong goi AI.
- Khong ghi Firebase truc tiep tu chat.
- Khong them `/chat` vao bottom nav de tranh doi luong chinh qua som.

## Files changed

- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`
- `src/lib/aiMoneyChat/recordIntent.ts`
- `docs/AI_MONEY_CHAT_ROADMAP.md`
- `reports/ai-money-chat-phase-2.md`
- `reports/ai-money-chat-foundation.md`

## User flows

Flow chinh:

1. User mo `/chat`.
2. User nhap `mua tra sua 50k`.
3. Parser tra expense/food/50.000 VND.
4. UI hien confirmation card.
5. User co the sua category/amount/type/date/note.
6. User bam `Xac nhan luu`.
7. Giao dich duoc them vao so sach va co system message bao da luu.

## Data logic

- Chat save dung legacy store chinh de giu side-effect hien co:
  - Balance update.
  - Budget spending update.
  - Streak update.
- Finance core duoc mirror sau legacy transaction.
- Neu finance core mirror fail, legacy transaction van giu lai nhu flow `TransactionInput` hien tai.
- Chat hien tai chi save income/expense. Transfer/split se lam sau.

## Tests

- `npm run build` pass.
- `npm run test:ai-chat` pass.
- `npm run test` pass.

## Ket qua

Group 1 Phase 2 da dat deliverable: chat co parser, confirmation card va save flow an toan.

## Rui ro con lai

- Save legacy store va finance core van chua atomic.
- Chua co BreathGate 30s trong chat cho expense lon.
- Chua co undo sau khi save.
- Chua co memory learning khi user sua category.
- Chua parse nhieu giao dich trong mot cau.
- Chua parse ngay tu nhien nhu `hom qua`.

## Viec tiep theo

Group 2 Phase 3: Category Taxonomy. Can chot danh muc chinh, map category hien co va thiet ke item/tag de tranh tao qua nhieu category.

