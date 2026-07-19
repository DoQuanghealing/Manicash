/* ═══ Care Companion — trigger tests (T4) ═══
 * PURE: generateCareScripts đọc snapshot + đồng hồ client → kịch bản nào nổ.
 * Chốt: (1) tài khoản trống KHÔNG báo động giả (vết xe P4); (2) mỗi trigger nổ đúng
 * điều kiện; (3) ưu tiên đúng; (4) cooldown per-script. Deterministic — clientNow cố định.
 */
import { generateCareScripts } from '@/lib/aiMoneyChat/care/careTriggers';
import { isCareInCooldown, CARE_COOLDOWN_DAYS } from '@/stores/useCareStore';
import { getISOWeekKey } from '@/lib/moneyBrain/dateRange';
import type {
  MoneySnapshotV1,
  MoneyTransactionSnapshot,
  MoneyBillSnapshot,
  MoneyGoalSnapshot,
  MoneyTaskSnapshot,
} from '@/lib/moneyBrain/types';
import type { CareScript, CareScriptId } from '@/lib/aiMoneyChat/care/careScripts';

function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function has(scripts: CareScript[], id: CareScriptId): CareScript | undefined {
  return scripts.find((s) => s.id === id);
}

const TZ = 'Asia/Ho_Chi_Minh';
/* clientNow (UTC) → giờ/thứ local (+7), đã kiểm chứng bằng Intl:
 *   WED_22H  → Wed 2026-07-15 22h · todayKey 2026-07-15
 *   THU_01H  → Thu 2026-07-16 01h · todayKey 2026-07-16
 *   WED_23H  → Wed 2026-07-15 23h · todayKey 2026-07-15
 *   SUN_20H  → Sun 2026-07-19 20h · todayKey 2026-07-19 */
const WED_22H = '2026-07-15T15:00:00Z';
const THU_01H = '2026-07-15T18:30:00Z';
const WED_23H = '2026-07-15T16:30:00Z';
const SUN_20H = '2026-07-19T13:00:00Z';

function txn(o: Partial<MoneyTransactionSnapshot> & { dateKey: string; type: MoneyTransactionSnapshot['type']; amount: number }): MoneyTransactionSnapshot {
  return {
    id: o.id ?? `t-${o.dateKey}-${o.amount}`,
    type: o.type,
    amount: o.amount,
    categoryId: o.categoryId,
    date: `${o.dateKey}T00:00:00Z`,
    dateKey: o.dateKey,
    weekKey: o.weekKey ?? '',
    monthKey: o.monthKey ?? o.dateKey.slice(0, 7),
    time: o.time,
  };
}

function snap(o: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: o.clientNow ?? WED_22H,
    timezone: TZ,
    wallets: { main: 0, emergency: 0, billFund: 0 },
    transactions: o.transactions ?? [],
    budgets: [],
    bills: o.bills ?? [],
    goals: o.goals ?? [],
    tasks: o.tasks ?? [],
    user: o.user ?? {},
    carryOver: 0,
  };
}

const bill = (o: Partial<MoneyBillSnapshot> & { dueDay: number }): MoneyBillSnapshot => ({
  id: o.id ?? 'b1', name: o.name ?? 'Tiền điện', amount: o.amount ?? 250_000, dueDay: o.dueDay, isPaid: o.isPaid ?? false,
});
const goal = (o: Partial<MoneyGoalSnapshot> & { currentAmount: number; targetAmount: number }): MoneyGoalSnapshot => ({
  id: o.id ?? 'g1', name: o.name ?? 'iPhone', targetAmount: o.targetAmount, currentAmount: o.currentAmount,
});
const task = (o: Partial<MoneyTaskSnapshot> & { endDate: string }): MoneyTaskSnapshot => ({
  id: o.id ?? 'k1', name: o.name ?? 'Viết content', expectedAmount: o.expectedAmount ?? 1_000_000,
  startDate: o.startDate ?? '2026-07-01', endDate: o.endDate, completedAt: o.completedAt, deletedAt: o.deletedAt,
});

