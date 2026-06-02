# Monthly CFO Report — Group 5 Report

Date: 2026-06-02
Branch: codex/ai-money-chat

## Muc tieu

Tao report thang dep, de hieu, co gia tri Pro. Bao gom Phase 11 (HTML report),
Phase 12 (Export), Phase 13 (AI CFO Narration).

## Da hoan thanh

### Phase 11 — HTML CFO Report
- Route moi `/report` (`src/app/(app)/report/`).
- Editorial finance report local-first, tinh tu `useFinanceStore`, `useBudgetStore`, `useGoalsStore`, `useCategoryStore`.
- Sections: Hero tier (good/fair/poor), Health Score gauge (reuse), Cashflow bars, Top 5 danh muc, Goals progress, Action plan 3 viec.
- Entry point: nut "Xem bao cao day du thang nay" trong tab CFO cua `/money`.

### Phase 12 — Export
- `src/lib/aiMoneyChat/reportExport.ts`: `buildMonthlyReportCsv` (pure) + `downloadCsv` (UTF-8 BOM, escape comma/quote/newline).
- In / Luu PDF qua `window.print()` + `@media print` stylesheet (an nav/buttons, break-inside avoid).
- Khong them dependency (khong jspdf/html2canvas).

### Phase 13 — AI CFO Narration
- `src/lib/aiMoneyChat/cfoNarration.ts`: `buildLocalCfoNarration` (Lord Diamond voice, deterministic) la baseline Free + fallback; `buildCfoNarrationPrompt` + `validateNarration` + system prompt.
- `src/lib/aiMoneyChat/cfoNarrationClient.ts`: `requestCfoNarration` — goi AI, fallback ve local moi truong hop.
- API `/api/ai-money-chat/cfo-narration`: verify uid, charge credit (8/lan), goi Groq, validate, fallback.
- Quota: them `cfoNarrationCredits` vao `quotaCore`, refactor `quota.ts` thanh `chargeAiMoneyCredits` generic + 2 wrapper.
- Privacy: chi gui summary da aggregate, khong gui tung giao dich.

## Files changed

- `src/app/(app)/report/page.tsx` (new)
- `src/app/(app)/report/_components/CfoReportContent.tsx` (new)
- `src/app/(app)/report/_components/cfo-report.css` (new)
- `src/lib/aiMoneyChat/reportExport.ts` (new)
- `src/lib/aiMoneyChat/cfoNarration.ts` (new)
- `src/lib/aiMoneyChat/cfoNarrationClient.ts` (new)
- `src/app/api/ai-money-chat/cfo-narration/route.ts` (new)
- `src/lib/aiMoneyChat/quotaCore.ts` (cfoNarrationCredits)
- `src/lib/aiMoneyChat/quota.ts` (generic charge + narration wrapper)
- `src/app/(app)/money/_components/MoneyContent.tsx` (report CTA link)
- `src/app/(app)/money/_components/money.css` (report CTA style)
- `tests/ai-money-cfo-report.test.ts` (new)
- `package.json` (test:ai-cfo-report)
- `.env.example` (AI_MONEY_CHAT_CFO_NARRATION_CREDITS)

## User flows

1. `/money` -> tab CFO -> "Xem bao cao day du thang nay" -> `/report`.
2. `/report` hien narration local cua Lord Diamond ngay.
3. Bam "Hoi Lord Diamond (AI Pro)" -> neu Pro + co key -> AI narration; nguoc lai giu local.
4. Bam "Xuat CSV / Excel" -> tai file `.csv`.
5. Bam "In / Luu PDF" -> print dialog.

## Data logic

- Health score: savings 0-40pt, budget compliance 0-30pt, goals progress 0-30pt.
- Tier: >=70 good, >=40 fair, con lai poor.
- Narration credit: mac dinh 8 credits/lan (env override).

## Tests

- `npm run test:ai-cfo-report`: pass (local template, prompt, validation, CSV).
- `npm run test:ai-quota`: pass (sau khi them cfoNarrationCredits).
- `npm test`: pass.
- `npm run build`: pass, routes `/report` + `/api/ai-money-chat/cfo-narration` xuat hien.
- `npm run lint`: khong loi moi (chi con 27 loi cu trong test files da ghi nhan o PLAN.md).

## Ket qua

Group 5 hoan thanh o muc beta local. AI narration co fallback an toan, export khong can backend.

## Cost lock (cache narration)

Hai lop cache khoa chi phi AI, cap nhat 2026-06-02:

1. **Client localStorage** (`manicash_cfo_narration_v1`): neu fingerprint trung -> tra ngay, KHONG goi mang, KHONG ton credit.
2. **Server Firestore** (`users/{uid}/cfo_narration/{monthKey}`): cung fingerprint trong thang -> reuse text da luu, KHONG charge credit. Chi charge khi fingerprint moi (so lieu thang thay doi).

Fingerprint: `computeNarrationFingerprint` (FNV-1a hex, pure, dependency-free) tren cac field aggregate. Co test determinism + sensitivity + null-safe.

UI hien "Da luu — khong ton credit" khi tra tu cache.

## Rui ro con lai
- Export PDF dua vao browser print, chua co template PDF rieng (acceptable cho v1).
- Chua co Excel nhieu sheet (Phase 12 nang cao) — hien chi 1 CSV gop section.
- Pro gating hien `isPro()` luon true (theo `proGating.ts`) — quota server van enforce theo Firestore plan.

## Viec tiep theo

- Group 6: Phase 10 (Receipt scan), Phase 14 (Earning Planner), Phase 15 (QA & Store readiness).
