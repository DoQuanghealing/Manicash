/* PRISM P5 — La Bàn Năng Lực: engine + phân loại + adapter.
 * Kiểm: weighted sum đúng trọng số; classify theo ma trận + Hybrid;
 * adapter chuẩn hóa + sinh pending cho field khảo sát thiếu. */
import {
  computeCapacity,
  classifyCapacity,
  type CapacityComponents,
} from '@/lib/aiMoneyChat/prism/capacity/capacityEngine';
import {
  buildCapacityComponents,
  type CapacityRawSignals,
} from '@/lib/aiMoneyChat/prism/capacity/buildCapacity';

type Fn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: Fn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${String(b)}, got ${String(a)}`);
}
function ok(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

const FULL = (v: number): CapacityComponents => ({
  loggingConsistency: v, budgetAdherence: v, goalCommitment: v, streakMaintenance: v,
  aiInteraction: v, featureExploration: v, onboardingSpeed: v,
  skillDiversity: v, earningTaskCompletion: v, freeTimeAvailability: v,
  emergencyFundRatio: v, investmentMindset: v, growthOrientation: v,
});

describe('computeCapacity — weighted sum');
it('tất cả = 80 -> mọi chỉ số = 80', () => {
  const s = computeCapacity(FULL(80));
  eq(s.FDS, 80); eq(s.TAS, 80); eq(s.IPS, 80); eq(s.MMS, 80);
});
it('FDS theo đúng trọng số (40/30/20/10)', () => {
  const c = FULL(0);
  c.loggingConsistency = 100; // 40%
  c.budgetAdherence = 100; // 30%
  const s = computeCapacity(c);
  eq(s.FDS, 70, 'FDS = 40 + 30');
});
it('clamp 0..100', () => {
  const s = computeCapacity(FULL(999));
  eq(s.FDS, 100);
});

describe('classifyCapacity — ma trận + Hybrid');
it('TAS cao + FDS cao -> Kỹ sư Vận hành, KHÔNG hybrid (cùng cặp trục automation/expert)', () => {
  const cls = classifyCapacity({ FDS: 75, TAS: 85, IPS: 40, MMS: 40 });
  eq(cls.groupId, 'automation');
  eq(cls.isHybrid, false, 'cùng cặp TAS+FDS không phải lai thật');
});
it('MMS cao + FDS cao -> Nhà Khai vấn', () => {
  const cls = classifyCapacity({ FDS: 75, TAS: 40, IPS: 40, MMS: 80 });
  eq(cls.groupId, 'coach');
});
it('điểm thấp -> nhóm general', () => {
  const cls = classifyCapacity({ FDS: 30, TAS: 30, IPS: 30, MMS: 30 });
  eq(cls.groupId, 'general');
  eq(cls.isHybrid, false);
});
it('2 nhóm KHÁC cặp trục sát nhau -> Hybrid (nhãn curated)', () => {
  // automation(TAS+FDS)=160 & coach(MMS+FDS)=155 -> khác cặp trục, chênh 5 -> hybrid
  const cls = classifyCapacity({ FDS: 75, TAS: 85, IPS: 40, MMS: 80 });
  eq(cls.isHybrid, true);
  eq(cls.hybridLabel, 'Nhà Khai vấn Công nghệ', 'nhãn lai có chủ đích');
});

describe('buildCapacityComponents — chuẩn hóa + pending');
it('logging 15/30 ngày -> 50', () => {
  const raw = baseRaw({ daysLoggedLast30: 15 });
  const { components } = buildCapacityComponents(raw);
  eq(components.loggingConsistency, 50);
});
it('thiếu khảo sát kỹ năng + free time -> có pending', () => {
  const { pending } = buildCapacityComponents(baseRaw({}));
  ok(pending.some((p) => p.includes('kỹ năng')), 'pending kỹ năng');
  ok(pending.some((p) => p.toLowerCase().includes('thời gian')), 'pending thời gian');
});
it('emergencyFundMonths=3 -> 50 (6 tháng=100)', () => {
  const { components } = buildCapacityComponents(baseRaw({ emergencyFundMonths: 3 }));
  eq(components.emergencyFundRatio, 50);
});
it('không goals/earning -> default trung tính 40 (KHÔNG phải 0)', () => {
  const { components } = buildCapacityComponents(baseRaw({}));
  eq(components.goalCommitment, 40, 'goalCommitment trung tính');
  eq(components.earningTaskCompletion, 40, 'earningTaskCompletion trung tính');
});

function baseRaw(over: Partial<CapacityRawSignals>): CapacityRawSignals {
  return {
    daysLoggedLast30: 0, budgetTotal: 0, budgetWithin: 0, goalsTotal: 0, goalsFunded: 0,
    streakDays: 0, chatUserMessages: 0, featuresUsed: 0, featuresTotal: 5,
    onboardingDone: -1, onboardingTotal: 7, skillsDeclared: -1,
    earningTasksTotal: 0, earningTasksCompleted: 0, freeTimeHoursPerWeek: -1,
    emergencyFundMonths: -1, cfoReportViews: 0, growthOrientation: -1, ...over,
  };
}

if (process.exitCode) process.exit(process.exitCode);
