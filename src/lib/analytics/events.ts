/* ═══ Phase 15 — Analytics layer ═══
 * Thin, production-safe event tracking. No-ops in demo/SSR and whenever
 * NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is absent, so it never breaks the app or
 * leaks PII. The pure pieces (event names + param sanitization) are exported for
 * tests; the Firebase Analytics call is lazily imported and best-effort.
 */

export type AnalyticsEvent =
  | 'chat_parse'
  | 'chat_confirm'
  | 'chat_correction'
  | 'ai_fallback'
  | 'cfo_narration'
  | 'cfo_report_view'
  | 'report_export'
  | 'earning_task_created'
  | 'reconciliation_check';

export type AnalyticsParamValue = string | number | boolean;
export type AnalyticsParams = Record<string, AnalyticsParamValue | null | undefined>;

const MAX_STRING_LENGTH = 100;

/**
 * Keep only primitive params, trim long strings, drop null/undefined. Prevents
 * accidentally shipping raw note text / PII or oversized payloads to analytics.
 */
export function sanitizeEventParams(params: AnalyticsParams = {}): Record<string, AnalyticsParamValue> {
  const out: Record<string, AnalyticsParamValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

function analyticsEnabled(): boolean {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);
}

// Lazily-resolved Firebase Analytics instance (or null when unsupported/disabled).
let analyticsReady: Promise<unknown | null> | null = null;

async function getAnalyticsSafe(): Promise<unknown | null> {
  if (!analyticsEnabled()) return null;
  if (!analyticsReady) {
    analyticsReady = (async () => {
      try {
        const mod = await import('firebase/analytics');
        const supported = await mod.isSupported().catch(() => false);
        if (!supported) return null;
        const { getFirebaseApp } = await import('@/lib/firebase/config');
        return mod.getAnalytics(getFirebaseApp());
      } catch {
        return null;
      }
    })();
  }
  return analyticsReady;
}

/**
 * Fire-and-forget analytics event. Safe to call anywhere — it never throws and
 * resolves to nothing. In demo/dev (no measurementId) it is a pure no-op.
 */
export function trackEvent(event: AnalyticsEvent, params: AnalyticsParams = {}): void {
  if (!analyticsEnabled()) return;
  const clean = sanitizeEventParams(params);
  void getAnalyticsSafe().then(async (analytics) => {
    if (!analytics) return;
    try {
      const { logEvent } = await import('firebase/analytics');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logEvent(analytics as any, event, clean);
    } catch {
      // Best-effort — analytics failures must not affect the app.
    }
  });
}
