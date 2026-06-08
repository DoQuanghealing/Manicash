/* Phase 3 — CFO AI response schema validator */
import {
  validateCFOAIResponse,
  parseCFOAIResponse,
  extractJsonObject,
} from '@/lib/aiMoneyChat/cfo/cfoResponseSchema';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg: string): void { if (!v) throw new Error(msg); }

const VALID = {
  summary: 'Tình hình ổn định.',
  diagnosis: ['Dòng tiền dương.'],
  risks: ['Quỹ dự phòng mỏng.'],
  opportunities: ['Cắt giảm ăn uống.'],
  actionPlan7Days: ['Việc 1', 'Việc 2', 'Việc 3'],
};

function main() {
  console.log('\nCFO response schema');

  it('valid response passes', () => {
    const r = validateCFOAIResponse(VALID);
    ok(r !== null, 'validated');
    eq(r!.summary, 'Tình hình ổn định.');
    eq(r!.actionPlan7Days.length, 3);
  });

  it('response thừa số liệu -> field số bị strip', () => {
    const r = validateCFOAIResponse({
      ...VALID,
      healthScore: 99,
      totalIncome: 12345,
      safeToSpend: 999,
    }) as unknown as Record<string, unknown>;
    ok(r !== null, 'validated');
    eq('healthScore' in r, false);
    eq('totalIncome' in r, false);
    eq('safeToSpend' in r, false);
  });

  it('thiếu summary -> null', () => {
    eq(validateCFOAIResponse({ ...VALID, summary: '' }), null);
  });

  it('actionPlan < 3 -> null', () => {
    eq(validateCFOAIResponse({ ...VALID, actionPlan7Days: ['1', '2'] }), null);
  });

  it('diagnosis rỗng -> null', () => {
    eq(validateCFOAIResponse({ ...VALID, diagnosis: [] }), null);
  });

  it('parse từ JSON string', () => {
    const r = parseCFOAIResponse(JSON.stringify(VALID));
    ok(r !== null, 'parsed');
  });

  it('extractJsonObject xử lý ```json fence', () => {
    const obj = extractJsonObject('```json\n{"a":1}\n```') as { a: number } | null;
    eq(obj?.a, 1);
  });

  it('parse output không phải JSON -> null', () => {
    eq(parseCFOAIResponse('xin chào, đây không phải json'), null);
  });

  it('actionPlan > 7 -> clamp về 7', () => {
    const r = validateCFOAIResponse({
      ...VALID,
      actionPlan7Days: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    });
    eq(r!.actionPlan7Days.length, 7);
  });

  console.log('\nCFO response schema test complete.');
}

main();
