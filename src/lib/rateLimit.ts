/* ═══ Rate limit — sliding-window, in-memory, per-key (uid) ═══
 * Chặn spam/loop trên các API route tốn tài nguyên (verify token + đọc Firestore).
 * Lõi `evaluateRateLimit` THUẦN (pure) → test được; `checkRateLimit` bọc store module-level.
 *
 * Giới hạn của in-memory: state theo từng serverless instance (reset khi cold start,
 * mỗi instance đếm riêng). Đủ để giết loop/burst từ 1 client (case phổ biến nhất);
 * chống lạm dụng phân tán cần backstop Firestore/Upstash — xem PHU_VUONG_BUILD_ROADMAP / follow-up.
 */

export interface RateLimitRule {
  /** Bề rộng cửa sổ (ms). */
  windowMs: number;
  /** Số lượt tối đa trong cửa sổ. */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Giây cần chờ trước khi thử lại (0 khi ok). */
  retryAfterSec: number;
  /** Số lượt còn lại của luật chặt nhất sau lượt này (0 khi bị chặn). */
  remaining: number;
}

/**
 * THUẦN: đánh giá 1 lượt tại `now` dựa trên danh sách mốc thời gian các lượt trước.
 * KHÔNG thêm `now` vào `hits` — caller tự append khi ok. `hits` không cần sort trước.
 */
export function evaluateRateLimit(
  hits: number[],
  rules: RateLimitRule[],
  now: number,
): RateLimitResult {
  let blockedRetryMs = 0;
  let minRemaining = Number.POSITIVE_INFINITY;

  for (const rule of rules) {
    const windowStart = now - rule.windowMs;
    const inWindow = hits.filter((t) => t > windowStart);
    const count = inWindow.length;

    if (count >= rule.max) {
      // Chờ tới khi lượt cũ nhất trong cửa sổ rơi ra ngoài.
      const oldest = Math.min(...inWindow);
      const waitMs = oldest + rule.windowMs - now;
      if (waitMs > blockedRetryMs) blockedRetryMs = waitMs;
    } else {
      const remainingForRule = rule.max - count - 1; // trừ lượt hiện tại
      if (remainingForRule < minRemaining) minRemaining = remainingForRule;
    }
  }

  if (blockedRetryMs > 0) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(blockedRetryMs / 1000)), remaining: 0 };
  }
  return { ok: true, retryAfterSec: 0, remaining: Math.max(0, minRemaining === Infinity ? 0 : minRemaining) };
}

// ── Store module-level (per instance) ──
const store = new Map<string, number[]>();
const MAX_KEYS = 20_000;

function maxWindow(rules: RateLimitRule[]): number {
  let m = 0;
  for (const r of rules) if (r.windowMs > m) m = r.windowMs;
  return m;
}

/** Dọn key cũ khi store phình to (chống rò bộ nhớ trên instance sống lâu). */
function sweep(now: number, horizon: number) {
  for (const [key, hits] of store) {
    const latest = hits.length ? hits[hits.length - 1] : 0;
    if (latest <= now - horizon) store.delete(key);
  }
}

/** Kiểm tra + ghi nhận 1 lượt cho `key`. Trả quyết định; tự prune mốc cũ. */
export function checkRateLimit(
  key: string,
  rules: RateLimitRule[],
  now: number = Date.now(),
): RateLimitResult {
  const horizon = maxWindow(rules);
  const prev = store.get(key) ?? [];
  const pruned = prev.filter((t) => t > now - horizon);

  const res = evaluateRateLimit(pruned, rules, now);
  if (res.ok) pruned.push(now);
  store.set(key, pruned);

  if (store.size > MAX_KEYS) sweep(now, horizon);
  return res;
}

/** Xoá state (dùng cho test / logout housekeeping). */
export function resetRateLimit(key?: string) {
  if (key) store.delete(key);
  else store.clear();
}

/** Đọc rule từ env với fallback (ops chỉnh không cần đổi code). VD name='CHAT'. */
export function rulesFromEnv(name: string, fallback: RateLimitRule[]): RateLimitRule[] {
  const readInt = (suffix: string, fb: number) => {
    const v = Number(process.env[`RATE_LIMIT_${name}_${suffix}`]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : fb;
  };
  // Chỉ override số `max` (giữ windowMs cố định để đơn giản).
  return fallback.map((r, i) => ({ windowMs: r.windowMs, max: readInt(`MAX_${i}`, r.max) }));
}
