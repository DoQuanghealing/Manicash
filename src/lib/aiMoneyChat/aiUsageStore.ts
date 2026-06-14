/* ═══ AI Usage Store (client, per-uid, per-feature daily+monthly counters) ═══
 * Đếm lượt gọi AI ở client (localStorage) để áp quota free/pro. MVP — đủ cho
 * giai đoạn này; khi bật bán Pro thật nên nâng lên server (Firestore) để chống
 * lách. Reset theo NGÀY/THÁNG LOCAL (công bằng với người dùng).
 *
 * SSR-safe: no-op khi không có localStorage.
 */
'use client';

import type { AiFeature } from './aiQuotaPolicy';

const PREFIX = 'manicash.aiusage.';

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface FeatureUsage {
  dayKey: string;
  dayCount: number;
  monthKey: string;
  monthCount: number;
}
type UsageStore = Partial<Record<AiFeature, FeatureUsage>>;

function readStore(uid: string): UsageStore {
  if (typeof localStorage === 'undefined' || !uid) return {};
  try {
    const raw = localStorage.getItem(PREFIX + uid);
    return raw ? (JSON.parse(raw) as UsageStore) : {};
  } catch {
    return {};
  }
}

function writeStore(uid: string, store: UsageStore): void {
  if (typeof localStorage === 'undefined' || !uid) return;
  try {
    localStorage.setItem(PREFIX + uid, JSON.stringify(store));
  } catch {
    /* quota/serialize lỗi → bỏ qua */
  }
}

/** Số lượt đã dùng HÔM NAY + THÁNG NÀY cho feature (tự reset khi sang ngày/tháng). */
export function getAiUsage(
  uid: string,
  feature: AiFeature,
  now: Date = new Date(),
): { usedToday: number; usedThisMonth: number } {
  const f = readStore(uid)[feature];
  if (!f) return { usedToday: 0, usedThisMonth: 0 };
  return {
    usedToday: f.dayKey === localDayKey(now) ? f.dayCount : 0,
    usedThisMonth: f.monthKey === localMonthKey(now) ? f.monthCount : 0,
  };
}

/** Ghi nhận 1 lượt dùng AI cho feature (tăng cả daily + monthly, có rollover). */
export function recordAiUse(uid: string, feature: AiFeature, now: Date = new Date()): void {
  const store = readStore(uid);
  const dk = localDayKey(now);
  const mk = localMonthKey(now);
  const f = store[feature];
  store[feature] = {
    dayKey: dk,
    dayCount: (f && f.dayKey === dk ? f.dayCount : 0) + 1,
    monthKey: mk,
    monthCount: (f && f.monthKey === mk ? f.monthCount : 0) + 1,
  };
  writeStore(uid, store);
}

/** Xóa usage của 1 uid (logout/đổi tài khoản — gọi từ clear nếu cần). */
export function clearAiUsage(uid: string): void {
  if (typeof localStorage === 'undefined' || !uid) return;
  try {
    localStorage.removeItem(PREFIX + uid);
  } catch {
    /* ignore */
  }
}
