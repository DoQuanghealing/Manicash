/* ═══ Persistence Config (Phase 6B-1) ═══
 * Storage keys + versions + SSR-safe storage + onRehydrate hook dùng chung cho
 * các store tài chính. Local-first; KHÔNG cloud sync.
 */
'use client';

import { useHydrationStore, type CoreStoreKey } from '@/stores/useHydrationStore';

export const STORE_VERSIONS = {
  finance: 1,
  budget: 1,
  goals: 1,
  tasks: 1,
  auth: 1,
  audit: 1,
  dashboard: 1,
  walletBank: 1,
} as const;

/**
 * Chế độ demo (chụp ảnh quảng cáo) dùng NAMESPACE RIÊNG cho localStorage.
 * Lý do: seed chỉ áp dụng khi chưa có dữ liệu persist — nếu dùng chung key với
 * bản thường thì máy đã mở app trước đó sẽ không bao giờ thấy hồ sơ mẫu.
 * Tách namespace cũng giữ nguyên dữ liệu thật của máy đó khi tắt cờ demo.
 */
const NS = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? '.demo' : '';

export const STORE_KEYS = {
  finance: `manicash.finance.v1${NS}`,
  budget: `manicash.budget.v1${NS}`,
  goals: `manicash.goals.v1${NS}`,
  tasks: `manicash.tasks.v1${NS}`,
  auth: `manicash.auth.v1${NS}`,
  // Audit dùng key cũ từ Phase 5 (không versioned) — giữ nguyên để không mất data đã lưu.
  audit: `manicash-action-audit${NS}`,
  // Dashboard: quỹ tiết kiệm (reserve/goals/investment) + lịch sử tích lũy.
  // Trước đây KHÔNG persist → tắt app là mất số quỹ dù tiền đã trừ khỏi mainBalance.
  dashboard: `manicash.dashboard.v1${NS}`,
  // WalletBank: tên + số tài khoản ngân hàng 3 nhóm (thu/chi/tiết kiệm).
  // Trước đây KHÔNG persist → user nhập tên/số TK xong tải lại là mất.
  walletBank: `manicash.walletbank.v1${NS}`,
} as const;

/**
 * onRehydrateStorage helper: sau khi rehydrate (kể cả khi chưa có persisted data),
 * đánh dấu store đã hydrate. Nuốt lỗi rehydrate để không crash app.
 */
export function onRehydrateMark(key: CoreStoreKey) {
  // Trả callback 0-arg để KHÔNG ràng buộc generic state của persist (tránh poison
  // type inference -> StateCreator<unknown>). Đánh dấu hydrated sau khi rehydrate.
  return () => () => {
    useHydrationStore.getState().markHydrated(key);
  };
}
