import minhProfile from './personas/minh.json';
import huongProfile from './personas/huong.json';
import tuanProfile from './personas/tuan.json';
import { INVARIANT_DEFINITIONS, checkInvariants } from './synthetic/invariants';
import { TEST_END_DATE_KEY, TEST_START_DATE_KEY, TOTAL_TEST_DAYS } from './synthetic/dates';
import { buildPhaseOneActions, buildSetupActions } from './synthetic/scenario';
import { applySyntheticAction, createInitialState, runActions } from './synthetic/engine';
import type { PersonaProfile } from './synthetic/types';

export const SYNTHETIC_TEST_WINDOW = {
  start: TEST_START_DATE_KEY,
  end: TEST_END_DATE_KEY,
  days: TOTAL_TEST_DAYS,
};

export const PERSONAS = [
  minhProfile as unknown as PersonaProfile,
  huongProfile as unknown as PersonaProfile,
  tuanProfile as unknown as PersonaProfile,
];

export const SYNTHETIC_INVARIANTS = INVARIANT_DEFINITIONS;

export function previewSetupPhase() {
  return PERSONAS.map((persona) => {
    const state = createInitialState(persona);
    for (const action of buildSetupActions()) {
      applySyntheticAction(state, action);
    }

    return {
      personaId: persona.id,
      billsTotal: persona.bills.reduce((total, bill) => total + bill.amount, 0),
      spendingLimit: persona.dailySpendingLimit,
      goals: persona.goals.length,
      invariantCount: checkInvariants(state).length,
    };
  });
}

export function runPhaseOneDryRun() {
  return PERSONAS.map((persona) => runActions(persona, 'phase-0-1', buildPhaseOneActions(persona)));
}