function main() {
  describe('Care Companion — tài khoản trống KHÔNG báo động giả (P4)');
  it('snapshot rỗng → 0 kịch bản (kể cả chủ nhật 20h)', () => {
    eq(generateCareScripts(snap({ clientNow: SUN_20H }), 'ngài').length, 0);
    eq(generateCareScripts(snap({ clientNow: WED_23H }), 'ngài').length, 0);
  });

  describe('Care Companion — từng trigger nổ đúng điều kiện');

  it('comeback: vắng ≥7 ngày → nổ comeback (không phải ghost)', () => {
    const s = snap({ transactions: [txn({ dateKey: '2026-07-07', type: 'expense', amount: 50_000 })] });
    const r = generateCareScripts(s, 'cậu');
    ok(!!has(r, 'comeback'), 'có comeback');
    ok(!has(r, 'ghost-3d'), 'không ghost');
    ok(r[0].body.includes('cậu'), 'xưng hô đúng honorific');
  });

  it('ghost-3d: vắng 4 ngày → nổ ghost (không comeback)', () => {
    const s = snap({ transactions: [txn({ dateKey: '2026-07-11', type: 'expense', amount: 50_000 })] });
    const r = generateCareScripts(s);
    ok(!!has(r, 'ghost-3d'), 'có ghost');
    ok(!has(r, 'comeback'), 'không comeback');
  });

  it('bill-mosquito: bill quá hạn ≥2 ngày → nổ + đúng tên/tiền; bill mới/đã trả → im', () => {
    const overdue = snap({ bills: [bill({ dueDay: 13, name: 'Tiền net', amount: 300_000 })] }); // today 15, trễ 2
    const m = has(generateCareScripts(overdue), 'bill-mosquito');
    ok(!!m, 'nổ');
    ok(m!.body.includes('Tiền net') && m!.body.includes('300.000'), 'tên+tiền trong body');
    eq(has(generateCareScripts(snap({ bills: [bill({ dueDay: 14 })] })), 'bill-mosquito'), undefined, 'trễ 1 ngày → chưa nổ');
    eq(has(generateCareScripts(snap({ bills: [bill({ dueDay: 10, isPaid: true })] })), 'bill-mosquito'), undefined, 'đã trả → im');
  });

  it('payday-guard: lương hôm nay đã tiêu >30% → nổ; ≤30% → im', () => {
    const big = snap({ transactions: [
      txn({ dateKey: '2026-07-15', type: 'income', amount: 10_000_000, categoryId: 'salary', time: '09:00' }),
      txn({ dateKey: '2026-07-15', type: 'expense', amount: 4_000_000, categoryId: 'shopping', time: '10:00' }),
    ] });
    const m = has(generateCareScripts(big), 'payday-guard');
    ok(!!m && m.body.includes('40%'), 'nổ + pct đúng');
    const small = snap({ transactions: [
      txn({ dateKey: '2026-07-15', type: 'income', amount: 10_000_000, categoryId: 'salary', time: '09:00' }),
      txn({ dateKey: '2026-07-15', type: 'expense', amount: 2_000_000, categoryId: 'shopping', time: '10:00' }),
    ] });
    eq(has(generateCareScripts(small), 'payday-guard'), undefined, '20% → im');
  });

  it('streak-save: 23h chưa ghi hôm nay, streak ≥5 → nổ', () => {
    const s = snap({
      clientNow: WED_23H,
      transactions: [txn({ dateKey: '2026-07-14', type: 'expense', amount: 30_000 })], // hôm qua
      user: { streak: 6 },
    });
    const m = has(generateCareScripts(s), 'streak-save');
    ok(!!m && m.body.includes('6'), 'nổ + số streak');
    // đã ghi hôm nay → im
    const logged = snap({ clientNow: WED_23H, transactions: [txn({ dateKey: '2026-07-15', type: 'expense', amount: 1 })], user: { streak: 6 } });
    eq(has(generateCareScripts(logged), 'streak-save'), undefined, 'ghi rồi → im');
  });

  it('sad-guard: chi ăn uống/giải trí sau 22h → nổ (đúng category canonical)', () => {
    const s = snap({ clientNow: WED_22H, transactions: [txn({ dateKey: '2026-07-15', type: 'expense', amount: 120_000, categoryId: 'food', time: '22:30' })] });
    ok(!!has(generateCareScripts(s), 'sad-guard'), 'food 22h30 → nổ');
    const day = snap({ clientNow: WED_22H, transactions: [txn({ dateKey: '2026-07-15', type: 'expense', amount: 120_000, categoryId: 'food', time: '12:00' })] });
    eq(has(generateCareScripts(day), 'sad-guard'), undefined, 'food ban ngày → im');
  });

  it('night-owl: ghi chi tiêu 0–5h → nổ', () => {
    const s = snap({ clientNow: THU_01H, transactions: [txn({ dateKey: '2026-07-16', type: 'expense', amount: 45_000, categoryId: 'shopping', time: '01:15' })] });
    ok(!!has(generateCareScripts(s), 'night-owl'), 'nổ');
  });

  it('task-nudge: nhiệm vụ kiếm tiền trễ ≥3 ngày → nổ + tên', () => {
    const s = snap({ tasks: [task({ endDate: '2026-07-10', name: 'Viết content' })] }); // trễ 5 ngày
    const m = has(generateCareScripts(s), 'task-nudge');
    ok(!!m && m.body.includes('Viết content'), 'nổ + tên task');
    eq(has(generateCareScripts(snap({ tasks: [task({ endDate: '2026-07-10', completedAt: '2026-07-09' })] })), 'task-nudge'), undefined, 'đã xong → im');
  });

  it('goal-cheer: mục tiêu 50–60% → nổ; ngoài băng → im', () => {
    ok(!!has(generateCareScripts(snap({ goals: [goal({ currentAmount: 550_000, targetAmount: 1_000_000 })] })), 'goal-cheer'), '55% → nổ');
    eq(has(generateCareScripts(snap({ goals: [goal({ currentAmount: 400_000, targetAmount: 1_000_000 })] })), 'goal-cheer'), undefined, '40% → im');
    eq(has(generateCareScripts(snap({ goals: [goal({ currentAmount: 700_000, targetAmount: 1_000_000 })] })), 'goal-cheer'), undefined, '70% → im');
  });

  it('sunday-report: CN 19–21h + có hoạt động tuần → nổ + tổng thu/chi', () => {
    const wk = getISOWeekKey(SUN_20H, TZ);
    const s = snap({ clientNow: SUN_20H, transactions: [
      txn({ dateKey: '2026-07-19', type: 'income', amount: 5_000_000, categoryId: 'freelance', time: '10:00', weekKey: wk }),
      txn({ dateKey: '2026-07-19', type: 'expense', amount: 2_000_000, categoryId: 'shopping', time: '11:00', weekKey: wk }),
    ] });
    const m = has(generateCareScripts(s), 'sunday-report');
    ok(!!m && m.body.includes('5.000.000') && m.body.includes('2.000.000'), 'nổ + tổng đúng');
  });

  describe('Care Companion — ưu tiên + cooldown');

  it('ưu tiên: bill(92) > ghost(85) > goal-cheer(40)', () => {
    const s = snap({
      transactions: [txn({ dateKey: '2026-07-11', type: 'expense', amount: 50_000 })], // ghost 4 ngày
      bills: [bill({ dueDay: 12 })], // trễ 3
      goals: [goal({ currentAmount: 550_000, targetAmount: 1_000_000 })], // 55%
    });
    const r = generateCareScripts(s);
    eq(r[0].id, 'bill-mosquito', 'đầu tiên là bill');
    eq(r[1].id, 'ghost-3d', 'thứ hai là ghost');
    eq(r[2].id, 'goal-cheer', 'cuối là goal-cheer');
  });

  it('cooldown: trong 3 ngày → true, quá 3 ngày → false', () => {
    const now = Date.parse('2026-07-15T12:00:00Z');
    ok(isCareInCooldown('2026-07-14T12:00:00Z', now) === true, '1 ngày trước → cooldown');
    ok(isCareInCooldown(new Date(now - (CARE_COOLDOWN_DAYS + 1) * 86_400_000).toISOString(), now) === false, 'quá hạn → hết cooldown');
    ok(isCareInCooldown(undefined, now) === false, 'chưa từng → không cooldown');
  });

  console.log('\nCare Companion trigger test suite complete.');
}

main();
