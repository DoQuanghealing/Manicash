/* ═══ Money Sync — Merge / Conflict Engine (Phase 6B-2A) ═══
 * Pure function — KHÔNG import Firebase / Zustand / React / localStorage.
 * Inputs và outputs là plain data (CloudMoneyDocumentV1).
 *
 * Strategy:
 *  - Arrays (transactions, goals, tasks, audit...): append-merge by id
 *    → local-only: giữ | cloud-only: giữ | both: newer updatedAt wins (fallback local)
 *  - BillSnapshots: append-unique by month (không có id field)
 *  - Scalars (balances, budget month, XP...): LWW dùng document-level updatedAt
 *    → doc mới hơn wins; nếu không có timestamp → local wins + ghi conflict
 *  - Audit: append-unique by id, cap 200, newest first
 */
import type {
  CloudMoneyDocumentV1,
  ConflictRecord,
  CloudFinanceStateV1,
  CloudBudgetStateV1,
  CloudGoalsStateV1,
  CloudTasksStateV1,
  CloudAuthProgressV1,
  CloudAuditStateV1,
} from './cloudTypes';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';

const AUDIT_CAP = 200;

// ─── Timestamp helpers ────────────────────────────────────────────────────────

/** Trả timestamp đại diện từ một record (ưu tiên updatedAt → completedAt → createdAt → date). */
function pickTimestamp(item: Record<string, unknown>): string | undefined {
  for (const key of ['updatedAt', 'completedAt', 'createdAt', 'date']) {
    if (typeof item[key] === 'string') return item[key] as string;
  }
  return undefined;
}

/** 'local' nếu local mới hơn hoặc bằng, 'cloud' nếu cloud mới hơn. */
function newerWins(
  local: string | undefined,
  cloud: string | undefined,
): 'local' | 'cloud' {
  if (!local && !cloud) return 'local';
  if (!local) return 'cloud';
  if (!cloud) return 'local';
  return local >= cloud ? 'local' : 'cloud';
}

// ─── Generic array merge by id ────────────────────────────────────────────────

type HasId = { id: string } & Record<string, unknown>;

function mergeArrayById<T extends { id: string }>(
  local: T[],
  cloud: T[],
  fieldPrefix: string,
  conflicts: ConflictRecord[],
): T[] {
  const cloudMap = new Map(cloud.map((item) => [item.id, item]));
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const localItem of local) {
    seen.add(localItem.id);
    const cloudItem = cloudMap.get(localItem.id);
    if (!cloudItem) {
      merged.push(localItem);
      continue;
    }
    // ID exists in both — resolve by timestamp
    const lt = pickTimestamp(localItem as unknown as Record<string, unknown>);
    const ct = pickTimestamp(cloudItem as unknown as Record<string, unknown>);
    if (!lt && !ct) {
      // No timestamp — local wins, record conflict
      merged.push(localItem);
      conflicts.push({
        field: `${fieldPrefix}[${localItem.id}]`,
        localValue: localItem,
        cloudValue: cloudItem,
        resolution: 'local',
        reason: 'no timestamp on either side — favoring local',
      });
    } else {
      const winner = newerWins(lt, ct);
      merged.push(winner === 'local' ? localItem : cloudItem);
    }
  }

  // Cloud-only items
  for (const cloudItem of cloud) {
    if (!seen.has(cloudItem.id)) {
      merged.push(cloudItem);
    }
  }

  return merged;
}

// ─── Finance merge ────────────────────────────────────────────────────────────

function mergeFinance(
  local: CloudFinanceStateV1,
  cloud: CloudFinanceStateV1,
  docWinner: 'local' | 'cloud',
  conflicts: ConflictRecord[],
): CloudFinanceStateV1 {
  const transactions = mergeArrayById(
    local.transactions,
    cloud.transactions,
    'finance.transactions',
    conflicts,
  );
  const fixedBills = mergeArrayById(
    local.fixedBills,
    cloud.fixedBills,
    'finance.fixedBills',
    conflicts,
  );

  // BillSnapshots: append-unique by month (no id field)
  const localSnaps = local.billSnapshots ?? [];
  const cloudSnaps = cloud.billSnapshots ?? [];
  const localSnapMonths = new Set(localSnaps.map((s) => s.month));
  const billSnapshots = [
    ...localSnaps,
    ...cloudSnaps.filter((s) => !localSnapMonths.has(s.month)),
  ];

  // Scalar balances: LWW by document winner
  const base = docWinner === 'local' ? local : cloud;

  if (local.mainBalance !== cloud.mainBalance) {
    conflicts.push({
      field: 'finance.mainBalance',
      localValue: local.mainBalance,
      cloudValue: cloud.mainBalance,
      resolution: docWinner,
      reason: `LWW by document updatedAt — ${docWinner} wins`,
    });
  }

  return {
    transactions,
    mainBalance: base.mainBalance,
    emergencyBalance: base.emergencyBalance,
    billFundBalance: base.billFundBalance,
    fixedBills,
    billSnapshots,
  };
}

// ─── Budget merge ─────────────────────────────────────────────────────────────

