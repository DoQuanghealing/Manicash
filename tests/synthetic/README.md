# Synthetic user testing setup

This folder contains the setup phase for the 90-day manicash synthetic user test.
It does not run the full test automatically yet.

## Layers

- `personas/*.json`: persona source data, bills, budgets, goals, split defaults, and habit risks.
- `synthetic/engine.ts`: applies synthetic actions to a clear app snapshot and keeps running after invariant failures.
- `synthetic/invariants.ts`: the 10 plan invariants as code.
- `synthetic/scenario.ts`: deterministic action builders for setup and Phase 0+1 preview.
- `synthetic-user.test.ts`: exported entrypoint for review and later runner wiring.

## Formula ownership

The invariant ledger is the source of expected arithmetic during the synthetic test:

- Main balance = main income - main expenses - split deductions.
- Bill fund = direct bill-fund income + split bill contributions - bill payments.
- Savings = reserve + goals + investment contributions from split flows.
- System total = all income - non-bill expenses - paid bills.
- Expense funding target = spending limits + active fixed bills.

The current app code remains untouched. Later phases can connect the real Zustand stores or browser flows to the same invariant checks without rewriting these formulas.

## Current stop point

Setup phase is ready for review. Phase 0+1 should only run after confirmation.
