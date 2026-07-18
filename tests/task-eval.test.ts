/* ═══ Task Eval — schema + prompt + service (T5) ═══
 * Chốt: validator strip field thừa (feasibility) + bắt buộc oneLineCoach; prompt budget
 * (cắt subtask/kỹ năng, có sẵn điểm để AI không bịa); service không throw + fallback đúng.
 */
import {
  validateTaskEvalAIResponse,
  parseTaskEvalAIResponse,
} from '@/lib/aiMoneyChat/taskEval/taskEvalSchema';
import {
  buildTaskEvalSystemPrompt,
  buildTaskEvalUserPrompt,
  type TaskEvalContext,
} from '@/lib/aiMoneyChat/taskEval/taskEvalPrompt';
import { runTaskEval, buildDeterministicTaskEval } from '@/lib/aiMoneyChat/taskEval/taskEvalService';
import { computeTaskEvalHash } from '@/lib/aiMoneyChat/taskEval/taskEvalHash';
import { buildTaskEvalContext } from '@/lib/aiMoneyChat/taskEval/taskEvalContext';
import type { EarningTask } from '@/types/task';

function it(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`  PASS ${name}`))
    .catch((e) => { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; });
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function ctx(o: Partial<TaskEvalContext> = {}): TaskEvalContext {
  return {
    name: o.name ?? 'Freelance thiết kế logo',
    expectedAmount: o.expectedAmount ?? 3_000_000,
    daysLeft: o.daysLeft ?? 5,
    totalDays: o.totalDays ?? 10,
    feasibility: o.feasibility ?? 72,
    subtaskProgress: o.subtaskProgress ?? 60,
    subtaskDone: o.subtaskDone ?? 3,
    subtaskTotal: o.subtaskTotal ?? 5,
    historicalRate: o.historicalRate ?? 60,
    subtasks: o.subtasks ?? ['Liên hệ khách', 'Gửi nháp v1', 'Chỉnh theo feedback'],
    skills: o.skills ?? ['design', 'illustrator'],
  };
}

