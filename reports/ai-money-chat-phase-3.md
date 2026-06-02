# AI Money Chat Phase 3 Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Chot taxonomy danh muc cho AI Money Chat de Phase 4 memory co nen on dinh, khong tao danh muc moi lung tung theo tung mon hang.

## Da hoan thanh

- Them `AI_MONEY_CHAT_TAXONOMY`.
- Map toan bo app categories hien co vao taxonomy.
- Chia category theo direction:
  - `expense`
  - `income`
- Them bucket logic de quan ly item/tag:
  - `food_and_drink`
  - `groceries`
  - `transport`
  - `home_and_living`
  - `shopping`
  - `health`
  - `learning`
  - `bills`
  - `housing`
  - `giving`
  - `entertainment`
  - income buckets
- Them examples item/tag cho cac category de sau nay memory hoc theo item, khong tao category moi.
- Them helper:
  - `getTaxonomyCategory`
  - `getTaxonomyByDirection`
  - `isKnownTaxonomyCategory`
  - `isKnownAppCategory`
  - `getDefaultCategoryId`
  - `getCategoryDisplayName`
- Parser fallback dung default category tu taxonomy.
- Sua normalize ky tu `d` co dau bang Unicode escape `\u0111` de on dinh hon voi encoding.
- Them test consistency giua app categories, keyword rules va taxonomy.

## Files changed

- `src/lib/aiMoneyChat/taxonomy.ts`
- `src/lib/aiMoneyChat/parser.ts`
- `tests/ai-money-chat-parser.test.ts`
- `docs/AI_MONEY_CHAT_ROADMAP.md`
- `reports/ai-money-chat-phase-3.md`

## User flows

Chua co UI moi trong Phase 3. Tac dong nguoi dung la nen tang logic:

- Parser va memory sau nay chi de xuat category hop le.
- Vat pham la `itemTagExamples`/tag, khong bien thanh category moi.
- Unknown expense fallback ve `other`, kem goi y `shopping`/`groceries`.

## Data logic

- Taxonomy hien dang phu het `EXPENSE_CATEGORIES` va `INCOME_CATEGORIES`.
- Expense taxonomy giu trong nguong <= 16 category.
- Income taxonomy giu trong nguong <= 8 category.
- Keyword rules khong duoc tro den category la.

## Tests

- `npm run test:ai-chat` pass.
- `npm run test` pass.
- `npm run build` pass.

## Ket qua

Phase 3 da dat deliverable: category taxonomy on dinh va da co test bao ve consistency.

## Rui ro con lai

- Taxonomy display name dang ASCII de tranh loi encoding trong code; UI van dung label hien co tu `src/data/categories.ts`.
- Chua co memory user correction.
- Chua co co che de user tao category moi co dieu kien.
- Chua gom tag/item vao transaction data model.

## Viec tiep theo

Phase 4: Local Memory.

Can lam:

- Luu user correction khi sua category trong confirmation card.
- Tao memory rule theo keyword normalized.
- Tang hit count/confidence khi lap lai.
- De xuat category tu memory truoc keyword/AI.

