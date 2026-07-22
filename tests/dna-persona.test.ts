/* ═══ Financial DNA — Persona engine (PV-3 · B1) ═══
 * Deterministic: mapping trọng số, hybrid, teaser subset, sanitize input bẩn.
 */
import {
  DNA_QUESTIONS,
  TEASER_QUESTIONS,
  sanitizeDnaAnswers,
  describeAnswer,
  type DnaAnswer,
} from '@/lib/aiMoneyChat/prism/dna/dnaQuestions';
import {
  DNA_PERSONAS,
  DNA_PERSONA_IDS,
  scoreDnaAnswers,
  resolveDnaPersona,
  resolveTeaserPersona,
  type DnaPersonaId,
} from '@/lib/aiMoneyChat/prism/dna/personaEngine';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

/** Chọn cho MỖI câu đáp án nặng về persona chỉ định (nếu câu có). */
function answersLeaning(pid: DnaPersonaId): DnaAnswer[] {
  const out: DnaAnswer[] = [];
  for (const q of DNA_QUESTIONS) {
    const best = [...q.options].sort((a, b) => (b.weights[pid] ?? 0) - (a.weights[pid] ?? 0))[0];
    if ((best.weights[pid] ?? 0) > 0) out.push({ questionId: q.id, optionId: best.id });
  }
  return out;
}

console.log('\nDNA — cấu trúc bộ câu hỏi');

it('có đúng 8 câu, 4 câu teaser đầu tiên', () => {
  eq(DNA_QUESTIONS.length, 8);
  eq(TEASER_QUESTIONS.length, 4);
  ok(DNA_QUESTIONS.slice(0, 4).every((q) => q.teaser), '4 câu đầu phải là teaser');
});

it('mỗi persona đều được ít nhất 3 câu "nuôi" điểm (không nhóm nào mù)', () => {
  for (const pid of DNA_PERSONA_IDS) {
    const feeding = DNA_QUESTIONS.filter((q) => q.options.some((o) => (o.weights[pid] ?? 0) > 0));
    ok(feeding.length >= 3, `${pid} chỉ có ${feeding.length} câu nuôi điểm`);
  }
});

it('id câu hỏi + option không trùng lặp', () => {
  const qids = new Set(DNA_QUESTIONS.map((q) => q.id));
  eq(qids.size, DNA_QUESTIONS.length);
  for (const q of DNA_QUESTIONS) {
    eq(new Set(q.options.map((o) => o.id)).size, q.options.length, q.id);
  }
});

console.log('\nDNA — sanitize input bẩn');

it('bỏ answer không hợp lệ + khử trùng lặp theo câu (giữ lần đầu)', () => {
  const dirty = [
    { questionId: 'q1_surplus', optionId: 'keep' },
    { questionId: 'q1_surplus', optionId: 'invest' }, // trùng câu → bỏ
    { questionId: 'q1_surplus', optionId: 'hacked' }, // option lạ → bỏ
    { questionId: 'nope', optionId: 'keep' }, // câu lạ → bỏ
    { questionId: 42, optionId: null }, // rác kiểu → bỏ
    'string rác',
    null,
  ];
  const clean = sanitizeDnaAnswers(dirty);
  eq(clean.length, 1);
  eq(clean[0].optionId, 'keep');
});

it('sanitize input không phải mảng → []', () => {
  eq(sanitizeDnaAnswers(null).length, 0);
  eq(sanitizeDnaAnswers({ a: 1 }).length, 0);
  eq(sanitizeDnaAnswers('x').length, 0);
});

it('describeAnswer trả label đúng, null cho answer lạ', () => {
  const d = describeAnswer({ questionId: 'q3_meaning', optionId: 'tool' });
  ok(!!d && d.answer.includes('Công cụ'));
  eq(describeAnswer({ questionId: 'q3_meaning', optionId: 'zzz' }), null);
});

console.log('\nDNA — chấm điểm + persona');

it('mỗi persona thuần đều thắng khi trả lời nghiêng hẳn về nó', () => {
  for (const pid of DNA_PERSONA_IDS) {
    const r = resolveDnaPersona(answersLeaning(pid));
    ok(!!r, `${pid}: null`);
    eq(r!.primary.id, pid, `lean ${pid}`);
  }
});

it('điểm chuẩn hoá 0–100 và tổng ~100', () => {
  const { scores } = scoreDnaAnswers(answersLeaning('builder'));
  const total = DNA_PERSONA_IDS.reduce((s, p) => s + scores[p], 0);
  ok(total >= 97 && total <= 103, `tổng ${total}`);
  for (const p of DNA_PERSONA_IDS) ok(scores[p] >= 0 && scores[p] <= 100);
});

it('deterministic: cùng input → cùng output', () => {
  const a = answersLeaning('guardian');
  eq(JSON.stringify(resolveDnaPersona(a)), JSON.stringify(resolveDnaPersona(a)));
});

it('không trả lời gì → null (không bịa persona)', () => {
  eq(resolveDnaPersona([]), null);
});

it('hybrid khi 2 nhóm sát điểm (guardian × avoider)', () => {
  // Nghiêng đều 2 nhóm: chọn xen kẽ đáp án guardian và avoider.
  const answers: DnaAnswer[] = [
    { questionId: 'q1_surplus', optionId: 'keep' }, // guardian 3
    { questionId: 'q2_feeling', optionId: 'avoid' }, // avoider 3
    { questionId: 'q3_meaning', optionId: 'safety' }, // guardian 3
    { questionId: 'q4_guilt', optionId: 'forgot' }, // avoider 3
  ];
  const r = resolveDnaPersona(answers);
  ok(!!r);
  ok(r!.isHybrid, 'phải là hybrid');
  const pair = [r!.primary.id, r!.secondary?.id].sort().join('+');
  eq(pair, 'avoider+guardian');
  ok(!!r!.hybridLabel && r!.hybridLabel.includes('×'));
});

it('không hybrid khi cách biệt lớn', () => {
  const r = resolveDnaPersona(answersLeaning('builder'));
  ok(!r!.isHybrid || r!.scores[r!.primary.id] - r!.scores[r!.secondary!.id] <= 15);
});

console.log('\nDNA — teaser');

it('teaser chỉ chấm 4 câu đầu, bỏ qua câu ngoài teaser', () => {
  const answers: DnaAnswer[] = [
    { questionId: 'q1_surplus', optionId: 'invest' }, // teaser: builder
    { questionId: 'q7_debt', optionId: 'never' }, // ngoài teaser: guardian — phải bị bỏ
  ];
  const r = resolveTeaserPersona(answers);
  ok(!!r);
  eq(r!.primary.id, 'builder');
  eq(r!.answeredCount, 1, 'chỉ đếm câu teaser');
});

it('teaser chưa trả lời → null', () => {
  eq(resolveTeaserPersona([{ questionId: 'q8_fiveyears', optionId: 'assets' }]), null);
});

console.log('\nDNA — profile persona đầy đủ (giọng không phán xét)');

it('5 persona đều có strengths + blindspots + actions + mindsetShift', () => {
  for (const pid of DNA_PERSONA_IDS) {
    const p = DNA_PERSONAS[pid];
    ok(p.strengths.length >= 1, `${pid} thiếu strengths`);
    ok(p.blindspots.length >= 1, `${pid} thiếu blindspots`);
    ok(p.defaultActions.length >= 2, `${pid} thiếu defaultActions`);
    ok(p.defaultMindsetShift.length > 10, `${pid} thiếu mindsetShift`);
    ok(p.tagline.length > 10, `${pid} thiếu tagline`);
  }
});

console.log('');
