/* ═══ Money Sync — Serializer / Deserializer (Phase 6B-2A) ═══
 * Chuyển đổi an toàn giữa Zustand local state ↔ CloudMoneyDocumentV1.
 *
 * Invariants:
 *  - Không include functions, firebaseUser, isLoading, credential, token.
 *  - Deserialize không crash khi field bị missing / version sai / doc null.
 *  - Không mutate Zustand trực tiếp — trả patch để caller apply.
 */
import type {
  CloudMoneyDocumentV1,
  CloudAuthProgressV1,
  LocalMoneyStatePatch,
  LocalMoneyStateInput,
} from './cloudTypes';
import type { UserProfile } from '@/types/user';

const AUDIT_SERIALIZE_CAP = 200;

// ─── Serialize ────────────────────────────────────────────────────────────────

/** Chỉ lấy fields an toàn từ UserProfile — KHÔNG include firebaseUser/isLoading. */
function serializeAuthProgress(user: UserProfile): CloudAuthProgressV1 {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    rank: user.rank,
    xp: user.xp,
    streak: user.streak,
    lastActiveDate: user.lastActiveDate,
    resistCount: user.resistCount,
    totalResistSaved: user.totalResistSaved,
    isPremium: user.isPremium,
    plan: user.plan,
    premiumExpiresAt: user.premiumExpiresAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...(user.lastResistAt !== undefined ? { lastResistAt: user.lastResistAt } : {}),
    ...(user.resistByDate !== undefined ? { resistByDate: user.resistByDate } : {}),
    ...(user.streakShields !== undefined ? { streakShields: user.streakShields } : {}),
    ...(user.shieldsUsedAt !== undefined ? { shieldsUsedAt: user.shieldsUsedAt } : {}),
    ...(user.tier !== undefined ? { tier: user.tier } : {}),
    ...(user.yearOfBirth !== undefined ? { yearOfBirth: user.yearOfBirth } : {}),
    ...(user.birthDate !== undefined ? { birthDate: user.birthDate } : {}),
    ...(user.birthTime !== undefined ? { birthTime: user.birthTime } : {}),
  };
}

/**
 * Serialize local money state sang CloudMoneyDocumentV1.
 * Throws khi uid rỗng hoặc user null — caller phải guard trước.
 */
export function serializeMoneyStateToCloud(
  input: LocalMoneyStateInput,
): CloudMoneyDocumentV1 {
  if (!input.uid || input.uid.trim().length === 0) {
    throw new Error('serializeMoneyStateToCloud: uid is empty');
  }
  if (!input.auth.user) {
    throw new Error('serializeMoneyStateToCloud: user is null — cannot serialize');
  }

  return {
    version: 'cloud_money_v1',
    uid: input.uid,
    updatedAt: input.now,
    clientUpdatedAt: input.now,
    lastPushedByDeviceId: input.deviceId,
    finance: {
      transactions: input.finance.transactions,
      mainBalance: input.finance.mainBalance,
      emergencyBalance: input.finance.emergencyBalance,
      billFundBalance: input.finance.billFundBalance,
      fixedBills: input.finance.fixedBills,
      billSnapshots: input.finance.billSnapshots,
    },
    budget: {
      carryOver: input.budget.carryOver,
      currentMonth: input.budget.currentMonth,
      categoryBudgets: input.budget.categoryBudgets,
      flaggedCategories: input.budget.flaggedCategories,
      flaggedTransactionIds: input.budget.flaggedTransactionIds,
      monthlySnapshots: input.budget.monthlySnapshots,
      unviewedReportMonth: input.budget.unviewedReportMonth,
      xpAtMonthStart: input.budget.xpAtMonthStart,
    },
    goals: { goals: input.goals.goals },
    tasks: { tasks: input.tasks.tasks, xpPenalties: input.tasks.xpPenalties },
    authProgress: serializeAuthProgress(input.auth.user),
    audit: {
      // Cap theo HISTORY_LIMIT để tránh doc quá lớn
      records: input.audit.records.slice(0, AUDIT_SERIALIZE_CAP),
    },
    syncMeta: { schemaVersion: 1 },
  };
}

// ─── Deserialize ──────────────────────────────────────────────────────────────

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function safeNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeStringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/**
 * Deserialize cloud document về LocalMoneyStatePatch an toàn.
 * - doc null / undefined → {} (empty patch, không crash)
 * - version mismatch → {} (migration placeholder — Phase 6B-2B sẽ fill)
 * - field thiếu → default an toàn
 * - extra fields không xài → ignored
 */
export function deserializeCloudMoneyDocument(doc: unknown): LocalMoneyStatePatch {
  if (!doc || typeof doc !== 'object') return {};
  const d = doc as Record<string, unknown>;

  // Version guard — chưa có migration logic; trả rỗng cho version lạ
  if (d['version'] !== 'cloud_money_v1') return {};

  const finance = (typeof d['finance'] === 'object' && d['finance'])
    ? (d['finance'] as Record<string, unknown>) : {};
  const budget = (typeof d['budget'] === 'object' && d['budget'])
    ? (d['budget'] as Record<string, unknown>) : {};
  const goals = (typeof d['goals'] === 'object' && d['goals'])
    ? (d['goals'] as Record<string, unknown>) : {};
  const tasks = (typeof d['tasks'] === 'object' && d['tasks'])
    ? (d['tasks'] as Record<string, unknown>) : {};
  const authObj = (typeof d['authProgress'] === 'object' && d['authProgress'])
    ? (d['authProgress'] as Record<string, unknown>) : null;
  const audit = (typeof d['audit'] === 'object' && d['audit'])
    ? (d['audit'] as Record<string, unknown>) : {};

  return {
    finance: {
      transactions: safeArray(finance['transactions']),
      mainBalance: safeNumber(finance['mainBalance']),
      emergencyBalance: safeNumber(finance['emergencyBalance']),
      billFundBalance: safeNumber(finance['billFundBalance']),
      fixedBills: safeArray(finance['fixedBills']),
      billSnapshots: safeArray(finance['billSnapshots']),
    },
    budget: {
      carryOver: safeNumber(budget['carryOver']),
      currentMonth: safeString(budget['currentMonth']),
      categoryBudgets: safeArray(budget['categoryBudgets']),
      flaggedCategories: safeArray(budget['flaggedCategories']),
      flaggedTransactionIds: safeArray(budget['flaggedTransactionIds']),
      monthlySnapshots: safeArray(budget['monthlySnapshots']),
      unviewedReportMonth: safeStringOrNull(budget['unviewedReportMonth']),
      xpAtMonthStart: safeNumber(budget['xpAtMonthStart']),
    },
    goals: { goals: safeArray(goals['goals']) },
    tasks: {
      tasks: safeArray(tasks['tasks']),
      xpPenalties: safeArray(tasks['xpPenalties']),
    },
    authProgress: authObj ? (authObj as Partial<CloudAuthProgressV1>) : undefined,
    audit: { records: safeArray(audit['records']) },
  };
}
