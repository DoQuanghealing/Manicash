/* ═══ Bộ đếm chống lạm dụng — Upstash Redis, tự hết hạn ═══
 *
 * VÌ SAO REDIS CHỨ KHÔNG PHẢI FIRESTORE:
 * Đây là đường NÓNG — mỗi request một lượt đếm. Ghi Firestore mỗi request thì
 * vừa tốn tiền vừa chậm, mà đó đúng là thứ kẻ tấn công muốn: càng đánh mạnh
 * càng đắt cho mình. Redis có TTL, key tự biến mất sau cửa sổ đếm nên kho KHÔNG
 * BAO GIỜ PHÌNH theo thời gian — không cần cron dọn, không cần nghĩ tới nữa.
 *
 * VÌ SAO KHÔNG DÙNG new Map() NHƯ TRƯỚC:
 * Vercel chạy serverless, mỗi instance một Map riêng và cold start là mất sạch.
 * Kẻ tấn công chỉ cần đợi vài phút là ban bay hết, còn admin thì luôn thấy bảng
 * trống. Chính file security.ts cũ cũng ghi "Production: Replace Map with Redis".
 *
 * ĐƯỜNG LUI: chưa khai biến môi trường thì tự rơi về bộ nhớ tiến trình để máy
 * dev vẫn chạy được. Bản rơi-về CỐ Ý không chính xác trên nhiều instance — nó
 * là để phát triển, không phải để bảo vệ. `isDistributed()` cho biết đang ở chế
 * độ nào để giao diện admin nói thật với người xem.
 */

const URL_ENV = 'UPSTASH_REDIS_REST_URL';
const TOKEN_ENV = 'UPSTASH_REDIS_REST_TOKEN';

export function isDistributed(): boolean {
  return Boolean(process.env[URL_ENV] && process.env[TOKEN_ENV]);
}

/* ── Đường lui: bộ nhớ tiến trình (chỉ cho máy dev) ── */
const local = new Map<string, { count: number; expiresAt: number }>();

function localIncr(key: string, windowSec: number): number {
  const now = Date.now();
  const cur = local.get(key);
  if (!cur || cur.expiresAt <= now) {
    local.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

/** Dọn key hết hạn — bản rơi-về không có TTL thật nên phải tự quét. */
function sweepLocal(): void {
  if (local.size < 5000) return;
  const now = Date.now();
  for (const [k, v] of local) if (v.expiresAt <= now) local.delete(k);
}

/**
 * Tăng bộ đếm của `key` và trả về giá trị sau khi tăng.
 *
 * TTL đặt bằng `EXPIRE ... NX` (chỉ đặt khi key CHƯA có hạn). Nếu đặt vô điều
 * kiện thì mỗi request lại đẩy hạn ra xa, cửa sổ trượt thành cửa sổ vô tận và
 * bộ đếm không bao giờ reset — kẻ gõ đều tay sẽ bị chặn oan vĩnh viễn.
 *
 * Redis hỏng thì trả 0 (coi như chưa chạm ngưỡng): thà bỏ lọt một nhịp còn hơn
 * khoá nhầm người dùng thật vì hạ tầng đếm trục trặc.
 */
export async function incrementCounter(key: string, windowSec: number): Promise<number> {
  if (!isDistributed()) {
    sweepLocal();
    return localIncr(key, windowSec);
  }

  try {
    const res = await fetch(`${process.env[URL_ENV]}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env[TOKEN_ENV]}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
      ]),
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const out = (await res.json()) as { result?: unknown }[];
    const n = out?.[0]?.result;
    return typeof n === 'number' ? n : 0;
  } catch {
    return 0;
  }
}

/** Chỉ dùng trong test. */
export function __resetLocalCounters(): void {
  local.clear();
}
