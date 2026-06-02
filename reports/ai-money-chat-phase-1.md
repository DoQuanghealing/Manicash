# AI Money Chat Phase 1 Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Tao local parser de bien cau nhap tieng Viet hang ngay thanh `ParsedMoneyIntent`, chua goi AI va chua luu giao dich.

## Da hoan thanh

- Them keyword taxonomy cho expense/income categories.
- Them `parseMoneyText(input)`.
- Them `normalizeMoneyTextForMemory(input)`.
- Parse duoc cac dang tien:
  - `50k`
  - `1300k`
  - `1tr3`
  - `20tr`
  - `2.500.000`
- Detect duoc intent co ban:
  - expense
  - income
  - transfer draft
  - unknown khi khong co amount
- Detect category co ban:
  - `tra sua` -> `food`
  - `sieu thi` -> `groceries`
  - `luong` -> `salary`
  - `dau hu` -> `food`
  - `thuoc dong y` -> `health`
  - `shopee` -> `shopping`
- Unknown category fallback ve `other` va bat confirmation.

## Files changed

- `src/lib/aiMoneyChat/categoryKeywords.ts`
- `src/lib/aiMoneyChat/parser.ts`
- `tests/ai-money-chat-parser.test.ts`
- `package.json`
- `docs/AI_MONEY_CHAT_ROADMAP.md`
- `reports/ai-money-chat-phase-1.md`

## User flows

Phase nay chua ket noi UI save flow. Parser da san sang de Phase 2 dung trong `/chat`:

- User nhap: `mua tra sua 50k`
- Parser tra:
  - type: `expense`
  - amount: `50000`
  - categoryId: `food`
  - confidence: `high`

## Data logic

- Parser chi tra object, khong mutate store.
- Khong goi AI.
- Khong goi Firebase.
- `needsConfirmation=true` khi confidence khong cao.
- Unknown item khong tao category moi.

## Tests

- `npm run test:ai-chat` pass.
- `npm run test` pass.
- `npm run build` pass.

## Ket qua

Phase 1 da dat deliverable: `parseMoneyText(input)` hoat dong local va co test cho cac cau tieng Viet sinh hoat.

## Rui ro con lai

- Tu dien keyword con mong, can mo rong dan bang memory/user correction o Group 2.
- Parser chua xu ly cau nhieu giao dich trong mot input.
- Transfer/split intent moi la draft detection, chua co confirmation flow.
- Chua co ngay giao dich tu ngon ngu tu nhien nhu `hom qua`, `thu 2`.

## Viec tiep theo

Phase 2: ket noi `/chat` voi parser, hien confirmation card, cho sua category/amount/type va chi luu vao finance store sau khi user bam xac nhan.

