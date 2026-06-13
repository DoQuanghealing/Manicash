/* ═══ Action Audit Store (Phase 5) ═══
 * Append-only audit log cho client-executed actions + undo metadata.
 * Persist localStorage. Server KHÔNG dùng store này (client-only).
 */
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  MoneyActionAuditRecord,
  MoneyActionAuditEvent,
  MoneyActionAuditEventType,
  MoneyActionUndoSnapshot,
} from '@/lib/aiMoneyChat/actions/actionAuditTypes';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';

/** Giới hạn lịch sử local để tránh phình localStorage. */
const HISTORY_LIMIT = 200;

let seq = 0;
function genId(prefix: string): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}-${Date.now()}-${seq}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function event(type: MoneyActionAuditEventType, message?: string, error?: string): MoneyActionAuditEvent {
  return { id: genId('evt'), type, at: nowIso(), message, error };
}

interface MarkExecutedInput {
  message: string;
  undoable: boolean;
  undoReason?: string;
  undoSnapshot?: MoneyActionUndoSnapshot;
}

interface ActionAuditState {
  records: MoneyActionAuditRecord[];

  addRequested: (request: MoneyActionRequest) => MoneyActionAuditRecord;
  markConfirmed: (requestId: string) => void;
  markExecuted: (requestId: string, input: MarkExecutedInput) => void;
  markCancelled: (requestId: string, message?: string) => void;
  markFailed: (requestId: string, error: string) => void;
  markUndoRequested: (requestId: string) => void;
  markUndone: (requestId: string, message: string) => void;
  markUndoFailed: (requestId: string, error: string) => void;

  getByRequestId: (requestId: string) => MoneyActionAuditRecord | undefined;
  getRecent: (limit?: number) => MoneyActionAuditRecord[];
  clearHistoryForDev: () => void;
}

/** Cập nhật 1 record theo requestId, append event, không mất event cũ. */
function patchRecord(
  records: MoneyActionAuditRecord[],
  requestId: string,
  patch: Partial<MoneyActionAuditRecord>,
  evt: MoneyActionAuditEvent,
): MoneyActionAuditRecord[] {
  return records.map((r) =>
    r.requestId === requestId
      ? { ...r, ...patch, updatedAt: evt.at, events: [...r.events, evt] }
      : r,
  );
}

export const useActionAuditStore = create<ActionAuditState>()(
  persist(
    (set, get) => ({
      records: [],

      addRequested: (request) => {
        const at = nowIso();
        const record: MoneyActionAuditRecord = {
          id: genId('aud'),
          requestId: request.requestId,
          action: request.action,
          request,
          status: 'requested',
          createdAt: at,
          updatedAt: at,
          undoable: false,
          preview: request.preview,
          events: [event('requested')],
        };
        // Newest-first; cắt bớt theo HISTORY_LIMIT.
        set((s) => ({ records: [record, ...s.records].slice(0, HISTORY_LIMIT) }));
        return record;
      },

      markConfirmed: (requestId) =>
        set((s) => ({ records: patchRecord(s.records, requestId, { status: 'confirmed' }, event('confirmed')) })),

      markExecuted: (requestId, input) =>
        set((s) => ({
          records: patchRecord(
            s.records,
            requestId,
            {
              status: 'executed',
              executedAt: nowIso(),
              undoable: input.undoable,
              undoReason: input.undoReason,
              undoSnapshot: input.undoSnapshot,
              resultMessage: input.message,
            },
            event('executed', input.message),
          ),
        })),

      markCancelled: (requestId, message) =>
        set((s) => ({
          records: patchRecord(s.records, requestId, { status: 'cancelled', resultMessage: message }, event('cancelled', message)),
        })),

      markFailed: (requestId, error) =>
        set((s) => ({
          records: patchRecord(s.records, requestId, { status: 'failed', errorMessage: error }, event('failed', undefined, error)),
        })),

      markUndoRequested: (requestId) =>
        set((s) => ({ records: patchRecord(s.records, requestId, {}, event('undo_requested')) })),

      markUndone: (requestId, message) =>
        set((s) => ({
          records: patchRecord(
            s.records,
            requestId,
            { status: 'undone', undoneAt: nowIso(), undoable: false, resultMessage: message },
            event('undone', message),
          ),
        })),

      markUndoFailed: (requestId, error) =>
        set((s) => ({
          records: patchRecord(s.records, requestId, { status: 'undo_failed', errorMessage: error }, event('undo_failed', undefined, error)),
        })),

      getByRequestId: (requestId) => get().records.find((r) => r.requestId === requestId),
      getRecent: (limit = 20) => get().records.slice(0, limit),
      clearHistoryForDev: () => set({ records: [] }),
    }),
    {
      name: 'manicash-action-audit',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ records: s.records }),
    },
  ),
);
