# ManiCash Money Brain — Handoff (Phase 1 → 6B-1.5)

> Tài liệu bàn giao để tiếp tục ở phiên chat mới. Cập nhật: 2026-06-13.

## Git
- Repo: `DoQuanghealing/Manicash` · Branch: `codex/ai-money-chat`
- Đã push tới origin. HEAD = `5490a72`.
- Chuỗi commit Money Brain:
  ```
  5490a72  fix: harden local persistence boundaries        (Phase 6B-1.5)
  13e1adc  feat: add local-first money persistence          (Phase 6B-1)
  af13aad  fix: harden money action undo audit              (Phase 6A)
  3a569a3  feat(chat): add action audit history and safe undo (Phase 5)
  f3743d8  feat(chat): extend client-executed money actions  (Phase 4B)
  f45824d  feat(chat): add core client-executed action protocol (Phase 4A)
  dde3f26  feat(cfo): add CFO context pack + schema-guarded AI (Phase 3)
  34beea4  feat(chat): deterministic Money Chat V2           (Phase 2)
  26285a6  feat(moneyBrain): isomorphic financial metrics + UI bridge (Phase 1)
  344330a / 55c9857  Phase 0 (snapshot contract, tz-safe dates)
  ```

## Lệnh / môi trường
- Repo dùng **npm + jiti** (KHÔNG pnpm). Verify:
  ```
  npx tsc --noEmit
  npm run test:moneybrain
  npm run test:ai-money
  npm run test:ai-all
  ```
- Test runner: jiti tự viết (console PASS/FAIL), không Jest. Test mới phải thêm script vào package.json + gộp vào `test:ai-money`/`test:moneybrain`.
- Trạng thái test cuối 6B-1.5: `test:ai-money` 283 PASS/0 FAIL; moneybrain 0 FAIL; ai-all 0 FAIL; tsc + eslint clean.

## Invariants bất biến (KHÔNG được phá)
1. `src/lib/moneyBrain/*` PURE: không import React/Zustand/API/localStorage/window; không `Date.now()` cho logic tài chính (dùng `clientNow`+`timezone` từ snapshot).
2. `MoneySnapshotV1` là contract chung client/server/UI/AI.
3. `healthScore` deterministic (`getFinancialHealthScore`), LLM không tự chấm.
4. Server (`/api/chat`, `/api/cfo`) KHÔNG execute action, KHÔNG import Zustand — chỉ trả `actionRequest` / đọc snapshot client.
5. Action: client confirm → chỉ `clientActionExecutor.ts` (+ `clientActionUndoExecutor.ts`) được gọi Zustand. Expense ≥ 3.000.000đ không bypass BreathGate.
6. LLM không bịa số tài chính (CFO đọc `CFOContextPackV1`).
7. Undo exact-from-snapshot; XP/streak restore qua `useAuthStore.restoreProgress`.

## Kiến trúc đã có
- **Engine** `src/lib/moneyBrain/`: financeMetrics, budgetMetrics, billMetrics, goalMetrics, taskMetrics, safeToSpend, healthScore, financialMode, behaviorMetrics, historyMetrics, cfoContextPack, cfoTypes, snapshot, dateRange, normalize.
- **Chat** `src/lib/aiMoneyChat/`: intent (router/classifier/patterns/slotExtractor), handlers (query*), cfo (schema/prompt/fallback/service), actions (types/builder/amountParser/validators/commandParser/executor/undoExecutor/auditTypes/copy), llm providers.
- **Stores** `src/stores/`: useFinanceStore, useBudgetStore, useGoalsStore, useTaskStore, useAuthStore, useActionAuditStore, useHydrationStore + `persistConfig.ts` + `clearLocalPersistence.ts`.
- **Persist**: 5 store + audit persist localStorage (`manicash.*.v1`, key audit `manicash-action-audit`), versioning + migrate + hydration gate (`areCoreStoresHydrated`). Logout/delete gọi `clearLocalMoneyPersistence()`.

## 10 client-executed actions (Phase 4A/4B), undo exact (6A)
MARK_BILL_PAID, CREATE_EXPENSE, CREATE_INCOME, CREATE_FIXED_BILL, SET_CATEGORY_BUDGET,
ADD_GOAL_DEPOSIT, CREATE_EARNING_TASK, COMPLETE_EARNING_TASK, ADD_WISHLIST_ITEM, FLAG_TRANSACTION.

## Cách làm việc với PO
- PO nói **"cho tôi Phase X"** → viết prompt đầy đủ (mục tiêu/invariants/steps/tests/verification/completion/commit-gate) để dán vào Claude Code.
- Có report → **review như CTO** (PASS/chưa, có nên commit, commit message, cần sửa gì).
- **Không commit/push tới khi PO duyệt.** Trả lời tiếng Việt, gọn + đủ kỹ thuật.
- Mỗi phase: verify → report `reports/money-brain-phase-N.md` → chờ duyệt → commit.

## TIẾP THEO — Phase 6B-2: Cloud sync (Firestore)
Chờ PO gửi spec. Định hướng CTO đã chốt sơ bộ:
- Conflict: **append-merge** cho `transactions` + `audit` (không mất record), **LWW theo `updatedAt`** cho scalar (balances/budget limit).
- **Namespace theo UID** (giải quyết account boundary triệt để, thay clear-on-logout).
- Debounce/batch write; offline queue + reconnect.
- Firestore rules per-uid; giữ invariant **server chỉ persist state, không execute action**.
- Đề xuất tách: **6B-2a** (sync engine + conflict + namespace) → **6B-2b** (offline queue/reconnect).

## Reports
`reports/money-brain-phase-1.md` … `phase-6b15.md` (mỗi phase 1 report).
