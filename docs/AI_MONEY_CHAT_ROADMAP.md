# ManiCash AI Money Chat Roadmap

Last updated: 2026-06-05

## Muc dich tai lieu

Tai lieu nay luu lai boi canh san pham, cac quyet dinh da chot va roadmap trien khai AI Money Chat cho ManiCash. Lan sau khi tiep tuc, hay yeu cau Codex doc file nay truoc:

```text
Doc docs/AI_MONEY_CHAT_ROADMAP.md roi tiep tuc phase dang lam.
```

## Trang thai hien tai

- Branch lam viec: `codex/ai-money-chat`
- Group 1 Phase 0 da hoan thanh ngay 2026-06-02.
- Da co route beta `/chat`, feature flag `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED`, contract `ParsedMoneyIntent` va discovery doc.
- Group 1 Phase 1 da hoan thanh ngay 2026-06-02.
- Da co local parser `parseMoneyText(input)`, keyword taxonomy va test parser.
- Group 1 Phase 2 da hoan thanh ngay 2026-06-02.
- Da co confirmation card va save flow cho income/expense trong `/chat`.
- Group 1 da hoan thanh.
- Group 2 Phase 3 da hoan thanh ngay 2026-06-02.
- Da co taxonomy category, app category mapping va test consistency.
- Group 2 Phase 4 da hoan thanh ngay 2026-06-02.
- Da co local memory store, user correction learning va test memory.
- Group 2 Phase 5 da hoan thanh ngay 2026-06-02.
- Da co AI fallback API/client flow, server cost gate va strict validation.
- Group 2 da hoan thanh.
- Group 3 Phase 6 da hoan thanh ngay 2026-06-02.
- Da co quota core, Firestore usage charge va Pro gating cho AI fallback.
- Group 4 Phase 7 da hoan thanh ngay 2026-06-02.
- Da co Money Reaction Engine local-first, tich hop sau khi confirm giao dich trong chat beta.
- Group 4 Phase 8 da hoan thanh ngay 2026-06-02.
- Da co Daily Check-ins 12h/21h local-first trong chat beta.
- Group 4 Phase 9 da hoan thanh ngay 2026-06-02.
- Da co Bank Balance Reconciliation local-first trong chat beta.
- Group 4 da hoan thanh.
- Group 5 da hoan thanh ngay 2026-06-02.
- Phase 11 (HTML CFO Report): route `/chat`-adjacent `/report`, editorial finance report local-first.
- Phase 12 (Export): CSV/Excel (UTF-8 BOM) + In/Luu PDF (window.print + print stylesheet), khong them dependency.
- Phase 13 (AI CFO Narration): local template Lord Diamond cho Free/fallback, API `/api/ai-money-chat/cfo-narration` charge credit Pro, chi gui summary da aggregate.
- Group 6 dang trien khai.
- Phase 14 (Earning Planner) da hoan thanh ngay 2026-06-02: `src/lib/aiMoneyChat/earningPlanner.ts` (detect intent + parse amount/duration/worktype + suggest checklist), tich hop draft card trong `/chat` luu vao `useTaskStore`. Test: `npm run test:ai-earning`.
- Phase 15 (QA & Store readiness) da hoan thanh phan analytics + QA ngay 2026-06-02: them `src/lib/analytics/events.ts` (trackEvent production-safe, gate bang NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID), wire event chat_parse/chat_confirm/chat_correction/ai_fallback/cfo_narration/cfo_report_view/report_export/earning_task_created/reconciliation_check; them `test:ai-all` aggregate + `test:analytics`. Test parser/quota tieng Viet pass.
- Phase 10 (Receipt scan): HOAN lai theo quyet dinh 2026-06-02 (uu tien chot san pham ban duoc truoc). Khi lam: chot huong OCR (tesseract.js client mien phi vs cloud vision + credit).
- PLAN.md Phase 2 (Remove dev surface) da hoan thanh TOAN BO ngay 2026-06-05:
  - Phase 2.1: Dev Bypass Login da xoa.
  - Phase 2.2: SMS Webhook da an sau feature flag `isSmsWebhookEnabled()`.
  - Phase 2.3: Seed data (transactions, balances, budgets) da gate sau `NEXT_PUBLIC_DEMO_MODE=true`.
  - Phase 2.4: Audit UI strings sach.
  - Phase 2.5 Acceptance: 3/3 check pass. Da push len GitHub branch `codex/ai-money-chat`.
  - Bonus: Xoa dead code `isDemoMode`/`setDemoMode` khoi `useAuthStore` va `AuthProvider`.
