/* ═══ Money Sync — Client Snapshot Builder + Hash (Phase 6B-2B) ═══
 * Pure functions — KHÔNG import React / Zustand / Firebase / localStorage.
 * Nhận data đã gom sẵn từ caller (clientRuntime đọc store), trả snapshot
 * canonical + content hash ổn định để phát hiện thay đổi (change detection).
 *
 * Hash CHỈ tính trên `stores` (dữ liệu nghiệp vụ) — KHÔNG tính clientNow/timezone
 * (volatile) để tránh sync churn vô nghĩa khi chỉ thời gian đổi.
 */
import type {
  CloudFinanceStateV1,
  CloudBudgetStateV1,
  CloudGoalsStateV1,
  CloudTasksStateV1,
  CloudAuthProgressV1,
} from './cloudTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoneySyncClientSnapshot = {
  version: 'money_sync_snapshot_v1';
  userId: string;
  clientNow: string;
  timezone: string;
  stores: {
    finance: CloudFinanceStateV1;
    budget: CloudBudgetStateV1;
    goals: CloudGoalsStateV1;
    tasks: CloudTasksStateV1;
    authUser: CloudAuthProgressV1 | null;
  };
};

export type BuildSnapshotInput = {
  userId: string;
  clientNow: string;
  timezone: string;
  finance: CloudFinanceStateV1;
  budget: CloudBudgetStateV1;
  goals: CloudGoalsStateV1;
  tasks: CloudTasksStateV1;
  authUser: CloudAuthProgressV1 | null;
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildMoneySyncSnapshot(
  input: BuildSnapshotInput,
): MoneySyncClientSnapshot {
  return {
    version: 'money_sync_snapshot_v1',
    userId: input.userId,
    clientNow: input.clientNow,
    timezone: input.timezone,
    stores: {
      finance: input.finance,
      budget: input.budget,
      goals: input.goals,
      tasks: input.tasks,
      authUser: input.authUser,
    },
  };
}

// ─── Stable stringify (sorted keys, deterministic) ────────────────────────────

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(',')}}`;
}

// ─── Hash (djb2 → unsigned hex). Non-crypto: chỉ để change detection. ─────────

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // >>> 0 → unsigned 32-bit; pad để hash ổn định độ dài
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Content hash của snapshot — CHỈ trên `stores` + userId (account-scoped),
 * KHÔNG gồm clientNow/timezone. Cùng dữ liệu → cùng hash (deterministic).
 */
export function hashMoneySyncSnapshot(snapshot: MoneySyncClientSnapshot): string {
  const payload = stableStringify({
    userId: snapshot.userId,
    stores: snapshot.stores,
  });
  // Kèm độ dài để giảm xác suất va chạm với djb2 32-bit.
  return `${djb2(payload)}-${payload.length.toString(16)}`;
}
