/* ═══ AI Money Chat — Chat API Client (FE wiring) ═══
 * Gọi POST /api/chat với Firebase ID token (Bearer) + cookie session.
 * Trả về reply để UI render. Không bao giờ throw — luôn trả ChatApiResult.
 */

import { apiUrl } from '@/lib/apiBase';
import type { ClientSnapshotInput } from './aggregation/types';
import type { MoneyActionRequest } from './actions/actionTypes';

export interface ChatApiReply {
  message: string;
  ui: { kind: 'confirm-transaction' | 'cfo-card' | 'follow-up-buttons' | 'none'; payload?: unknown };
  meta: { intent: string; source: string; latencyMs: number; tokensUsed?: number };
  /** Phase 4A: lệnh hành động chờ user confirm. */
  actionRequest?: MoneyActionRequest;
}

export interface ChatApiResult {
  ok: boolean;
  reply: ChatApiReply | null;
  intentType?: string;
  /** 'unauthorized' | 'license' | 'network' | 'error' */
  error?: string;
}

async function getFirebaseIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const { getFirebaseAuth } = await import('@/lib/firebase/config');
    return (await getFirebaseAuth().currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

export interface SendChatParams {
  message: string;
  sessionId: string;
  clientSnapshot: ClientSnapshotInput;
}

export async function sendChatMessage(params: SendChatParams): Promise<ChatApiResult> {
  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        message: params.message,
        sessionId: params.sessionId,
        clientSnapshot: params.clientSnapshot,
      }),
    });

    if (res.status === 401) return { ok: false, reply: null, error: 'unauthorized' };
    if (res.status === 503) return { ok: false, reply: null, error: 'license' };

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, reply: data?.reply ?? null, error: data?.error ?? 'error' };
    }

    return { ok: true, reply: data?.reply ?? null, intentType: data?.intent?.type };
  } catch (error) {
    return {
      ok: false,
      reply: null,
      error: error instanceof Error ? error.message : 'network',
    };
  }
}
