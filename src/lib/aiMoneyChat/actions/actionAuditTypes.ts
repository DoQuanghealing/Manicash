/* ═══ AI Money Chat — Action Audit Types (Phase 5) ═══
 * Audit log append-only cho mọi action chat đề xuất + undo metadata.
 */

import type { MoneyActionRequest, MoneyActionType } from './actionTypes';

export type MoneyActionAuditStatus =
  | 'requested'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'failed'
  | 'undone'
  | 'undo_failed';

export type MoneyActionAuditEventType =
  | 'requested'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'failed'
  | 'undo_requested'
  | 'undone'
  | 'undo_failed';

export interface MoneyActionAuditEvent {
  id: string;
  type: MoneyActionAuditEventType;
  at: string;
  message?: string;
  error?: string;
}

export interface MoneyActionUndoSnapshot {
  action: MoneyActionType;
  /** Dữ liệu tối thiểu trước action để rollback. Không lưu secret. */
  before?: unknown;
  after?: unknown;
}

export interface MoneyActionAuditRecord {
  id: string;
  requestId: string;
  action: MoneyActionType;
  request: MoneyActionRequest;
  status: MoneyActionAuditStatus;
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
  undoneAt?: string;
  undoable: boolean;
  undoReason?: string;
  preview: string;
  resultMessage?: string;
  errorMessage?: string;
  undoSnapshot?: MoneyActionUndoSnapshot;
  events: MoneyActionAuditEvent[];
}
