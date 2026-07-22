/* ═══ Task Eval — Client (T5) ═══
 * Gọi /api/ai-money-chat/task-eval (Bearer Firebase token). Mọi kết cục KHÔNG-ai
 * (disabled/quota/lỗi) → fallback deterministic local (0đ) để user luôn có kết quả.
 * Cache theo hash nằm TRÊN task (store) — orchestrate ở component, không ở đây.
 */
import { apiUrl } from '@/lib/apiBase';
import type { TaskEvalContext } from './taskEvalPrompt';
import type { TaskEvalAIResponse } from './taskEvalSchema';
import { buildDeterministicTaskEval } from './taskEvalService';

export interface RequestTaskEvalOutcome {
  feasibility: number;
  ai: TaskEvalAIResponse;
  deterministicFallback: boolean;
  source: string;
  reason: string;
  /** Hết suất nếm → UI mời nâng cấp (vẫn kèm bản cơ bản 0đ). */
  upgradeRequired: boolean;
  /** Đang dùng suất nếm: còn bao nhiêu lượt tháng này. */
  taste?: { remaining: number; quota: number };
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

export async function requestTaskEval(ctx: TaskEvalContext): Promise<RequestTaskEvalOutcome> {
  const localFallback = (source: string, reason: string): RequestTaskEvalOutcome => ({
    feasibility: ctx.feasibility,
    ai: buildDeterministicTaskEval(ctx),
    deterministicFallback: true,
    source,
    reason,
    upgradeRequired: source === 'upgrade-required',
  });

  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(apiUrl('/api/ai-money-chat/task-eval'), {
      method: 'POST',
      headers,
      body: JSON.stringify(ctx),
    });
    const data = await res.json().catch(() => null);

    if (res.ok && data?.eval && (data.source === 'ai' || data.source === 'deterministic')) {
      return {
        feasibility: typeof data.feasibility === 'number' ? data.feasibility : ctx.feasibility,
        ai: data.eval as TaskEvalAIResponse,
        deterministicFallback: data.source !== 'ai',
        source: data.source,
        reason: typeof data.reason === 'string' ? data.reason : '',
        upgradeRequired: false,
        taste: data.taste?.isTaste
          ? { remaining: Number(data.taste.remaining) || 0, quota: Number(data.taste.quota) || 0 }
          : undefined,
      };
    }
    // disabled / quota-exceeded / error → bản cơ bản (0đ).
    return localFallback(
      typeof data?.source === 'string' ? data.source : 'error',
      typeof data?.reason === 'string' ? data.reason : 'Bản đánh giá cơ bản.',
    );
  } catch (e) {
    return localFallback('error', e instanceof Error ? e.message : 'Lỗi kết nối.');
  }
}
