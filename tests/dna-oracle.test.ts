/* ═══ Financial DNA — Oracle schema + service + prompt + gate (PV-3 · B3/B5) ═══
 * Schema validate (kể cả output bẩn/injection) · fallback deterministic 0đ ·
 * prompt chứa guard chống injection · gate cấp 3 KHÔNG có suất nếm ·
 * growthOrientation chảy vào capacity engine.
 */
import {
  validateDnaOracleReport,
  parseDnaOracleReport,
  DNA_ORACLE_DISCLAIMER,
} from '@/lib/aiMoneyChat/prism/dna/dnaOracleSchema';
import {
  buildDnaOracleSystemPrompt,
  buildDnaOracleUserPrompt,
  type DnaOracleContext,
} from '@/lib/aiMoneyChat/prism/dna/dnaOraclePrompt';
import {
  buildDeterministicDnaOracle,
  runDnaOracle,
} from '@/lib/aiMoneyChat/prism/dna/dnaOracleService';
import { resolveDnaPersona } from '@/lib/aiMoneyChat/prism/dna/personaEngine';
import type { DnaAnswer } from '@/lib/aiMoneyChat/prism/dna/dnaQuestions';
import { hasFeature, billingLevelCap, FEATURE_TASTE_QUOTA } from '@/lib/monetization/butlerFeatures';
import { buildCapacityComponents } from '@/lib/aiMoneyChat/prism/capacity/buildCapacity';