function mergeBudget(
  local: CloudBudgetStateV1,
  cloud: CloudBudgetStateV1,
  docWinner: 'local' | 'cloud',
  conflicts: ConflictRecord[],
): CloudBudgetStateV1 {
  const base = docWinner === 'local' ? local : cloud;

  // categoryBudgets: merge by categoryId+month composite key
  const budgetKey = (b: { categoryId: string; month: string }) =>
    `${b.categoryId}:${b.month}`;
  const cloudBudMap = new Map(
    cloud.categoryBudgets.map((b) => [budgetKey(b), b]),
  );
  const localBudMap = new Map(
    local.categoryBudgets.map((b) => [budgetKey(b), b]),
  );
  const mergedBudgets = [
    ...local.categoryBudgets.map((lb) => {
      const cb = cloudBudMap.get(budgetKey(lb));
      if (!cb) return lb;
      return docWinner === 'local' ? lb : cb;
    }),
    ...cloud.categoryBudgets.filter((cb) => !localBudMap.has(budgetKey(cb))),
  ];

  // monthlySnapshots: merge by month key (append-unique)
  const mergedSnaps = [
    ...local.monthlySnapshots,
    ...cloud.monthlySnapshots.filter(
      (s) => !local.monthlySnapshots.some((ls) => ls.month === s.month),
    ),
  ];

  // flaggedCategories / flaggedTransactionIds: union (never lose a flag)
  const flaggedCategories = [
    ...new Set([...local.flaggedCategories, ...cloud.flaggedCategories]),
  ];
  const flaggedTxIds = [
    ...new Set([
      ...local.flaggedTransactionIds,
      ...cloud.flaggedTransactionIds,
    ]),
  ];

  void conflicts; // budget scalars use docWinner without explicit conflict records

  return {
    carryOver: base.carryOver,
    currentMonth: base.currentMonth,
    categoryBudgets: mergedBudgets,
    flaggedCategories,
    flaggedTransactionIds: flaggedTxIds,
    monthlySnapshots: mergedSnaps,
    unviewedReportMonth: base.unviewedReportMonth,
    xpAtMonthStart: base.xpAtMonthStart,
  };
}

// ─── Goals merge ──────────────────────────────────────────────────────────────

function mergeGoals(
  local: CloudGoalsStateV1,
  cloud: CloudGoalsStateV1,
  conflicts: ConflictRecord[],
): CloudGoalsStateV1 {
  const goals = mergeArrayById(
    local.goals,
    cloud.goals,
    'goals.goals',
    conflicts,
  );
  return { goals };
}

// ─── Tasks merge ──────────────────────────────────────────────────────────────

function mergeTasks(
  local: CloudTasksStateV1,
  cloud: CloudTasksStateV1,
  conflicts: ConflictRecord[],
): CloudTasksStateV1 {
  const tasks = mergeArrayById(
    local.tasks,
    cloud.tasks,
    'tasks.tasks',
    conflicts,
  );
  // xpPenalties: local wins (client-side enforcement only, no id field)
  return {
    tasks,
    xpPenalties: local.xpPenalties,
  };
}

// ─── Auth progress merge ──────────────────────────────────────────────────────

function mergeAuthProgress(
  local: CloudAuthProgressV1,
  cloud: CloudAuthProgressV1,
  docWinner: 'local' | 'cloud',
  conflicts: ConflictRecord[],
): CloudAuthProgressV1 {
  const base = docWinner === 'local' ? local : cloud;
  if (local.xp !== cloud.xp) {
    conflicts.push({
      field: 'authProgress.xp',
      localValue: local.xp,
      cloudValue: cloud.xp,
      resolution: docWinner,
      reason: `LWW by document updatedAt — ${docWinner} wins`,
    });
  }
  return { ...base };
}

// ─── Audit merge ──────────────────────────────────────────────────────────────

function mergeAudit(
  local: CloudAuditStateV1,
  cloud: CloudAuditStateV1,
): CloudAuditStateV1 {
  const seen = new Set<string>();
  const merged: MoneyActionAuditRecord[] = [];

  for (const r of [...local.records, ...cloud.records]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  // Sort newest first by createdAt, then cap
  merged.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return { records: merged.slice(0, AUDIT_CAP) };
}

// ─── Main merge function ──────────────────────────────────────────────────────

export type MergeResult = {
  merged: CloudMoneyDocumentV1;
  source: 'local' | 'cloud' | 'merged';
  conflicts: ConflictRecord[];
};

export function mergeCloudAndLocal(input: {
  local: CloudMoneyDocumentV1;
  cloud: CloudMoneyDocumentV1;
  now: string;
  deviceId: string;
}): MergeResult {
  const { local, cloud, now, deviceId } = input;
  const conflicts: ConflictRecord[] = [];

  // Determine LWW winner for scalars using document-level updatedAt
  const docWinner = newerWins(local.updatedAt, cloud.updatedAt);

  const finance = mergeFinance(local.finance, cloud.finance, docWinner, conflicts);
  const budget = mergeBudget(local.budget, cloud.budget, docWinner, conflicts);
  const goals = mergeGoals(local.goals, cloud.goals, conflicts);
  const tasks = mergeTasks(local.tasks, cloud.tasks, conflicts);
  const authProgress = mergeAuthProgress(
    local.authProgress,
    cloud.authProgress,
    docWinner,
    conflicts,
  );
  const audit = mergeAudit(local.audit, cloud.audit);

  const source: MergeResult['source'] =
    conflicts.length === 0 ? docWinner : 'merged';

  const merged: CloudMoneyDocumentV1 = {
    version: 'cloud_money_v1',
    uid: local.uid,
    updatedAt: now,
    clientUpdatedAt: now,
    lastPushedByDeviceId: deviceId,
    finance,
    budget,
    goals,
    tasks,
    authProgress,
    audit,
    syncMeta: {
      schemaVersion: 1,
      lastMergeAt: now,
      createdAt: local.syncMeta?.createdAt ?? cloud.syncMeta?.createdAt,
    },
  };

  return { merged, source, conflicts };
}
