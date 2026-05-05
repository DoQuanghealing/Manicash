import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import minhProfile from '../personas/minh.json';
import huongProfile from '../personas/huong.json';
import tuanProfile from '../personas/tuan.json';
import { runActions } from './engine';
import { buildPhaseOneActions } from './scenario';
import { buildPersonaDiary } from './diary';
import {
  buildBugsReportFromPhaseOne,
  buildExecutiveSummaryPhaseOne,
  buildIntermediateReport,
  buildUxFindingsPhaseOne,
} from './reporting';
import type { PersonaProfile } from './types';

const personas = [
  minhProfile as unknown as PersonaProfile,
  huongProfile as unknown as PersonaProfile,
  tuanProfile as unknown as PersonaProfile,
];

const phaseRuns = personas.map((persona) => {
  const actions = buildPhaseOneActions(persona);
  const result = runActions(persona, 'phase-0-1', actions);
  return { persona, actions, result };
});
const results = phaseRuns.map((phaseRun) => phaseRun.result);

const reportsDir = join(process.cwd(), 'reports');
mkdirSync(reportsDir, { recursive: true });

writeFileSync(
  join(reportsDir, 'intermediate-phase-0-1.md'),
  buildIntermediateReport(results, personas),
  'utf8',
);

writeFileSync(
  join(reportsDir, 'bugs.md'),
  buildBugsReportFromPhaseOne(),
  'utf8',
);

writeFileSync(
  join(reportsDir, 'ux-findings.md'),
  buildUxFindingsPhaseOne(),
  'utf8',
);

writeFileSync(
  join(reportsDir, 'executive-summary.md'),
  buildExecutiveSummaryPhaseOne(),
  'utf8',
);

const diariesDir = join(reportsDir, 'persona-diaries');
mkdirSync(diariesDir, { recursive: true });
for (const phaseRun of phaseRuns) {
  writeFileSync(
    join(diariesDir, `${phaseRun.persona.id}.md`),
    buildPersonaDiary(phaseRun.persona, phaseRun.result, phaseRun.actions),
    'utf8',
  );
}

const violationCount = results.reduce((total, result) => total + result.violations.length, 0);
console.log(`Phase 0+1 complete. Personas=${results.length}. Violations=${violationCount}.`);