- Bug fixes ngay 2026-06-05:
  - Them `suppressHydrationWarning` vao `<body>` trong `layout.tsx` (browser extension inject attributes).
  - Fix `useProStatus` infinite loop bang `useShallow` (Zustand selector tra object moi moi lan).
  - `.env.local`: da them day du 6 Firebase Client SDK keys (`NEXT_PUBLIC_FIREBASE_*`).
- Viec tiep theo: PLAN.md Phase 3 (Compliance content) — Privacy Policy, ToS, account deletion flow (da co san mot phan, can kiem tra lai).
- Da trien khai truoc do tren `main`:
  - Dang xuat.
  - Yeu cau xoa tai khoan.
  - Huy xoa tai khoan trong 30 ngay neu dang nhap lai.
  - Cron xoa tai khoan qua `CRON_SECRET`.
  - Cai thien feedback dang nhap Google va layout man login.
- Can tiep tuc tu roadmap AI Money Chat ben duoi, khong bat dau lai tu dau.

Tai lieu Phase 0:

- `docs/AI_MONEY_CHAT_PHASE0_DISCOVERY.md`
- `reports/ai-money-chat-phase-0.md`
- `reports/ai-money-chat-phase-1.md`
- `reports/ai-money-chat-phase-2.md`
- `reports/ai-money-chat-foundation.md`
- `reports/ai-money-chat-phase-3.md`
- `reports/ai-money-chat-phase-4.md`
- `reports/ai-money-chat-phase-5.md`
- `reports/financial-memory-report.md`
- `reports/ai-cost-control-report.md`
- `reports/ai-money-chat-phase-7.md`
- `reports/ai-money-chat-phase-8.md`
- `reports/ai-money-chat-phase-9.md`
- `reports/behavior-loop-report.md`

## Van de san pham can giai quyet

ManiCash hien co nhieu tinh nang tai chinh tot, nhung nguoi dung moi co the thay phuc tap. Huong cai tien la dua AI Money Chat thanh cua vao chinh:

- Nguoi dung nhap tu nhien: `mua tra sua 50k`, `di sieu thi het 1300k`, `nhan luong 20tr`.
- He thong tu nhan dien:
  - Loai giao dich: thu / chi / tiet kiem / chuyen quy / nhiem vu kiem tien.
  - Danh muc: do an, sieu thi, bill, nha cua, suc khoe, giai tri...
  - So tien: VND, ho tro cach viet `50k`, `1300k`, `1tr3`, `20tr`.
  - Ghi chu va tag neu co.
- Neu he thong khong chac, hien card de nguoi dung xac nhan hoac chon danh muc.
- Sau khi nguoi dung sua, he thong ghi nho cach phan loai cho lan sau.

Muc tieu: dung chat de don gian hoa thao tac, nhung backend van giu cau truc tai chinh dang co.

## Nguyen tac kien truc

1. Local-first truoc, AI sau
   - Parser local xu ly cac cau pho bien.
   - Memory local ghi nho cach nguoi dung phan loai.
   - AI chi dung khi parser khong chac hoac can tu van sau.

2. Khong tao qua nhieu danh muc
   - Giu khoang 12-16 danh muc chinh on dinh.
   - Vat pham la `itemName` hoac `tag`, khong phai cu mon la mot category.
   - Vi du:
     - `kem danh rang` -> Nha cua / Cham soc ca nhan tuy nguoi dung chon.
     - `moc phoi do` -> Nha cua.
     - `bai tarot` -> Giai tri / Tam linh theo thiet lap nguoi dung.

3. AI khong duoc phep tu ghi tien khi confidence thap
   - Confidence cao: co the tao giao dich va cho undo.
   - Confidence trung binh: tao draft confirmation card.
   - Confidence thap: hoi lai bang 2-3 lua chon.

