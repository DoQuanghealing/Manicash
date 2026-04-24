/* ═══ Security — Rate Limiter + Auto-Ban Engine ═══ */

/**
 * In-memory rate limiter and ban manager.
 * - Tracks requests per IP and per session (user UID)
 * - Auto-bans IPs/UIDs that exceed the limit
 * - Bans persist in-memory (reset on server restart)
 * - Admin API can list/unban
 *
 * Production: Replace Map with Redis for multi-instance support.
 */

/* ── Config ── */
const MAX_REQUESTS_PER_WINDOW = 30;   // Max requests per window
const WINDOW_MS = 2000;               // 2-second window
const VIOLATION_THRESHOLD = 3;         // Violations before auto-ban
const CLEANUP_INTERVAL_MS = 10_000;    // Cleanup old entries every 10s

/* ── Types ── */
interface RateLimitEntry {
  count: number;
  windowStart: number;
  violations: number;
}

export interface BanRecord {
  identifier: string;    // IP or UID
  type: 'ip' | 'uid';
  reason: string;
  bannedAt: string;      // ISO timestamp
  violations: number;
}

/* ── Storage ── */
const rateLimitMap = new Map<string, RateLimitEntry>();
const banMap = new Map<string, BanRecord>();

/* ── Periodic cleanup of expired rate limit windows ── */
let cleanupStarted = false;
function startCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.windowStart > WINDOW_MS * 5) {
        rateLimitMap.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/* ── Rate Limit Check ── */
export function checkRateLimit(identifier: string, type: 'ip' | 'uid'): {
  allowed: boolean;
  banned: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  startCleanup();

  const key = `${type}:${identifier}`;

  // Check if already banned
  if (banMap.has(key)) {
    return { allowed: false, banned: true, remaining: 0, retryAfterMs: 0 };
  }

  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // New window
    entry = { count: 1, windowStart: now, violations: entry?.violations || 0 };
    rateLimitMap.set(key, entry);
    return {
      allowed: true,
      banned: false,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      retryAfterMs: 0,
    };
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    // Over limit — count violation
    entry.violations++;

    if (entry.violations >= VIOLATION_THRESHOLD) {
      // AUTO-BAN
      const banRecord: BanRecord = {
        identifier,
        type,
        reason: `Tự động ban: Vượt ${MAX_REQUESTS_PER_WINDOW} requests/${WINDOW_MS}ms, vi phạm ${entry.violations} lần`,
        bannedAt: new Date().toISOString(),
        violations: entry.violations,
      };
      banMap.set(key, banRecord);
      rateLimitMap.delete(key);

      console.warn(`[SECURITY] 🚫 Auto-banned ${type}:${identifier} — ${banRecord.reason}`);

      return { allowed: false, banned: true, remaining: 0, retryAfterMs: 0 };
    }

    const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
    return {
      allowed: false,
      banned: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  return {
    allowed: true,
    banned: false,
    remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
    retryAfterMs: 0,
  };
}

/* ── Ban Management ── */
export function isBanned(identifier: string, type: 'ip' | 'uid'): boolean {
  return banMap.has(`${type}:${identifier}`);
}

export function getBanRecord(identifier: string, type: 'ip' | 'uid'): BanRecord | null {
  return banMap.get(`${type}:${identifier}`) || null;
}

export function getAllBans(): BanRecord[] {
  return Array.from(banMap.values());
}

export function unban(identifier: string, type: 'ip' | 'uid'): boolean {
  const key = `${type}:${identifier}`;
  const existed = banMap.has(key);
  banMap.delete(key);
  rateLimitMap.delete(key); // Also reset rate limit counter
  if (existed) {
    console.log(`[SECURITY] ✅ Unbanned ${type}:${identifier}`);
  }
  return existed;
}

export function manualBan(identifier: string, type: 'ip' | 'uid', reason: string): void {
  const key = `${type}:${identifier}`;
  banMap.set(key, {
    identifier,
    type,
    reason: `Thủ công: ${reason}`,
    bannedAt: new Date().toISOString(),
    violations: 0,
  });
  console.warn(`[SECURITY] 🚫 Manual ban ${type}:${identifier} — ${reason}`);
}

/* ── Stats ── */
export function getSecurityStats(): {
  totalTracked: number;
  totalBanned: number;
  activeConnections: number;
} {
  return {
    totalTracked: rateLimitMap.size,
    totalBanned: banMap.size,
    activeConnections: rateLimitMap.size,
  };
}
