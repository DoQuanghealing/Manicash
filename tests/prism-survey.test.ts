/* PRISM P6a — khảo sát năng lực.
 * Kiểm: isSurveyComplete; surveyToSignals (chưa khai -> -1; đã khai -> đếm kỹ năng
 * + giờ rảnh); sanitizeSkills lọc id lạ + khử trùng. */
import {
  isSurveyComplete,
  surveyToSignals,
  sanitizeSkills,
  EMPTY_SURVEY,
  type CapacitySurveyAnswers,
} from '@/lib/aiMoneyChat/prism/capacity/capacitySurvey';

type Fn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: Fn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${String(b)}, got ${String(a)}`);
}
function ok(c: boolean, m: string): void { if (!c) throw new Error(m); }

describe('isSurveyComplete');
it('rỗng -> false', () => { eq(isSurveyComplete(EMPTY_SURVEY), false); });
it('có completedAt + kỹ năng -> true', () => {
  const a: CapacitySurveyAnswers = { skills: ['coding'], freeTimeHoursPerWeek: -1, completedAt: '2026-06-17T00:00:00Z' };
  eq(isSurveyComplete(a), true);
});
it('có completedAt nhưng trống trơn -> false', () => {
  const a: CapacitySurveyAnswers = { skills: [], freeTimeHoursPerWeek: -1, completedAt: '2026-06-17T00:00:00Z' };
  eq(isSurveyComplete(a), false);
});

describe('sanitizeSkills');
it('lọc id lạ + khử trùng', () => {
  const out = sanitizeSkills(['coding', 'coding', 'xxx', 'design']);
  eq(out.length, 2);
  ok(out.includes('coding') && out.includes('design'), 'giữ id hợp lệ');
});

describe('surveyToSignals');
it('chưa khai -> -1/-1', () => {
  const s = surveyToSignals(EMPTY_SURVEY);
  eq(s.skillsDeclared, -1);
  eq(s.freeTimeHoursPerWeek, -1);
});
it('đã khai -> đếm kỹ năng + giờ rảnh', () => {
  const a: CapacitySurveyAnswers = { skills: ['coding', 'design', 'xxx'], freeTimeHoursPerWeek: 15, completedAt: '2026-06-17T00:00:00Z' };
  const s = surveyToSignals(a);
  eq(s.skillsDeclared, 2, 'bỏ id lạ');
  eq(s.freeTimeHoursPerWeek, 15);
});

if (process.exitCode) process.exit(process.exitCode);