4. Chi phi AI phai duoc kiem soat bang credit/quota
   - Free: local parser, memory co ban, report co ban.
   - Pro: AI fallback, CFO report sau, receipt scan, tu van ca nhan hoa.
   - Hard cap chi phi AI noi bo: toi da 15.000 VND/user/thang cho goi Pro 49.000 VND.

5. Bao cao phai doc nhu bao cao tai chinh ca nhan, khong nhu dashboard dev
   - Co nhan xet CFO ngan gon.
   - Co bieu do de hieu nhanh.
   - Co muc hanh dong thang sau.

## Goi y hien thi duoi o chat

Dong nho duoi input chat nen co noi dung:

```text
Goi y: de ManiCash chinh xac hon, hay tach 3 tai khoan ngan hang cho Thu nhap, Chi tieu va Tiet kiem. Doi chieu so du dinh ky vi thieu 1 giao dich co the lam lech bao cao.
```

Co the rut gon tren mobile:

```text
Doi chieu so du dinh ky. Thieu 1 giao dich co the lam lech bao cao.
```

## AI va chi phi

De xuat model ban dau: GPT-4.1 mini hoac model tuong duong chi phi thap.

Gia tham chieu da tinh:

- Input: khoang 0.40 USD / 1M tokens.
- Cached input: khoang 0.10 USD / 1M tokens.
- Output: khoang 1.60 USD / 1M tokens.
- Ty gia gia dinh: 26.000 VND / USD.

Uoc tinh:

- 1 yeu cau parse ngan: 500 input + 100 output tokens -> khoang 9-10 VND.
- Bao cao ngan: khoang 20-30 VND.
- CFO report sau: khoang 50-100 VND.

Goi Pro 49.000 VND/thang:

- Nen cap khoang 1.500 AI credits/thang.
- 1 credit noi bo nen tuong duong toi da khoang 10 VND chi phi AI.
- Muc tieu chi phi AI: 8.000-12.000 VND/user/thang.
- Hard cap: 15.000 VND/user/thang.

## Financial Memory

Memory khong phai training model. Day la lop tri nho san pham nam tren local/Firebase:

```ts
type MemoryRule = {
  keyword: string;
  normalizedKeyword: string;
  categoryId: string;
  accountId?: string;
  tags?: string[];
  confidence: number;
  source: "seed" | "user_confirmed" | "ai_suggested";
  hitCount: number;
  lastUsedAt: string;
};
```

Nguon du lieu:

- Seed dictionary cua ManiCash.
- Lich su sua danh muc cua nguoi dung.
- Tu khoa lap lai trong giao dich.
- Context: gio, ngay, noi dung ghi chu, merchant neu co.

Nguyen tac:

- Neu nguoi dung sua `kem danh rang` vao `Nha cua` 2-3 lan, lan sau tu uu tien `Nha cua`.
- Neu tu khoa la la, de xuat danh muc chinh thay vi tao category moi.
- Chi de nguoi dung tao danh muc moi khi that su lap lai nhieu lan hoac co nhu cau ro.

## Money Reaction Engine

Them lop phan ung cam xuc cua quan gia:

- Khi chi tieu: nhac nhe, phan nan dang yeu, hoac canh bao neu vuot nguong.
- Khi thu tien: chuc mung va goi y chia tien.
- Khi tiet kiem: ghi nhan tien do muc tieu.
- Khi chi theo cam xuc: lien ket voi wishlist/cooldown.

Tone mode de sau nay ca nhan hoa:

- Diu dang.
- Ca khia dang yeu.
- Ky luat thep.
- Lord Diamond.

Vi du:

```text
Omg, 350.000 VND cho Shopee nua roi. Neu giu lai khoan nay moi thang, muc tieu mua xe cua ban co the ve som hon khoang 4 thang.
```

Can giu ranh gioi: vui, nhac nho hanh vi, khong lam nguoi dung thay bi xau ho qua muc.

## Receipt va screenshot banking

Khong gui anh truc tiep len AI lon theo mac dinh vi ton token/chi phi. Flow de xuat:

