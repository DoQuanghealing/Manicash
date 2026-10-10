/* Đợt 1 — Thư viện mẫu + khép vòng Việc → Tiền (docs/SPEC_DOT_1_THU_VIEN_MAU.md) */
import { migrateTasksState, useTaskStore } from '@/stores/useTaskStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  receiveTaskPayment, undoReceiveTaskPayment, getOutstandingSummary, getPaymentLateDays, incomeCategoryForTask,
} from '@/lib/tasks/receiveTaskPayment';
import {
  EARNING_THEMES, EARNING_TEMPLATES, getEarningTemplate, rankThemesBySkills, templatesForTheme,
  taskDraftFromTemplate, suggestedAmount,
} from '@/data/earningTemplates';
import { SKILL_OPTIONS } from '@/lib/aiMoneyChat/prism/capacity/capacitySurvey';
import { INCOME_CATEGORIES } from '@/data/categories';
import { executeMoneyActionOnClient, type ExecuteActionResult } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import { undoMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionUndoExecutor';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';
import { getTaskStatus as brainTaskStatus } from '@/lib/moneyBrain/taskMetrics';
import type { EarningTask } from '@/types/task';
import { toMoneySnapshotV1 } from '@/lib/moneyBrain/snapshot';
import { buildCFOContextPack } from '@/lib/moneyBrain/cfoContextPack';
import { validateClientSnapshot, getFinanceSnapshot, __clearSnapshotCacheForTest } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import { mergeCloudAndLocal } from '@/lib/moneySync/merge';
import { deserializeCloudMoneyDocument } from '@/lib/moneySync/serialize';
import type { CloudMoneyDocumentV1 } from '@/lib/moneySync/cloudTypes';
import { useBudgetStore } from '@/stores/useBudgetStore';
import type { UserProfile } from '@/types/user';

type Fn = () => void | Promise<void>;
async function it(name: string, fn: Fn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const today = new Date();
const dayKey = (offset: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function task(over: Partial<EarningTask> = {}): EarningTask {
  return {
    id: 't1', name: 'Thiết kế banner', expectedAmount: 300_000,
    startDate: dayKey(-3), endDate: dayKey(2), createdAt: '2026-10-01T00:00:00.000Z',
    subTasks: [{ id: 's1', name: 'Gửi 2 phương án', isCompleted: false }],
    ...over,
  };
}

function seed(tasks: EarningTask[], xp = 1000): void {
  useTaskStore.setState({ tasks, xpPenalties: [] });
  useFinanceStore.setState({ transactions: [], mainBalance: 1_000_000, cashBalance: 0, emergencyBalance: 0, billFundBalance: 0 });
  useAuthStore.setState({ user: { uid: 'u', displayName: 'T', email: '', photoURL: null, rank: 'gold', xp, streak: 5, lastActiveDate: dayKey(0), streakShields: 1, resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free', premiumExpiresAt: null, accountStatus: 'active', createdAt: '', updatedAt: '' } as UserProfile });
}

const DUMMY: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: new Date().toISOString(), timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 0, emergency: 0, billFund: 0 }, transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
};
const req = (action: MoneyActionRequest['action'], payload: MoneyActionRequest['payload']): MoneyActionRequest =>
  createActionRequest(DUMMY, { action, payload, preview: '' });
function recordFrom(request: MoneyActionRequest, res: ExecuteActionResult): MoneyActionAuditRecord {
  return { id: 'r', requestId: request.requestId, action: request.action, request, status: 'executed', createdAt: '', updatedAt: '', undoable: res.ok ? res.undoable : false, undoSnapshot: res.ok ? res.undoSnapshot : undefined, preview: '', events: [] };
}

async function main() {
  console.log('\nĐợt 1 — migrate v1 → v2');

  await it('migrate: rỗng / hỏng → mảng rỗng', () => {
    eq(migrateTasksState(undefined).tasks.length, 0);
    eq(migrateTasksState({ tasks: 'x', xpPenalties: null }).tasks.length, 0);
    eq(migrateTasksState({ tasks: [null, 5, { name: 'không id' }] }).tasks.length, 0, 'bỏ phần tử hỏng');
  });

  await it('migrate: đủ 3 loại task v1 → đúng stage + updatedAt', () => {
    const out = migrateTasksState({
      tasks: [
        task({ id: 'a' }),
        task({ id: 'b', completedAt: '2026-10-05T00:00:00.000Z', actualAmount: 250_000 }),
        task({ id: 'c', deletedAt: '2026-10-04T00:00:00.000Z' }),
      ],
      xpPenalties: [{ taskId: 'c', penaltyMultiplier: 0.7, remainingTasks: 3 }],
    });
    const by = Object.fromEntries(out.tasks.map((t) => [t.id, t]));
    eq(by.a.stage, 'doing'); eq(by.a.updatedAt, '2026-10-01T00:00:00.000Z');
    eq(by.b.stage, 'paid'); eq(by.b.updatedAt, '2026-10-05T00:00:00.000Z');
    eq(by.c.stage, 'doing'); eq(by.c.deletedAt, '2026-10-04T00:00:00.000Z', 'giữ deletedAt');
    eq(by.b.incomeTxnId, undefined, 'KHÔNG tạo bù giao dịch cho task cũ');
    eq(out.xpPenalties.length, 1, 'giữ penalty');
  });

  await it('migrate: chạy 2 lần không đổi (idempotent)', () => {
    const once = migrateTasksState({ tasks: [task({ id: 'a' }), task({ id: 'b', completedAt: '2026-10-05T00:00:00.000Z' })] });
    const twice = migrateTasksState(once);
    eq(JSON.stringify(twice), JSON.stringify(once));
  });

  console.log('\nĐợt 1 — nhận tiền');

  await it('nhận tiền: tạo ĐÚNG 1 giao dịch thu + cộng ví + đánh dấu paid + XP tăng', () => {
    seed([task()]);
    const xp0 = useAuthStore.getState().user!.xp;
    const res = receiveTaskPayment({ taskId: 't1', amount: 350_000 });
    ok(res.ok, 'ok');
    const txns = useFinanceStore.getState().transactions;
    eq(txns.length, 1, '1 giao dịch');
    eq(txns[0].type, 'income'); eq(txns[0].amount, 350_000); eq(txns[0].wallet, 'main');
    eq(txns[0].categoryId, 'freelance', 'danh mục mặc định');
    ok(/^txn-\d+-/.test(txns[0].id), 'id dạng txn-<ms>- (usageMetrics đọc mốc từ id)');
    eq(txns[0].note, 'Nhiệm vụ: Thiết kế banner');
    eq(useFinanceStore.getState().mainBalance, 1_350_000, 'cộng ví chính');
    const t = useTaskStore.getState().tasks[0];
    eq(t.stage, 'paid'); eq(t.actualAmount, 350_000); eq(t.incomeTxnId, txns[0].id); ok(!!t.completedAt, 'completedAt');
    ok(useAuthStore.getState().user!.xp > xp0, 'XP tăng');
  });

  await it('nhận tiền lần 2 trên cùng task → từ chối, KHÔNG thêm giao dịch, KHÔNG cộng XP', () => {
    const xp1 = useAuthStore.getState().user!.xp;
    const res = receiveTaskPayment({ taskId: 't1', amount: 350_000 });
    eq(res.ok, false);
    eq(useFinanceStore.getState().transactions.length, 1);
    eq(useAuthStore.getState().user!.xp, xp1);
    eq(useTaskStore.getState().completeTask('t1', 1), false, 'completeTask cũng chặn lần 2');
  });

  await it('hoàn tác: xoá đúng giao dịch, trả ví + XP, task về Đang làm, checklist như cũ', () => {
    seed([task()], 1000);
    const res = receiveTaskPayment({ taskId: 't1', amount: 350_000 });
    ok(res.ok, 'ok');
    if (!res.ok) return;
    ok(undoReceiveTaskPayment(res.undo), 'undo ok');
    eq(useFinanceStore.getState().transactions.length, 0, 'giao dịch đã gỡ');
    eq(useFinanceStore.getState().mainBalance, 1_000_000, 'ví về như cũ');
    eq(useAuthStore.getState().user!.xp, 1000, 'XP về như cũ');
    const t = useTaskStore.getState().tasks[0];
    eq(t.stage, 'doing'); eq(t.completedAt, undefined); eq(t.incomeTxnId, undefined);
    eq(t.subTasks[0].isCompleted, false, 'checklist khôi phục');
    eq(undoReceiveTaskPayment(res.undo), false, 'undo lần 2 → false');
  });

  await it('ví tiền mặt + danh mục theo mẫu', () => {
    seed([task({ templateId: 'sell-preorder-snacks' })]);
    eq(incomeCategoryForTask({ templateId: 'sell-preorder-snacks' }), 'business');
    const res = receiveTaskPayment({ taskId: 't1', amount: 200_000, method: 'cash' });
    ok(res.ok, 'ok');
    eq(useFinanceStore.getState().transactions[0].categoryId, 'business');
    eq(useFinanceStore.getState().cashBalance, 200_000, 'cộng tiền mặt');
  });

  await it('số tiền 0 → khép task, không tạo giao dịch; số âm → từ chối', () => {
    seed([task(), task({ id: 't2' })]);
    eq(receiveTaskPayment({ taskId: 't1', amount: -5 }).ok, false);
    const res = receiveTaskPayment({ taskId: 't1', amount: 0 });
    ok(res.ok, 'ok');
    eq(useFinanceStore.getState().transactions.length, 0);
    eq(useTaskStore.getState().tasks[0].stage, 'paid');
  });

  await it('ngày nhận lùi > 30 ngày → lỗi, task KHÔNG bị đánh dấu', () => {
    seed([task()]);
    const old = new Date(); old.setDate(old.getDate() - 40);
    const res = receiveTaskPayment({ taskId: 't1', amount: 100_000, receivedAt: old });
    eq(res.ok, false);
    eq(useTaskStore.getState().tasks[0].completedAt, undefined);
  });

  console.log('\nĐợt 1 — Chờ thanh toán');

  await it('markWorkDone: vào Chờ thanh toán, tick checklist, ghi khách + hẹn, không cộng XP', () => {
    seed([task()], 1000);
    ok(useTaskStore.getState().markWorkDone('t1', { payerName: '  Chị Lan  ', paymentDueDate: dayKey(5) }), 'ok');
    const t = useTaskStore.getState().tasks[0];
    eq(t.stage, 'awaiting_payment'); eq(t.payerName, 'Chị Lan'); eq(t.paymentDueDate, dayKey(5));
    ok(!!t.workDoneAt, 'workDoneAt'); eq(t.subTasks[0].isCompleted, true);
    eq(useAuthStore.getState().user!.xp, 1000, 'chưa cộng XP');
    eq(useTaskStore.getState().markWorkDone('t1'), false, 'không vào lần 2');
  });

  await it('Chờ thanh toán quá hạn làm → KHÔNG thành "trễ" (cả store lẫn CFO)', () => {
    seed([task({ startDate: dayKey(-10), endDate: dayKey(-5), stage: 'awaiting_payment', workDoneAt: '2026-10-01T00:00:00.000Z' })]);
    const t = useTaskStore.getState().tasks[0];
    eq(useTaskStore.getState().getStatus(t), 'active');
    eq(brainTaskStatus({ ...t, stage: 'awaiting_payment' }, DUMMY), 'active');
    eq(brainTaskStatus({ ...t, stage: 'doing' }, DUMMY), 'overdue', 'đang làm quá hạn vẫn là trễ');
  });

  await it('undoMarkWorkDone: về Đang làm + khôi phục checklist', () => {
    seed([task()]);
    const before = useTaskStore.getState().tasks[0].subTasks.map((s) => ({ ...s }));
    useTaskStore.getState().markWorkDone('t1');
    ok(useTaskStore.getState().undoMarkWorkDone('t1', { subTasks: before }), 'ok');
    const t = useTaskStore.getState().tasks[0];
    eq(t.stage, 'doing'); eq(t.workDoneAt, undefined); eq(t.subTasks[0].isCompleted, false);
  });

  await it('nhận tiền từ Chờ thanh toán; hoàn tác quay về Chờ thanh toán', () => {
    seed([task()]);
    useTaskStore.getState().markWorkDone('t1', { payerName: 'Anh Minh' });
    const res = receiveTaskPayment({ taskId: 't1', amount: 300_000 });
    ok(res.ok, 'ok');
    if (!res.ok) return;
    eq(res.undo.stage, 'awaiting_payment');
    undoReceiveTaskPayment(res.undo);
    eq(useTaskStore.getState().tasks[0].stage, 'awaiting_payment');
  });

  await it('tổng khách còn nợ + số ngày trễ hẹn', () => {
    const list = [
      task({ id: 'a', stage: 'awaiting_payment', expectedAmount: 500_000 }),
      task({ id: 'b', stage: 'awaiting_payment', expectedAmount: 750_000, paymentDueDate: dayKey(-3) }),
      task({ id: 'c', stage: 'awaiting_payment', expectedAmount: 999_000, deletedAt: '2026-10-01T00:00:00.000Z' }),
      task({ id: 'd', expectedAmount: 1_000_000 }),
      task({ id: 'e', stage: 'paid', completedAt: '2026-10-02T00:00:00.000Z' }),
    ];
    const s = getOutstandingSummary(list);
    eq(s.amount, 1_250_000); eq(s.count, 2);
    eq(getPaymentLateDays(list[1]), 3);
    eq(getPaymentLateDays(list[0]), 0, 'không hẹn → 0');
    eq(getPaymentLateDays(task({ paymentDueDate: dayKey(-3) })), 0, 'đang làm → 0');
  });

  await it('updatedAt đổi ở mọi thao tác sửa (để gộp Money Sync đúng)', () => {
    seed([task({ updatedAt: '2000-01-01T00:00:00.000Z' })]);
    useTaskStore.getState().toggleSubTask('t1', 's1');
    ok(useTaskStore.getState().tasks[0].updatedAt! > '2000-01-01', 'toggleSubTask');
    useTaskStore.setState({ tasks: [task({ updatedAt: '2000-01-01T00:00:00.000Z' })] });
    useTaskStore.getState().updateTask('t1', { payerName: 'x'.repeat(80) });
    const t = useTaskStore.getState().tasks[0];
    ok(t.updatedAt! > '2000-01-01', 'updateTask'); eq(t.payerName!.length, 60, 'cắt tên khách 60 ký tự');
    const added = useTaskStore.getState().addTask({ name: 'Mới', expectedAmount: 1, startDate: dayKey(0), endDate: dayKey(1), templateId: 'free-translate' });
    eq(added.stage, 'doing'); ok(!!added.updatedAt, 'addTask có updatedAt'); eq(added.templateId, 'free-translate');
  });

  console.log('\nĐợt 1 — chat COMPLETE_EARNING_TASK đi đường mới');

  await it('chat hoàn thành → có giao dịch thu; undo chat → gỡ giao dịch + XP', async () => {
    seed([task()], 2000);
    const r = req('COMPLETE_EARNING_TASK', { taskId: 't1', taskName: 'Thiết kế banner', expectedAmount: 300_000, actualAmount: 280_000 });
    const res = await executeMoneyActionOnClient(r);
    ok(res.ok, 'ok');
    eq(useFinanceStore.getState().transactions.length, 1);
    eq(useFinanceStore.getState().transactions[0].amount, 280_000);
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undo ok');
    eq(useFinanceStore.getState().transactions.length, 0, 'giao dịch gỡ');
    eq(useAuthStore.getState().user!.xp, 2000, 'XP về như cũ');
    eq(useTaskStore.getState().tasks[0].completedAt, undefined);
  });

  await it('undo bản ghi cũ (trước Đợt 1, không có transactionId) vẫn chạy', async () => {
    seed([task({ completedAt: '2026-10-05T00:00:00.000Z', actualAmount: 300_000, stage: 'paid' })], 2000);
    const r = req('COMPLETE_EARNING_TASK', { taskId: 't1', taskName: 'x', expectedAmount: 300_000 });
    const rec = recordFrom(r, { ok: true, message: '', undoable: true, undoSnapshot: { action: 'COMPLETE_EARNING_TASK', before: { taskId: 't1', subTasks: [{ id: 's1', name: 'a', isCompleted: false }], xpPenalties: [] }, after: { taskId: 't1' } } });
    const undo = await undoMoneyActionOnClient(rec);
    ok(undo.ok, 'ok');
    eq(useTaskStore.getState().tasks[0].stage, 'doing');
  });

  console.log('\nĐợt 1 — thư viện mẫu');

  await it('dữ liệu mẫu hợp lệ', () => {
    eq(EARNING_THEMES.length, 6, '6 chủ đề');
    ok(EARNING_TEMPLATES.length >= 30 && EARNING_TEMPLATES.length <= 36, `30–36 mẫu, có ${EARNING_TEMPLATES.length}`);
    const ids = new Set(EARNING_TEMPLATES.map((t) => t.id));
    eq(ids.size, EARNING_TEMPLATES.length, 'id duy nhất');
    const skillIds = new Set(SKILL_OPTIONS.map((s) => s.id));
    const incomeIds = new Set(INCOME_CATEGORIES.map((c) => c.id));
    for (const th of EARNING_THEMES) {
      const n = EARNING_TEMPLATES.filter((t) => t.themeId === th.id).length;
      ok(n >= 5 && n <= 6, `${th.id}: 5–6 mẫu, có ${n}`);
      for (const s of th.skills) ok(skillIds.has(s), `theme ${th.id} skill lạ ${s}`);
    }
    for (const t of EARNING_TEMPLATES) {
      ok(t.priceRange.min > 0 && t.priceRange.min <= t.priceRange.max, `${t.id}: khung giá`);
      ok(t.steps.length >= 3 && t.steps.length <= 5, `${t.id}: 3–5 bước`);
      ok(t.typicalDays >= 1, `${t.id}: số ngày`);
      ok(incomeIds.has(t.incomeCategory), `${t.id}: danh mục thu lạ`);
      for (const s of t.skills) ok(skillIds.has(s), `${t.id}: skill lạ ${s}`);
    }
  });

  await it('xếp chủ đề theo La bàn năng lực', () => {
    eq(rankThemesBySkills([]).themes.map((t) => t.id).join(), EARNING_THEMES.map((t) => t.id).join(), 'không kỹ năng → mặc định');
    eq(rankThemesBySkills([]).matched.size, 0);
    const r = rankThemesBySkills(['teaching', 'language']);
    eq(r.themes[0].id, 'tutoring'); ok(r.matched.has('tutoring'), 'Hợp với bạn');
    eq(templatesForTheme('freelance', ['video'])[0].id, 'free-short-video');
  });

  await it('form điền sẵn từ mẫu', () => {
    const tpl = getEarningTemplate('free-social-design')!;
    eq(suggestedAmount(tpl), 325_000, 'giữa khung giá');
    const d = taskDraftFromTemplate(tpl, new Date(2026, 9, 8));
    eq(d.startDate, '2026-10-08'); eq(d.endDate, '2026-10-10'); eq(d.templateId, 'free-social-design');
    eq(d.subTasks.length, tpl.steps.length);
    eq(taskDraftFromTemplate(tpl, new Date(2026, 11, 31)).endDate, '2027-01-02', 'qua năm');
  });


  console.log('\nĐợt 1 — hồi quy redteam vòng 1');

  await it('#1 CFO: việc Chờ thanh toán quá hạn làm KHÔNG bị đếm trễ (đi qua toMoneySnapshotV1 → buildCFOContextPack)', () => {
    const tasks = [
      { id: 'a', name: 'chờ', expectedAmount: 500_000, startDate: dayKey(-10), endDate: dayKey(-3), stage: 'awaiting_payment', subTasks: [] },
      { id: 'b', name: 'trễ thật', expectedAmount: 300_000, startDate: dayKey(-10), endDate: dayKey(-3), stage: 'doing', subTasks: [] },
    ];
    const snap = toMoneySnapshotV1({ clientNow: new Date().toISOString(), timezone: 'Asia/Ho_Chi_Minh', tasks } as never);
    eq(snap.tasks.find((t) => t.id === 'a')?.stage, 'awaiting_payment', 'stage đi qua snapshot');
    const pack = buildCFOContextPack(snap) as unknown as { earningTasks: { overdueCount: number } };
    eq(pack.earningTasks.overdueCount, 1, 'chỉ đếm việc trễ thật');
  });

  await it('#2 chat: validateClientSnapshot giữ stage + getFinanceSnapshot không gắn "quá hạn" cho việc chờ trả', async () => {
    __clearSnapshotCacheForTest();
    const raw = { tasks: [
      { id: 'a', name: 'chờ', expectedAmount: 500_000, startDate: dayKey(-10), endDate: dayKey(-3), stage: 'awaiting_payment', subTasks: [] },
      { id: 'x', name: 'lạ', expectedAmount: 1, stage: 'hack' },
    ] };
    const v = validateClientSnapshot(raw);
    eq(v?.tasks?.[0].stage, 'awaiting_payment');
    eq(v?.tasks?.[1].stage, undefined, 'stage lạ bị bỏ');
    const fs = await getFinanceSnapshot('u-test', { clientSnapshot: raw });
    const item = fs.tasks.items.find((t) => t.id === 'a');
    eq(item?.status, 'active', 'không phải overdue');
  });

  function doc(tasks: EarningTask[], updatedAt: string): CloudMoneyDocumentV1 {
    return {
      version: 'cloud_money_v1', uid: 'u', updatedAt,
      finance: { transactions: [], mainBalance: 0, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] },
      budget: { carryOver: 0, currentMonth: '2026-10', categoryBudgets: [], flaggedCategories: [], flaggedTransactionIds: [], monthlySnapshots: [], unviewedReportMonth: null, xpAtMonthStart: 0 },
      goals: { goals: [] },
      tasks: { tasks, xpPenalties: [] },
      authProgress: { uid: 'u', displayName: 'T', email: '', photoURL: null, rank: 'iron', xp: 0, streak: 0, lastActiveDate: '2026-10-01', resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free', premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt },
      audit: { records: [] },
      syncMeta: { schemaVersion: 1 },
    } as unknown as CloudMoneyDocumentV1;
  }

  await it('#3 sync: máy v1 hoàn thành (không bump updatedAt) vẫn thắng sửa đổi CŨ hơn trên máy v2', () => {
    const base = task({ updatedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z' });
    const localV2 = { ...base, updatedAt: '2026-10-03T00:00:00.000Z' };            // tick checklist T3
    const cloudV1 = { ...base, completedAt: '2026-10-05T00:00:00.000Z', actualAmount: 300_000 }; // hoàn thành T5, updatedAt cũ
    const r = mergeCloudAndLocal({ local: doc([localV2], '2026-10-03T00:00:00Z'), cloud: doc([cloudV1], '2026-10-05T00:00:00Z'), now: '2026-10-06T00:00:00Z', deviceId: 'd' });
    eq(r.merged.tasks.tasks[0].completedAt, '2026-10-05T00:00:00.000Z', 'bản hoàn thành thắng');
  });

  await it('#3 sync: đọc cloud chuẩn hoá task v1 → v2 (stage + updatedAt)', () => {
    const patch = deserializeCloudMoneyDocument(doc([task({ id: 'v1', completedAt: '2026-10-05T00:00:00.000Z' })], '2026-10-05T00:00:00Z'));
    const t = patch.tasks?.tasks?.[0];
    eq(t?.stage, 'paid'); eq(t?.updatedAt, '2026-10-05T00:00:00.000Z');
  });

  await it('#5 undo cũ KHÔNG chạy khi task đã được nhận lại bằng giao dịch khác', () => {
    seed([task()]);
    const r1 = receiveTaskPayment({ taskId: 't1', amount: 100_000 });
    ok(r1.ok, 'r1');
    if (!r1.ok) return;
    // Giả lập tab khác: undo rồi nhận lại → giao dịch mới
    ok(undoReceiveTaskPayment(r1.undo), 'undo1');
    const r2 = receiveTaskPayment({ taskId: 't1', amount: 120_000 });
    ok(r2.ok, 'r2');
    eq(undoReceiveTaskPayment(r1.undo), false, 'undo cũ bị chặn');
    eq(useFinanceStore.getState().transactions.length, 1, 'giao dịch mới còn nguyên');
    eq(useTaskStore.getState().tasks[0].stage, 'paid');
  });

  await it('#6 hoàn tác giao dịch lùi sang tháng trước → tính lại snapshot tháng đó', () => {
    seed([task()]);
    const calls: string[] = [];
    const orig = useBudgetStore.getState().updateSnapshotTotals;
    useBudgetStore.setState({ updateSnapshotTotals: (m: string) => { calls.push(m); } } as never);
    try {
      const back = new Date(); back.setDate(back.getDate() - 20);
      const when = back.getMonth() !== new Date().getMonth() ? back : null;
      if (!when) { console.log('    (bỏ qua: 20 ngày trước vẫn cùng tháng)'); return; }
      const res = receiveTaskPayment({ taskId: 't1', amount: 100_000, receivedAt: when });
      ok(res.ok, 'ok');
      if (!res.ok) return;
      const before = calls.length;
      undoReceiveTaskPayment(res.undo);
      ok(calls.length > before, 'removeTransaction gọi updateSnapshotTotals');
    } finally {
      useBudgetStore.setState({ updateSnapshotTotals: orig } as never);
    }
  });

  await it('#8 completedAt = ngày nhận đã chọn (khớp giao dịch), updatedAt = bây giờ', () => {
    seed([task()]);
    const back = new Date(); back.setDate(back.getDate() - 5); back.setHours(12, 0, 0, 0);
    const res = receiveTaskPayment({ taskId: 't1', amount: 100_000, receivedAt: back });
    ok(res.ok, 'ok');
    const t = useTaskStore.getState().tasks[0];
    eq(t.completedAt, useFinanceStore.getState().transactions[0].date, 'trùng ngày giao dịch');
    ok(Date.parse(t.updatedAt!) > Date.parse(t.completedAt!), 'updatedAt mới hơn');
  });

  await it('#11 hẹn trả dạng "YYYY-MM-DD" tính theo ngày máy', () => {
    eq(getPaymentLateDays(task({ stage: 'awaiting_payment', paymentDueDate: dayKey(-2) })), 2);
    eq(getPaymentLateDays(task({ stage: 'awaiting_payment', paymentDueDate: dayKey(0) })), 0);
  });

  await it('#15 kỳ vọng mẫu tính theo trang/giờ nhân số đơn vị điển hình', () => {
    eq(suggestedAmount(getEarningTemplate('free-translate')!), 1_150_000, '10 trang × 115k');
    eq(suggestedAmount(getEarningTemplate('weekend-cleaning')!), 300_000, '3 giờ × 100k');
  });

  console.log('');
}

main();
