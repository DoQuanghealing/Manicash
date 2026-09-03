/* ═══ Cron — dọn dữ liệu quá hạn (90 ngày) ═══
 * Bảo vệ bằng CRON_SECRET, y như cron xoá tài khoản đã có.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { purgeExpired } from '@/lib/abuse/purge';
import { logAppError } from '@/lib/appErrorLog';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return (
    req.headers.get('x-cron-secret') === expected ||
    req.headers.get('authorization') === `Bearer ${expected}`
  );
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const result = await purgeExpired();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    void logAppError('cron/purge', error);
    return NextResponse.json({ error: 'PURGE_FAILED' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