1. OCR anh.
2. Parser local lay tong tien, ngay, merchant, cac dong hang neu co.
3. Gom nhom theo danh muc.
4. AI chi xu ly dong khong ro.
5. Nguoi dung chon:
   - Chi luu tong tien.
   - Tach theo danh muc.
   - Tach chi tiet tung dong.

Credit de xuat:

- Screenshot chuyen khoan: 2-3 credits.
- Hoa don chi lay tong tien: 3 credits.
- Hoa don tach danh muc: 8-20 credits tuy do dai.

## Monthly CFO Report

Bao cao nen la HTML trong app truoc, export PDF/Excel sau.

Noi dung report:

1. CFO Summary
   - Thang nay ban on / can chu y / dang nguy hiem.
   - 3 insight quan trong nhat.

2. Financial Health Score
   - Diem tong.
   - Cashflow score.
   - Spending discipline.
   - Savings progress.
   - Goal progress.
   - Income growth.

3. Cashflow
   - Thu nhap.
   - Chi tieu.
   - Tiet kiem.
   - Net cashflow.
   - Ti le tiet kiem.

4. Category Breakdown
   - Bieu do cot hoac donut.
   - Top 5 danh muc chi nhieu nhat.
   - So voi thang truoc neu co du lieu.

5. Bat thuong va dot bien
   - Khoan chi tang dot bien.
   - Ngay chi nhieu nhat.
   - Danh muc vuot ngan sach.

6. Saving Opportunities
   - Khoan co the cat giam.
   - Uoc tinh tiet kiem them neu giam 10%, 20%, 30%.

7. Goals Progress
   - Tien do muc tieu.
   - Voi toc do hien tai can bao lau.
   - Neu tang thu nhap 10tr/20tr moi thang thi rut ngan bao nhieu.

8. Earning Plan
   - Nhiem vu kiem tien da hoan thanh.
   - Thu nhap du kien vs thuc te.
   - Goi y ky nang / cong viec tiep theo.

9. Action Plan thang sau
   - 3 viec can lam.
   - 1 khoan can cat.
   - 1 thoi quen can giu.
   - 1 nhiem vu kiem tien nen bat dau.

Giao dien: editorial finance report, hien dai, sang, co mau sac tuoi nhung khong loe loet. Khong lam dang dashboard dev kho khan.

## Roadmap theo nhom phase

### Group 1: Chat Foundation

Muc tieu: nguoi dung co the nhap giao dich bang chat va luu duoc vao he thong hien tai.

Phase 0: Discovery & Safety

- Doc cau truc store hien tai: transaction, category, account, goal, budget.
- Xac dinh API/store nao duoc dung de tao giao dich.
- Dat feature flag cho AI Money Chat de khong pha UI hien tai.
- Chot schema trung gian `ParsedMoneyIntent`.

Deliverable:

- Route/page chat beta.
- Tai lieu schema parser.
- Khong anh huong cac man hinh hien tai.

Status 2026-06-02: completed. `npm run build` pass, `npm run test` pass.

Phase 1: Local Parser

- Parse tien VND: `50k`, `1tr3`, `1300k`, `2.500.000`.
- Parse intent: thu, chi, tiet kiem, chuyen quy.
- Parse category co ban.
- Tinh confidence.
- Unit test cho cac cau thuong gap.

Deliverable:

- `parseMoneyText(input)` hoat dong local.
- Test cases cho tieng Viet sinh hoat.

Status 2026-06-02: completed. `npm run test:ai-chat` pass, `npm run test` pass, `npm run build` pass.

Phase 2: Chat UI & Confirmation

- Tao man chat beta.
- Chat input.
- Message list.
- Confirmation card: loai giao dich, danh muc, so tien, tai khoan, ghi chu.
- Nut sua, xac nhan, huy.
- Luu vao store hien tai sau khi confirm.
- Dong nhac nho duoi chat ve doi chieu so du.

Deliverable:

- User flow: nhap `mua tra sua 50k` -> confirm -> luu giao dich.

Status 2026-06-02: completed. `npm run build` pass, `npm run test:ai-chat` pass, `npm run test` pass.

Report sau Group 1:

- File: `reports/ai-money-chat-foundation.md`
- Noi dung: tinh nang da lam, file da sua, test, rui ro con lai.

### Group 2: Memory Intelligence

Muc tieu: app hoc tu cach nguoi dung phan loai ma khong can AI cho moi lan.

Phase 3: Category Taxonomy

- Chot danh muc chinh.
- Map danh muc hien co sang taxonomy moi neu can.
- Them item/tag de tranh tao qua nhieu category.

Status 2026-06-02: completed. Da them `src/lib/aiMoneyChat/taxonomy.ts`; `npm run test:ai-chat`, `npm run test`, `npm run build` pass.

Phase 4: Local Memory

- Luu user correction.
- Tang confidence khi tu khoa lap lai.
- De xuat 2-3 danh muc khi khong chac.
- Khong tu dong tao category moi.

Status 2026-06-02: completed. Da them `useAiMoneyMemoryStore`; `npm run test:ai-memory`, `npm run test:ai-chat`, `npm run test`, `npm run build` pass.

Phase 5: AI Fallback

- Chi goi AI khi local confidence thap.
- AI tra JSON schema nghiem ngat.
- Validate output truoc khi hien cho user.
- Cache ket qua theo normalized input neu hop ly.

Status 2026-06-02: completed. Da them `/api/ai-money-chat/parse`, server flag `AI_MONEY_CHAT_AI_FALLBACK_ENABLED`, validation tests; `npm run test:ai-fallback`, `npm run test:ai-memory`, `npm run test:ai-chat`, `npm run test`, `npm run build` pass.

Deliverable:

- `mua kem danh rang` lan dau hoi/chon.
- Lan sau tu nho cach phan loai.
- AI chi chay khi can.

Report sau Group 2:

- File: `reports/financial-memory-report.md`
- Noi dung: taxonomy, memory behavior, chi phi AI uoc tinh, test phrase.

### Group 3: AI Cost & Pro Quota

Muc tieu: khong de AI dot chi phi qua muc.

Phase 6: Credit System

- Thiet ke bang usage/credits.
- Free vs Pro.
- Hard cap theo user/thang.
- Log so lan AI fallback.
- Hien so credit con lai cho Pro.

Status 2026-06-02: partially completed for server-side guard. Da co usage doc `users/{uid}/ai_usage/{YYYY-MM}`, Free/Pro gating, monthly hard cap va tests. Chua co UI hien credit con lai.

Deliverable:

- AI usage co gioi han.
- Het quota thi fallback ve local/manual.

Report sau Group 3:

- File: `reports/ai-cost-control-report.md`
- Noi dung: quota, credit pricing, cost guardrails, cac case bi chan.

### Group 4: Behavior Loop

Muc tieu: bien app thanh quan gia tai chinh co phan hoi va nhac nho dung luc.

Phase 7: Money Reaction Engine

- Template phan nan khi chi.
- Template chuc mung khi thu/tiet kiem.
- Lien ket muc tieu de tao thong diep co y nghia.
- Tone mode.

Status 2026-06-02: completed. Da them `src/lib/aiMoneyChat/moneyReaction.ts`, tich hop reaction sau confirm trong `/chat`, them `npm run test:ai-reaction`; `npm run test:ai-reaction`, cac test AI chat lien quan, `npm run test`, `npm run build` pass.

Phase 8: Daily Check-ins

- Bao cao 12h.
- Bao cao 21h.
- Thu nhap hom nay.
- Chi tieu hom nay.
- Nguong chi con lai.
- Tiet kiem thang nay.

Status 2026-06-02: completed beta local. Da them `src/lib/aiMoneyChat/dailyCheckin.ts`, nut check-in `12h` va `21h` trong `/chat`, `npm run test:ai-checkin`; cac test AI chat lien quan, `npm run test`, `npm run build` pass. Chua co scheduler/push notification that.

Phase 9: Bank Balance Reconciliation

- Nhac nguoi dung doi chieu so du.
- Flow cap nhat so du 3 tai khoan:
  - Thu nhap.
  - Chi tieu.
  - Tiet kiem.
- Canh bao neu so du app lech voi so du ngan hang.

