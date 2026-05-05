import type { PersonaProfile, SyntheticAction } from './types';
import { testDateForDay } from './dates';

function incomeAmountForDay(persona: PersonaProfile, day: number): number {
  if (persona.income.pattern === 'fixed') {
    return persona.income.monthlyAmount ?? 0;
  }

  const range = persona.income.monthlyRange ?? [0, 0];
  const spread = range[1] - range[0];
  return Math.round(range[0] + spread * ((day % 7) / 6));
}

function dailyExpenseAmount(persona: PersonaProfile, day: number, index: number): number {
  const base = persona.dailySpendingLimit / 30;
  const multiplier = 0.65 + (((day + index * 3) % 5) * 0.18);
  return Math.round(base * multiplier);
}

export function buildSetupActions(): SyntheticAction[] {
  return [{ kind: 'onboard', dateKey: testDateForDay(1) }];
}

export function buildPhaseOneActions(persona: PersonaProfile): SyntheticAction[] {
  const actions: SyntheticAction[] = buildSetupActions();
  const forgetDays = Array.isArray(persona.habits.forgetDays) ? persona.habits.forgetDays : [];
  const backfillDay =
    typeof persona.habits.backfillDay === 'number' ? persona.habits.backfillDay : null;

  for (let day = 2; day <= 30; day += 1) {
    const dateKey = testDateForDay(day);
    const dom = Number(dateKey.slice(8, 10));

    if (persona.income.payDays.includes(dom)) {
      const amount = incomeAmountForDay(persona, day);
      actions.push({
        kind: 'record-income',
        id: `${persona.id}-income-${day}`,
        dateKey,
        amount,
        categoryId: 'income',
        note: 'Income scheduled by persona profile',
      });
      actions.push({
        kind: 'split-funds',
        id: `${persona.id}-split-${day}`,
        dateKey,
        sourceAmount: amount,
        billPercent: persona.splitDefaults.billPercent,
        savingsPercent: persona.splitDefaults.savingsPercent,
        savingsBreakdown: persona.splitDefaults.savingsBreakdown,
      });
    }

    if (!forgetDays.includes(day)) {
      for (let index = 0; index < 2; index += 1) {
        const budget = persona.budgets[(day + index) % persona.budgets.length];
        actions.push({
          kind: 'record-expense',
          id: `${persona.id}-expense-${day}-${index}`,
          dateKey,
          amount: dailyExpenseAmount(persona, day, index),
          categoryId: budget.categoryId,
          note: `Daily spend ${index + 1}`,
        });
      }
    }

    if (backfillDay === day) {
      for (const forgottenDay of forgetDays) {
        const transactionDateKey = testDateForDay(Number(forgottenDay));
        const budget = persona.budgets[Number(forgottenDay) % persona.budgets.length];
        actions.push({
          kind: 'record-expense',
          id: `${persona.id}-backfill-${forgottenDay}`,
          dateKey,
          transactionDateKey,
          amount: dailyExpenseAmount(persona, Number(forgottenDay), 0),
          categoryId: budget.categoryId,
          note: `Backfilled spend from day ${forgottenDay}`,
          isBackdated: true,
        });
      }
    }

    for (const bill of persona.bills) {
      if (bill.dueDay === dom || (dom === 25 && bill.dueDay > 25)) {
        actions.push({
          kind: 'pay-bill',
          id: `${persona.id}-pay-${day}-${bill.id}`,
          dateKey,
          billId: bill.id,
        });
      }
    }
  }

  return actions;
}
