# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint check
```

No test runner is configured.

## Environment

Copy `.env.example` to `.env.local` and fill in:
- Firebase public config keys (for auth + Firestore)
- `GROQ_API_KEY` — powers the AI CFO feature (Llama 3.3 70B via Groq); app falls back to a demo insight if missing

## Architecture

**ManiCash** is a Vietnamese personal finance app with gamification. Stack: Next.js 16 App Router, React 19, TypeScript, Firebase (auth + Firestore), Zustand, Tailwind CSS v4.

### Route groups

- `(auth)/login` — Google OAuth login
- `(app)/overview|input|ledger|goals|money` — protected app shell with shared header/bottom-nav layout
- `admin/` — admin dashboard
- `api/cfo` — Groq AI financial analysis endpoint
- `api/auth/session` — Firebase session check
- `api/admin/bans` — user ban management

### State management (`src/stores/`)

All client state lives in Zustand stores. The most critical ones:

| Store | Owns |
|-------|------|
| `useFinanceStore` | Transactions, three-wallet balances (main / emergency / bill-fund), fixed bills |
| `useBudgetStore` | Monthly category budgets, carryover logic, safe-to-spend calculation |
| `useGoalsStore` | Long-term goals + milestones |
| `useTaskStore` | Earning tasks (side gigs) with sub-task checklists |
| `useAuthStore` | Firebase user + UserProfile (rank, XP, streak) |

Data is seeded deterministically for demo mode (bypasses Firebase auth).

### Gamification (`src/lib/xpEngine.ts`)

Seven ranks from Iron (0 XP) → Diamond (50 000 XP). XP is awarded/penalised for finance actions (logging income/expenses, resisting spending, completing tasks, maintaining streaks). Rank unlocks perks defined in `src/data/rankDefinitions.ts`.

### AI CFO (`src/lib/groqClient.ts` + `src/app/api/cfo/`)

`POST /api/cfo` accepts `{ transactions, totalIncome, totalExpense, savingsRate }` and returns `{ summary, suggestions, healthScore }` (0–100). The `useCFOReport` hook (in `src/hooks/`) calls this endpoint and is consumed by `MoneyContent`.

### Design system (`src/app/globals.css`)

Dark-first glassmorphism theme. Key tokens: purple `#7C3AED`, orange `#F97316`, green `#22C55E`. Four background levels from `#0A0A12` (primary) to `#1C1930` (tertiary). Mobile-first (375 px baseline). Vietnamese language throughout.

### Key type domains (`src/types/`)

- `transaction.ts` — `Transaction`, `Category`, `FixedBill`
- `user.ts` — `UserProfile`, `UserRank`, `AuthState`
- `gamification.ts` — `XPAction`, `RankDefinition`, `XPActionType`
- `task.ts` — `EarningTask`, `SubTask`, `XPPenalty`
- `budget.ts` — `CategoryBudget`, `MonthlySnapshot`, `Goal`, `Milestone`