Status 2026-06-02: completed beta local. Da them `src/lib/aiMoneyChat/balanceReconciliation.ts`, form `Doi chieu so du` trong `/chat`, `npm run test:ai-reconciliation`; cac test AI chat lien quan, `npm run test`, `npm run build` pass. Chua tu dong cap nhat so du app.

Report sau Group 4:

- File: `reports/behavior-loop-report.md`
- Noi dung: reaction rules, check-in content, reconciliation UX, edge cases.

Status 2026-06-02: completed.

### Group 5: Monthly CFO Report

Muc tieu: tao report thang dep, de hieu, co gia tri Pro.

Phase 11: HTML CFO Report

- Trang report trong app.
- Hero summary.
- Financial Health Score.
- Cashflow chart.
- Category chart.
- Saving opportunities.
- Goal projection.
- Action plan thang sau.

Phase 12: Export

- Export PDF/share image.
- Export Excel/CSV sau neu can.
- Excel gom:
  - Summary.
  - Category Breakdown.
  - Transactions.
  - Goals.
  - Earning Tasks.
  - Saving Opportunities.

Phase 13: AI CFO Narration

- AI viet nhan xet CFO ca nhan hoa cho Pro.
- Local template cho Free.
- Khong gui du lieu qua nhieu, chi gui summary da aggregate.

Report sau Group 5:

- File: `reports/monthly-cfo-report.md`
- Noi dung: report sections, export status, AI prompt/cost, screenshots neu co.

### Group 6: Advanced Pro Launch

Muc tieu: hoan thien tinh nang Pro va chuan bi beta/public launch.

Phase 10: Receipt & Transfer Screenshot

- OCR.
- Fast mode: chi lay tong tien.
- Detailed mode: gom nhom theo danh muc.
- Confirmation before save.

Phase 14: Earning Planner

- Chat tao nhiem vu kiem tien.
- Checklist viec nho.
- Du kien thu nhap.
- Thoi gian hoan thanh.
- Ghi nhan tien do.

Phase 15: QA, Analytics & Store Readiness

- Test parser tieng Viet.
- Test quota AI.
- Test mobile layout.
- Test auth/deletion regression.
- Analytics event cho chat, confirm, correction, AI fallback.
- Kiem tra Google Play / iOS App Store requirements.

Report sau Group 6:

- File: `reports/advanced-pro-launch-report.md`
- Noi dung: launch checklist, known issues, store readiness, analytics, cost risk.

## Thu tu trien khai de khong bi vo logic

Nen lam theo thu tu:

1. Group 1: Chat Foundation.
2. Group 2: Memory Intelligence.
3. Dung lai test beta noi bo.
4. Group 3: AI Cost & Pro Quota.
5. Group 4: Behavior Loop.
6. Group 5: Monthly CFO Report.
7. Group 6: Advanced Pro Launch.

Khong nen lam receipt scan truoc khi parser/memory/quota on dinh, vi receipt scan de lam roi UX va co nguy co ton AI neu chua co cost guardrail.

## Mau report sau moi group

Moi report trong `reports/` nen theo format:

```md
# <Ten group> Report

Date:
Branch:

## Muc tieu

## Da hoan thanh

## Files changed

## User flows

## Data logic

## Tests

## Ket qua

## Rui ro con lai

## Viec tiep theo
```

## Definition of Done cho tung group

Mot group chi xem la xong khi:

- Chay build/test lien quan.
- Co report trong `reports/`.
- Khong ghi key/env that vao git.
- Khong lam hong flow hien tai: login, profile, transaction, goals.
- Neu co UI moi, phai test mobile va desktop.
- Neu co AI, phai co fallback khi API loi/het quota.

## Cau lenh resume lan sau

Neu tiep tuc coding:

```text
Doc docs/AI_MONEY_CHAT_ROADMAP.md, kiem tra git status, roi tiep tuc Group 1 Phase 0. Truoc khi sua Next.js hay doc AGENTS.md va docs Next trong node_modules/next/dist/docs/.
```

Neu chi muon xem trang thai:

```text
Doc docs/AI_MONEY_CHAT_ROADMAP.md va tom tat dang o phase nao, con viec gi tiep theo.
```
