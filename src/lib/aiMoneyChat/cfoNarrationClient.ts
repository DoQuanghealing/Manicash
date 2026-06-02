import {
  buildLocalCfoNarration,
  computeNarrationFingerprint,
  type CfoNarrationInput,
  type CfoNarrationResult,
} from './cfoNarration';

const LOCAL_CACHE_KEY = 'manicash_cfo_narration_v1';

interface LocalNarrationCache {
  fingerprint: string;
  text: string;
}

function readLocalCache(): LocalNarrationCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalNarrationCache>;
    if (typeof parsed.fingerprint === 'string' && typeof parsed.text === 'string') {
      return { fingerprint: parsed.fingerprint, text: parsed.text };
    }
  } catch {
    // Ignore malformed cache.
  }
  return null;
}

function writeLocalCache(entry: LocalNarrationCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full / disabled — non-fatal.
  }
}

async function getFirebaseIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { getFirebaseAuth } = await import('@/lib/firebase/config');
  return getFirebaseAuth().currentUser?.getIdToken() ?? null;
}

/**
 * Request an AI-written CFO narration with a two-layer cost lock:
 *   1. Client localStorage — if this fingerprint was already generated, return it
 *      instantly with NO network call and NO credit.
 *   2. Server Firestore cache — same fingerprint this month reuses the stored text
 *      without charging a credit.
 * On any non-AI outcome it falls back to the deterministic local narration.
 */
export async function requestCfoNarration(input: CfoNarrationInput): Promise<CfoNarrationResult> {
  const local = buildLocalCfoNarration(input);
  const fingerprint = computeNarrationFingerprint(input);

  const localCache = readLocalCache();
  if (localCache && localCache.fingerprint === fingerprint) {
    return { text: localCache.text, source: 'ai', reason: 'Served from local cache.', cached: true };
  }

  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch('/api/ai-money-chat/cfo-narration', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.source === 'ai' && typeof data.text === 'string') {
      writeLocalCache({ fingerprint, text: data.text });
      return {
        text: data.text,
        source: 'ai',
        reason: data.cached ? 'Served from server cache.' : 'AI narration generated.',
        cached: Boolean(data.cached),
      };
    }

    return {
      text: local,
      source: data?.source ?? 'error',
      reason: typeof data?.reason === 'string' ? data.reason : `Narration fell back to local (${response.status}).`,
      cached: false,
    };
  } catch (error) {
    return {
      text: local,
      source: 'error',
      reason: error instanceof Error ? error.message : 'CFO narration request failed.',
      cached: false,
    };
  }
}
