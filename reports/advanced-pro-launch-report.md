# Advanced Pro Launch — Group 6 Report (Phase 14 + 15 done; Phase 10 deferred)

Date: 2026-06-02
Branch: codex/ai-money-chat

## Muc tieu

Hoan thien tinh nang Pro va chuan bi launch. Group 6 gom Phase 10 (Receipt scan),
Phase 14 (Earning Planner), Phase 15 (QA & Store readiness).

## Phase 14 — Earning Planner (DONE)

### Da hoan thanh
- `src/lib/aiMoneyChat/earningPlanner.ts` (pure, local-first):
  - `detectEarningIntent(text)`: nhan biet cau "ke hoach kiem tien" vs giao dich thuong.
  - `parseEarningPlan(text)`: trich xuat ten, mục tiêu thu nhập (reuse `extractVndAmount`), thời lượng (ngày/tuần/tháng, default 7), work type (freelance/sales/teaching/writing/photo/service/generic) + checklist gợi ý.
  - `buildEarningTaskDates(durationDays, start)`: ra startDate/endDate ISO cho `useTaskStore`.
- `src/lib/aiMoneyChat/parser.ts`: export `extractVndAmount` de tai su dung amount parser.
- `/chat`: them earning draft card — sửa tên/mục tiêu/số ngày + checklist (thêm/xoá/sửa bước) → "Tạo nhiệm vụ" → `useTaskStore.addTask`. Earning intent uu tien truoc money parse, loai tru lan nhau voi money draft + reconciliation.
- Them earning example chip va reaction sau khi tao.

### Files changed
- `src/lib/aiMoneyChat/earningPlanner.ts` (new)
- `src/lib/aiMoneyChat/parser.ts` (export extractVndAmount)
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx`
- `src/app/(app)/chat/_components/ai-money-chat.css`
- `tests/ai-money-earning-planner.test.ts` (new)
- `package.json` (test:ai-earning)
- `docs/AI_MONEY_CHAT_ROADMAP.md`

### User flow
1. `/chat` -> nhập "làm freelance kiếm 3tr trong 1 tuần".
2. App tạo draft nhiệm vụ + checklist gợi ý.
3. User sửa tên/mục tiêu/số ngày/các bước.
4. "Tạo nhiệm vụ" -> lưu vào useTaskStore -> xem ở tab Money.

### Tests
- `npm run test:ai-earning`: pass (intent, parse amount/duration/worktype, dates).
- `npm run build`: pass.
- `npm run lint`: khong loi moi trong file Phase 14.

## Phase 15 — QA, Analytics & Store readiness (DONE — analytics + QA)

### Da hoan thanh
- `src/lib/analytics/events.ts`: `trackEvent(event, params)` production-safe.
  - No-op khi SSR hoac thieu `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (demo/dev).
  - Lazy import `firebase/analytics`, check `isSupported()`, best-effort, khong bao gio throw.
  - `sanitizeEventParams`: chi giu primitive, cat string >100 ky tu, bo null/undefined/object/NaN → tranh ro ri PII (note text) hoac payload qua lon.
- Wire events:
  - `chat_parse` (mode money/earning, confidence, hasAmount, source, type)
  - `chat_confirm` (type, corrected)
  - `chat_correction` (from, to)
  - `ai_fallback` (source, applied)
  - `reconciliation_check` (status)
  - `earning_task_created` (durationDays, subTaskCount, expectedAmount)
  - `cfo_report_view` (healthScore, tier)
  - `cfo_narration` (source, cached)
  - `report_export` (csv/print)
- `src/lib/firebase/config.ts`: them `measurementId` + export `getFirebaseApp`.
- Test: `npm run test:analytics` (sanitize), `npm run test:ai-all` (aggregate toan bo AI suite cho CI).

### QA status
- `npm run build`: pass (routes `/chat`, `/report`, `/api/ai-money-chat/*`).
- `npm run test:ai-all`: 0 fail (chat, memory, fallback, quota, reaction, checkin, reconciliation, cfo-report, earning, analytics).
- `npm run lint`: file moi sach. Con 27 loi cu trong test files (`any` trong date-helpers/phase2-backdate) — da ghi nhan o PLAN.md, khong block build.

### Store readiness
- Google Play checklist o `PLAN.md` (Capacitor wrap, account deletion, privacy/ToS, remove dev surface). Khong lam lai o day.
- Receipt scan (Phase 10) hoan lai → khong them dependency nang truoc launch.

## Phase 10 — Receipt scan (DEFERRED)
Quyet dinh 2026-06-02: hoan de chot san pham ban duoc truoc. Khi lam: chot huong OCR
(tesseract.js client mien phi/nang bundle vs cloud vision + credit/chinh xac cao).
Flow da dinh huong trong roadmap: OCR → parser local gom so tien → AI chi xu ly dong khong ro.

## Rui ro con lai
- Earning planner chua doan duoc nhieu nhiem vu trong 1 cau (chi 1 task/lan).
- Work-type detection dua keyword, co the can mo rong cho nganh nghe dac thu.
