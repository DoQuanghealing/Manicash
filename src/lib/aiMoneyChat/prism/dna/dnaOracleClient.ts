/* ═══ Financial DNA — Client (PV-3 · B3) ═══
 * Gọi /api/ai-money-chat/dna-oracle (Bearer Firebase token). Mọi kết cục KHÔNG-ai
 * (disabled/quota/lỗi mạng) → fallback deterministic local (0đ) để user luôn có
 * báo cáo. ⚠️ reflections đi trong request rồi BỎ — caller không được persist.
 */
import { apiUrl } from '@/lib/apiBase';
import type { DnaAnswer } from './dnaQuestions';
import type { DnaReflectionInput, DnaCapacityScores } from './dnaOraclePrompt';
import type { DnaOracleReport } from './dnaOracleSchema';
import { validateDnaOracleReport } from './dnaOracleSchema';
import { buildDeterministicDnaOracle } from './dnaOracleService';
import { resolveDnaPersona } from './personaEngine';

export interface RequestDnaOracleOutcome {
  report: DnaOracleReport;
  deterministicFallback: boolean;
  source: string;
  reason: string;
  /** Chưa đủ cấp (Phú Vương) → UI mời nâng cấp (vẫn kèm bản cơ bản 0đ). */
  upgradeRequired: boolean;
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

export async function requestDnaOracle(input: {
  answers: DnaAnswer[];
  reflections: DnaReflectionInput[];
  capacity?: DnaCapacityScores;
}): Promise<RequestDnaOracleOutcome> {
  const localFallback = (source: string, reason: string): RequestDnaOracleOutcome | null => {
    const persona = resolveDnaPersona(input.answers);
    if (!persona) return null;
    return {
      report: buildDeterministicDnaOracle({ persona, answers: input.answers, reflections: [] }),
      deterministicFallback: true,
      source,
      reason,
      upgradeRequired: source === 'upgrade-required',
    };
  };
  const hardError: RequestDnaOracleOutcome = {
    report: {
      personaReflection: '', strengths: [], blindspots: [], behaviorActions: [],
      mindsetShift: '', growthOrientation: 50,
    },
    deterministicFallback: true,
    source: 'error',
    reason: 'Chưa đủ câu trả lời để luận giải.',
    upgradeRequired: false,
  };

  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(apiUrl('/api/ai-money-chat/dna-oracle'), {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => null);

    if (res.ok && data?.report && (data.source === 'ai' || data.source === 'deterministic')) {
      const report = validateDnaOracleReport(data.report);
      if (report) {
        return {
          report,
          deterministicFallback: data.source !== 'ai',
          source: data.source,
          reason: typeof data.reason === 'string' ? data.reason : '',
          upgradeRequired: false,
        };
      }
    }
    return (
      localFallback(
        typeof data?.source === 'string' ? data.source : 'error',
        typeof data?.reason === 'string' ? data.reason : 'Bản luận giải cơ bản.',
      ) ?? hardError
    );
  } catch (e) {
    return localFallback('error', e instanceof Error ? e.message : 'Lỗi kết nối.') ?? hardError;
  }
}

/** Xoá riêng bản phân tích trên server (nút xoá — spec §6). Trả ok? */
export async function requestDnaOracleDeletion(): Promise<boolean> {
  try {
    const token = await getFirebaseIdToken();
    if (!token) return false;
    const res = await fetch(apiUrl('/api/ai-money-chat/dna-oracle'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
