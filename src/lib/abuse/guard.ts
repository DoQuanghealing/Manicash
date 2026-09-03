/* ═══ Bộ gác đặt ở đầu route ═══
 *
 * VÌ SAO KHÔNG ĐẶT Ở MIDDLEWARE: middleware Next chạy trên Edge runtime, mà
 * firebase-admin là thư viện Node — không import được ở đó. Đếm thì Edge làm
 * được (Upstash gọi qua fetch), nhưng GHI sự kiện và ĐỌC trạng thái khoá thì
 * không. Tách đôi hai nơi sẽ khó lần khi có sự cố, nên gom hết vào route.
 *
 * CÁCH DÙNG:
 *   const blocked = await guardRequest(req, 'ai');
 *   if (blocked) return blocked;
 *
 * Đặt ở đầu, TRƯỚC mọi việc tốn kém (gọi LLM, đọc Firestore, tạo đơn).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { incrementCounter } from './counterStore';
import { judge, ruleFor, shouldRecord } from './policy';
import { getSubjectStatus, recordAbuse } from './record';

/** Ưu tiên uid; chưa đăng nhập thì rơi về IP. */
export function subjectOf(req: NextRequest, uid?: string | null): string {
  if (uid) return `uid:${uid}`;
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

function tooMany(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Bạn thao tác hơi nhanh. Chờ một chút rồi thử lại nhé.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}

/**
 * Trả về `NextResponse` nếu phải chặn, `null` nếu cho đi tiếp.
 *
 * Thứ tự cố ý: kiểm trạng thái khoá TRƯỚC khi đếm. Người đã bị khoá mà vẫn cộng
 * vào bộ đếm thì họ tự giữ mình ở mức khoá mãi, kể cả sau khi admin gỡ.
 */
export async function guardRequest(
  req: NextRequest,
  kind: string,
  uid?: string | null,
): Promise<NextResponse | null> {
  const subject = subjectOf(req, uid);
  const rule = ruleFor(kind);

  if ((await getSubjectStatus(subject)) === 'locked') {
    return tooMany(rule.windowSec);
  }

  const count = await incrementCounter(`ab:${kind}:${subject}`, rule.windowSec);
  const verdict = judge(count, rule);

  if (shouldRecord(count, rule)) {
    // Không await: ghi nhật ký không được làm chậm request của người dùng.
    void recordAbuse({
      subject,
      kind,
      verdict,
      count,
      path: req.nextUrl?.pathname ?? null,
    });
  }

  // 'watch' CHỈ ghi nhận, KHÔNG chặn — xem triết lý ở policy.ts.
  return verdict === 'lock' ? tooMany(rule.windowSec) : null;
}
