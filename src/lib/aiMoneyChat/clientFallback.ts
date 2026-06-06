import type { ParsedMoneyIntent } from './types';
import { apiUrl } from '@/lib/apiBase';

export interface AiMoneyFallbackClientResult {
  intent: ParsedMoneyIntent | null;
  source: 'ai' | 'disabled' | 'no-key' | 'unauthorized' | 'quota-exceeded' | 'error';
  reason: string;
}

async function getFirebaseIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { getFirebaseAuth } = await import('@/lib/firebase/config');
  return getFirebaseAuth().currentUser?.getIdToken() ?? null;
}

export async function requestAiMoneyFallback(
  rawText: string,
  localIntent: ParsedMoneyIntent,
): Promise<AiMoneyFallbackClientResult> {
  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(apiUrl('/api/ai-money-chat/parse'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rawText,
        localIntent: {
          type: localIntent.type,
          amount: localIntent.amount?.value,
          categoryId: localIntent.category?.categoryId,
          confidence: localIntent.confidence,
        },
      }),
    });

    if (!response.ok) {
      return {
        intent: null,
        source: 'error',
        reason: `AI fallback request failed: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      intent: data.intent ?? null,
      source: data.source ?? 'error',
      reason: typeof data.reason === 'string' ? data.reason : 'AI fallback response received.',
    };
  } catch (error) {
    return {
      intent: null,
      source: 'error',
      reason: error instanceof Error ? error.message : 'AI fallback request failed.',
    };
  }
}
