/* ═══ Money Sync — Cloud Types (Phase 6B-2A) ═══
 * Versioned schema cho aggregate Firestore document.
 * Path: users/{uid}/money/state
 *
 * Phase này dùng 1 document tổng. Về sau nếu document > 1MB thì split:
 *   users/{uid}/money/transactions
 *   users/{uid}/money/audit
 *   users/{uid}/money/goals
 * Nhưng CHƯA làm trong Phase 6B-2A.
 */
import type { Transaction, FixedBill, BillSnapshot } from '@/stores/useFinanceStore';
import type { CategoryBudget, MonthlySnapshot, Goal } from '@/types/budget';
import type { EarningTask, XPPenalty } from '@/types/task';
import type { UserRank, SubscriptionPlan, UserTier, UserProfile } from '@/types/user';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';

// ─── Finance ──────────────────────────────────────────────────────────────────

export type CloudFinanceStateV1 = {
  transactions: Transaction[];
  mainBalance: number;
  emergencyBalance: number;
  billFundBalance: number;
  fixedBills: FixedBill[];
  billSnapshots: BillSnapshot[];
};

// ─── Budget ───────────────────────────────────────────────────────────────────

export type CloudBudgetStateV1 = {
  carryOver: number;
  currentMonth: string;
  categoryBudgets: CategoryBudget[];
  flaggedCategories: string[];
  flaggedTransactionIds: string[];
  monthlySnapshots: MonthlySnapshot[];
  unviewedReportMonth: string | null;
  xpAtMonthStart: number;
};

// ─── Goals ────────────────────────────────────────────────────────────────────

export type CloudGoalsStateV1 = {
  goals: Goal[];
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type CloudTasksStateV1 = {
  tasks: EarningTask[];
  xpPenalties: XPPenalty[];
};

// ─── Auth progress (KHÔNG include firebaseUser / isLoading / credential) ──────

export type CloudAuthProgressV1 = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  rank: UserRank;
  xp: number;
  streak: number;
  lastActiveDate: string;
  resistCount: number;
  totalResistSaved: number;
  lastResistAt?: string;
  resistByDate?: Record<string, number>;
  streakShields?: number;
  shieldsUsedAt?: string[];
  isPremium: boolean;
  plan: SubscriptionPlan;
  tier?: UserTier;
  premiumExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  yearOfBirth?: number;
  birthDate?: string;
  birthTime?: string;
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export type CloudAuditStateV1 = {
  records: MoneyActionAuditRecord[];
};

// ─── Sync metadata ────────────────────────────────────────────────────────────

export type CloudSyncMeta = {
  schemaVersion: 1;
  createdAt?: string;
  lastPulledAt?: string;
  lastPushedAt?: string;
  lastMergeAt?: string;
};

// ─── Main cloud document ──────────────────────────────────────────────────────

export type CloudMoneyDocumentV1 = {
  version: 'cloud_money_v1';
  uid: string;
  /** ISO timestamp — set by the sync service (NOT serverTimestamp). */
  updatedAt: string;
  clientUpdatedAt?: string;
  lastPushedByDeviceId?: string;
  finance: CloudFinanceStateV1;
  budget: CloudBudgetStateV1;
  goals: CloudGoalsStateV1;
  tasks: CloudTasksStateV1;
  authProgress: CloudAuthProgressV1;
  audit: CloudAuditStateV1;
  syncMeta: CloudSyncMeta;
};

// ─── Merge / conflict ─────────────────────────────────────────────────────────

export type ConflictRecord = {
  /** Human-readable field path, e.g. "finance.transactions[tx-123]". */
  field: string;
  localValue: unknown;
  cloudValue: unknown;
  resolution: 'local' | 'cloud' | 'merged';
  reason: string;
};

// ─── Deserialize output ───────────────────────────────────────────────────────

/** Safe patch returned by deserializeCloudMoneyDocument. Caller applies to stores. */
export type LocalMoneyStatePatch = {
  finance?: Partial<CloudFinanceStateV1>;
  budget?: Partial<CloudBudgetStateV1>;
  goals?: Partial<CloudGoalsStateV1>;
  tasks?: Partial<CloudTasksStateV1>;
  authProgress?: Partial<CloudAuthProgressV1>;
  audit?: Partial<CloudAuditStateV1>;
};

// ─── Serialize input ──────────────────────────────────────────────────────────

/** Shape caller must pass to serializeMoneyStateToCloud. */
export type LocalMoneyStateInput = {
  uid: string;
  now: string;       // ISO timestamp from caller — NOT Date.now()
  deviceId: string;
  finance: CloudFinanceStateV1;
  budget: CloudBudgetStateV1;
  goals: CloudGoalsStateV1;
  tasks: CloudTasksStateV1;
  auth: { user: UserProfile | null };
  audit: CloudAuditStateV1;
};