async function main() {
  console.log('\nTask Eval — schema');

  it('valid đầy đủ → parse; price giữ nguyên', () => {
    const r = validateTaskEvalAIResponse({
      missingSubtasks: ['Ký hợp đồng', ''],
      risks: ['Khách đổi yêu cầu'],
      suggestedPriceRange: { min: 2_500_000, max: 4_000_000 },
      oneLineCoach: 'Cứ làm tới, ngài sắp xong rồi!',
    });
    ok(!!r, 'parsed');
    eq(r!.missingSubtasks.length, 1, 'lọc chuỗi rỗng');
    eq(r!.suggestedPriceRange!.min, 2_500_000);
    eq(r!.oneLineCoach.includes('sắp xong'), true);
  });

  it('thiếu oneLineCoach → null', () => {
    eq(validateTaskEvalAIResponse({ missingSubtasks: ['x'], risks: [] }), null);
  });

  it('field thừa feasibility bị loại (chuẩn nhà: số của engine)', () => {
    const r = validateTaskEvalAIResponse({ feasibility: 99, oneLineCoach: 'ok' }) as unknown as Record<string, unknown>;
    ok(!('feasibility' in r), 'không có feasibility trong output');
  });

  it('price min>max → tự đảo', () => {
    const r = validateTaskEvalAIResponse({ oneLineCoach: 'x', suggestedPriceRange: { min: 5_000_000, max: 2_000_000 } });
    eq(r!.suggestedPriceRange!.min, 2_000_000);
    eq(r!.suggestedPriceRange!.max, 5_000_000);
  });

  it('parse từ chuỗi ```json fences', () => {
    const r = parseTaskEvalAIResponse('```json\n{"oneLineCoach":"đi thôi","risks":["trễ"]}\n```');
    ok(!!r && r.risks[0] === 'trễ', 'parse fenced');
  });

  console.log('\nTask Eval — prompt');

  it('system prompt: yêu cầu JSON + cấm tự tính điểm', () => {
    const s = buildTaskEvalSystemPrompt();
    ok(s.includes('JSON'), 'nhắc JSON');
    ok(s.includes('KHÔNG tự tính'), 'cấm tự chấm điểm');
  });

  it('user prompt: có tên/tiền/điểm/subtask; cắt subtask ≤10', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Bước ${i}`);
    const p = buildTaskEvalUserPrompt(ctx({ subtasks: many, feasibility: 72 }));
    ok(p.includes('Freelance thiết kế logo'), 'tên');
    ok(p.includes('3.000.000'), 'tiền');
    ok(p.includes('72/100'), 'điểm hệ thống');
    ok(p.includes('Bước 0') && !p.includes('Bước 12'), 'cắt subtask ≤10');
  });

  it('user prompt: chưa khảo sát kỹ năng → hiện fallback', () => {
    ok(buildTaskEvalUserPrompt(ctx({ skills: [] })).includes('(chưa khảo sát)'), 'fallback kỹ năng');
  });

  console.log('\nTask Eval — service (không throw + fallback)');

  it('không generate → fallback deterministic, feasibility passthrough', async () => {
    const r = await runTaskEval(ctx({ feasibility: 55 }));
    eq(r.deterministicFallback, true);
    eq(r.feasibility, 55, 'điểm từ engine');
    ok(r.ai.oneLineCoach.length > 0, 'có coach');
  });

  it('generate JSON hợp lệ → không fallback, giữ feasibility engine', async () => {
    const r = await runTaskEval(ctx({ feasibility: 80 }), {
      generate: async () => ({ content: '{"oneLineCoach":"tốt lắm","missingSubtasks":["Xuất hoá đơn"],"risks":[]}', provider: 'groq', tokensUsed: 120 }),
    });
    eq(r.deterministicFallback, false);
    eq(r.feasibility, 80);
    eq(r.ai.missingSubtasks[0], 'Xuất hoá đơn');
  });

  it('generate throw → fallback (không crash)', async () => {
    const r = await runTaskEval(ctx(), { generate: async () => { throw new Error('LLM down'); } });
    eq(r.deterministicFallback, true);
  });

  it('generate rác → fallback', async () => {
    const r = await runTaskEval(ctx(), { generate: async () => ({ content: 'không phải json' }) });
    eq(r.deterministicFallback, true);
  });

  it('fallback: quá hạn → có rủi ro "quá hạn"; điểm thấp → coach hối thúc', () => {
    const r = buildDeterministicTaskEval(ctx({ daysLeft: -3, feasibility: 25, subtaskTotal: 0 }));
    ok(r.risks.some((x) => x.includes('quá hạn')), 'rủi ro quá hạn');
    ok(r.missingSubtasks.some((x) => x.includes('Chia nhiệm vụ')), 'gợi ý chia nhỏ khi 0 subtask');
    ok(r.oneLineCoach.length > 0, 'coach');
  });

  console.log('\nTask Eval — cache hash + context builder');

  const etask = (o: Partial<EarningTask> = {}): EarningTask => ({
    id: o.id ?? 'k1', name: o.name ?? 'Freelance logo', expectedAmount: o.expectedAmount ?? 3_000_000,
    startDate: o.startDate ?? '2026-07-10', endDate: o.endDate ?? '2026-07-20', createdAt: '2026-07-09',
    subTasks: o.subTasks ?? [
      { id: 'a', name: 'Liên hệ khách', isCompleted: true },
      { id: 'b', name: 'Gửi nháp', isCompleted: false },
    ],
    completedAt: o.completedAt, deletedAt: o.deletedAt,
  });

  it('hash ổn định; đổi tên/tiền/subtask/tick → hash đổi', () => {
    const base = computeTaskEvalHash(etask());
    eq(computeTaskEvalHash(etask()), base, 'ổn định');
    ok(computeTaskEvalHash(etask({ name: 'Khác' })) !== base, 'đổi tên');
    ok(computeTaskEvalHash(etask({ expectedAmount: 4_000_000 })) !== base, 'đổi tiền');
    ok(computeTaskEvalHash(etask({ subTasks: [{ id: 'a', name: 'Liên hệ khách', isCompleted: true }] })) !== base, 'đổi subtask');
    ok(computeTaskEvalHash(etask({ subTasks: [
      { id: 'a', name: 'Liên hệ khách', isCompleted: true },
      { id: 'b', name: 'Gửi nháp', isCompleted: true },
    ] })) !== base, 'tick subtask → hash đổi');
  });

  it('context builder: tính feasibility + trích tên subtask + kỹ năng', () => {
    const c = buildTaskEvalContext(etask(), [etask()], ['design', ''], '2026-07-15T12:00:00Z');
    eq(c.name, 'Freelance logo');
    eq(c.subtaskTotal, 2);
    ok(c.feasibility > 0 && c.feasibility <= 100, `feasibility=${c.feasibility}`);
    ok(c.subtasks.includes('Liên hệ khách'), 'giữ tên subtask');
    eq(c.skills.length, 1, 'lọc kỹ năng rỗng');
  });

  console.log('\nTask Eval test suite complete.');
}

main();