function it(name: string, fn: () => void | Promise<void>): void {
  const r = fn();
  if (r instanceof Promise) {
    r.then(() => console.log(`  PASS ${name}`)).catch((e) => {
      console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1;
    });
    return;
  }
  console.log(`  PASS ${name}`);
}
function itSync(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const BUILDER_ANSWERS: DnaAnswer[] = [
  { questionId: 'q1_surplus', optionId: 'invest' },
  { questionId: 'q2_feeling', optionId: 'curious' },
  { questionId: 'q3_meaning', optionId: 'tool' },
  { questionId: 'q4_guilt', optionId: 'bet' },
  { questionId: 'q5_tracking', optionId: 'auto' },
  { questionId: 'q6_overbudget', optionId: 'analyze' },
  { questionId: 'q7_debt', optionId: 'leverage' },
  { questionId: 'q8_fiveyears', optionId: 'assets' },
];

function ctx(reflections: Array<{ prompt: string; text: string }> = []): DnaOracleContext {
  const persona = resolveDnaPersona(BUILDER_ANSWERS);
  if (!persona) throw new Error('persona null');
  return { persona, answers: BUILDER_ANSWERS, reflections };
}

const GOOD = {
  personaReflection: 'Ngài là người kiến tạo thực thụ, nhìn tiền như hạt giống.',
  strengths: ['Tài sản sinh sôi'],
  blindspots: ['Dễ liều'],
  behaviorActions: ['Đệm trước, kèo sau', 'Chi vui mỗi tháng'],
  mindsetShift: 'Tăng trưởng bền cần cả phanh lẫn ga.',
  growthOrientation: 82,
};

console.log('\nOracle schema — validate strict');

itSync('output chuẩn → pass nguyên vẹn', () => {
  const r = validateDnaOracleReport(GOOD);
  ok(!!r);
  eq(r!.growthOrientation, 82);
  eq(r!.behaviorActions.length, 2);
});

itSync('thiếu personaReflection/mindsetShift/growthOrientation → null', () => {
  eq(validateDnaOracleReport({ ...GOOD, personaReflection: '' }), null);
  eq(validateDnaOracleReport({ ...GOOD, mindsetShift: '   ' }), null);
  eq(validateDnaOracleReport({ ...GOOD, growthOrientation: 'cao' }), null);
  eq(validateDnaOracleReport({ ...GOOD, growthOrientation: NaN }), null);
});

itSync('growthOrientation clamp 0–100, làm tròn', () => {
  eq(validateDnaOracleReport({ ...GOOD, growthOrientation: 250 })!.growthOrientation, 100);
  eq(validateDnaOracleReport({ ...GOOD, growthOrientation: -5 })!.growthOrientation, 0);
  eq(validateDnaOracleReport({ ...GOOD, growthOrientation: 66.6 })!.growthOrientation, 67);
});

itSync('mảng bẩn: phần tử không phải string bị lọc, cắt trần số lượng + độ dài', () => {
  const r = validateDnaOracleReport({
    ...GOOD,
    strengths: ['a', 1, null, 'b', 'c', 'd', 'e'],
    blindspots: ['x'.repeat(9999)],
  });
  ok(!!r);
  eq(r!.strengths.length, 3, 'trần 3');
  ok(r!.blindspots[0].length <= 250, 'cắt độ dài item');
});

itSync('field thừa (persona giả, feasibility…) bị loại tự nhiên', () => {
  const r = validateDnaOracleReport({ ...GOOD, persona: 'hacker', isAdmin: true });
  ok(!!r);
  ok(!('persona' in (r as unknown as Record<string, unknown>)));
});

itSync('parse từ chuỗi có ```json fence + text bao quanh', () => {
  const s = 'Đây là kết quả:\n```json\n' + JSON.stringify(GOOD) + '\n```\ncảm ơn';
  const r = parseDnaOracleReport(s);
  ok(!!r);
  eq(r!.growthOrientation, 82);
});

itSync('parse chuỗi rác/không JSON → null (route sẽ fallback, không trừ credit)', () => {
  eq(parseDnaOracleReport('xin chào tôi là AI'), null);
  eq(parseDnaOracleReport('{"broken": '), null);
  eq(parseDnaOracleReport(''), null);
});

itSync('disclaimer tĩnh đúng spec §6 (không phải từ LLM)', () => {
  ok(DNA_ORACLE_DISCLAIMER.includes('không phải chẩn đoán tâm lý'));
  ok(DNA_ORACLE_DISCLAIMER.includes('tư vấn đầu tư'));
});

console.log('\nOracle prompt — guard + budget');

itSync('system prompt có đủ guard: không phán xét, khủng hoảng, injection, schema', () => {
  const s = buildDnaOracleSystemPrompt();
  ok(s.includes('KHÔNG phán xét'));
  ok(s.includes('khủng hoảng'));
  ok(s.includes('KHÔNG phải mệnh lệnh'));
  ok(s.includes('growthOrientation'));
  ok(s.includes('DUY NHẤT JSON'));
});

itSync('user prompt: persona hệ thống + đáp án + reflection bọc delimiter', () => {
  const u = buildDnaOracleUserPrompt(ctx([{ prompt: 'Ký ức?', text: 'hồi bé nhà nghèo' }]));
  ok(u.includes('KHÔNG thay đổi'));
  ok(u.includes('Người Kiến Tạo'));
  ok(u.includes('<chia_se>'));
  ok(u.includes('hồi bé nhà nghèo'));
});

itSync('reflection dài bị cắt ≤600 + tối đa 3 mục (budget)', () => {
  const long = 'a'.repeat(5000);
  const u = buildDnaOracleUserPrompt(
    ctx([
      { prompt: 'p1', text: long },
      { prompt: 'p2', text: 'x' },
      { prompt: 'p3', text: 'y' },
      { prompt: 'p4', text: 'PHẢI-BỊ-CẮT' },
    ]),
  );
  ok(!u.includes('a'.repeat(601)), 'text phải bị cắt 600');
  ok(!u.includes('PHẢI-BỊ-CẮT'), 'mục thứ 4 phải bị bỏ');
});

itSync('bỏ qua phần chia sẻ → prompt nói rõ, không có delimiter', () => {
  const u = buildDnaOracleUserPrompt(ctx([]));
  ok(u.includes('bỏ qua phần chia sẻ'));
  ok(!u.includes('<chia_se>'));
});

console.log('\nOracle service — fallback 0đ');

itSync('fallback deterministic: đủ 4 phần + growthOrientation từ điểm quiz', () => {
  const r = buildDeterministicDnaOracle(ctx());
  ok(r.personaReflection.includes('Kiến Tạo'));
  ok(r.strengths.length >= 1 && r.blindspots.length >= 1);
  ok(r.behaviorActions.length >= 2);
  ok(r.mindsetShift.length > 10);
  ok(r.growthOrientation >= 0 && r.growthOrientation <= 100);
  // Nghiêng builder hẳn → growth phải trên trung bình.
  ok(r.growthOrientation > 50, `builder lean nhưng growth=${r.growthOrientation}`);
});

it('không có generate → deterministicFallback true', async () => {
  const r = await runDnaOracle(ctx());
  ok(r.deterministicFallback);
});

it('generate trả JSON hợp lệ → dùng bản AI, không fallback', async () => {
  const r = await runDnaOracle(ctx(), {
    generate: async () => ({ content: JSON.stringify(GOOD) }),
  });
  ok(!r.deterministicFallback);
  eq(r.report.growthOrientation, 82);
});

it('generate trả rác → fallback (route sẽ KHÔNG trừ credit)', async () => {
  const r = await runDnaOracle(ctx(), { generate: async () => ({ content: 'not json' }) });
  ok(r.deterministicFallback);
});

it('generate throw → fallback, không throw ra ngoài', async () => {
  const r = await runDnaOracle(ctx(), {
    generate: async () => { throw new Error('boom'); },
  });
  ok(r.deterministicFallback);
});

console.log('\nGate cấp 3 — dna.oracle KHÔNG suất nếm');

itSync('dna.oracle cần cấp 3: free/pro bị chặn, pro_plus mở', () => {
  // Mô phỏng enforce (billingLevelCap đọc env — test qua hasFeature với level trực tiếp).
  ok(!hasFeature(1, 'dna.oracle'));
  ok(!hasFeature(2, 'dna.oracle'));
  ok(hasFeature(3, 'dna.oracle'));
});

itSync('dna.oracle KHÔNG có trong bảng taste (không nếm được)', () => {
  eq(FEATURE_TASTE_QUOTA['dna.oracle' as keyof typeof FEATURE_TASTE_QUOTA], undefined);
});

itSync('chưa enforce → cap 3 (FOMO giữ nguyên)', () => {
  // NEXT_PUBLIC_BUTLER_BILLING_ENFORCED không set trong test env.
  eq(billingLevelCap('free'), 3);
});

console.log('\ngrowthOrientation → capacity engine');

itSync('có điểm DNA → dùng thật, không pending Oracle', () => {
  const base = {
    daysLoggedLast30: 10, budgetTotal: 2, budgetWithin: 2, goalsTotal: 1, goalsFunded: 1,
    streakDays: 5, chatUserMessages: 10, featuresUsed: 3, featuresTotal: 5,
    onboardingDone: -1, onboardingTotal: 7, skillsDeclared: 3, earningTasksTotal: 1,
    earningTasksCompleted: 1, freeTimeHoursPerWeek: 10, emergencyFundMonths: 2, cfoReportViews: 1,
  };
  const withDna = buildCapacityComponents({ ...base, growthOrientation: 82 });
  eq(withDna.components.growthOrientation, 82);
  ok(!withDna.pending.some((p) => p.includes('Tư duy Tăng trưởng')));

  const noDna = buildCapacityComponents({ ...base, growthOrientation: -1 });
  eq(noDna.components.growthOrientation, 50);
  ok(noDna.pending.some((p) => p.includes('Tư duy Tăng trưởng')));

  const clamped = buildCapacityComponents({ ...base, growthOrientation: 999 });
  eq(clamped.components.growthOrientation, 100);
});

console.log('');
