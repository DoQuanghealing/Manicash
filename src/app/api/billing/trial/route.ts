import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { grantTrialAtomic, TrialDeniedError, type TrialDenyReason } from '@/lib/monetization/grantTrial';

const DENY_MESSAGE: Record<TrialDenyReason, string> = {
  already_pro: 'Bạn đang dùng Pro rồi.',
  uid_used: 'Tài khoản này đã dùng thử.',
  email_used: 'Email này đã dùng thử.',
  device_used: 'Thiết bị này đã dùng thử.',
};

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || '';
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';

  const uid = await getVerifiedRequestUid(req);
  if (!uid) {
    return NextResponse.json({ source: 'unauthorized', reason: 'Cần đăng nhập để dùng thử.' }, { status: 401 });
  }

  try {
    const userRecord = await getAdminAuth().getUser(uid);
    const email = userRecord.email ?? '';
    // Yêu cầu email (Google OAuth luôn có) → đảm bảo lớp ledger email chống lách hoạt động.
    if (!email) {
      return NextResponse.json(
        { source: 'invalid', reason: 'Tài khoản cần email để dùng thử.' },
        { status: 400 },
      );
    }
    const grant = await grantTrialAtomic({ uid, email, deviceId, ip: clientIp(req) });
    return NextResponse.json({
      source: 'granted',
      reason: 'Đã kích hoạt dùng thử Pro 30 ngày.',
      tier: grant.tier,
      premiumExpiresAt: grant.premiumExpiresAt,
    });
  } catch (error) {
    if (error instanceof TrialDeniedError) {
      return NextResponse.json(
        { source: 'trial_used', reason: DENY_MESSAGE[error.reason], code: error.reason },
        { status: 409 },
      );
    }
    console.error('[billing/trial] error:', error);
    return NextResponse.json({ source: 'error', reason: 'Kích hoạt dùng thử thất bại.' }, { status: 500 });
  }
}
