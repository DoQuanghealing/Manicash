import { NextResponse, type NextRequest } from 'next/server';
import {
  cancelAccountDeletion,
  getAccountDeletionSnapshot,
  permanentlyDeleteAccount,
  requestAccountDeletion,
} from '@/lib/accountDeletion';
import { getVerifiedRequestUid } from '@/lib/requestAuth';

export const dynamic = 'force-dynamic';

async function requireUid(request: NextRequest): Promise<string | NextResponse> {
  const uid = await getVerifiedRequestUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return uid;
}

export async function GET(request: NextRequest) {
  const uidOrResponse = await requireUid(request);
  if (typeof uidOrResponse !== 'string') return uidOrResponse;

  const snapshot = await getAccountDeletionSnapshot(uidOrResponse);
  return NextResponse.json(snapshot);
}

export async function POST(request: NextRequest) {
  const uidOrResponse = await requireUid(request);
  if (typeof uidOrResponse !== 'string') return uidOrResponse;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
    confirmation?: string;
  };

  if (body.action === 'request') {
    const snapshot = await requestAccountDeletion(uidOrResponse, body.reason);
    const response = NextResponse.json(snapshot);
    response.cookies.delete('manicash-session');
    response.cookies.delete('manicash-rank');
    return response;
  }

  if (body.action === 'cancel') {
    const snapshot = await cancelAccountDeletion(uidOrResponse);
    return NextResponse.json(snapshot);
  }

  if (body.action === 'immediate') {
    if (body.confirmation !== 'DELETE') {
      return NextResponse.json({ error: 'CONFIRMATION_REQUIRED' }, { status: 400 });
    }

    await permanentlyDeleteAccount(uidOrResponse);
    const response = NextResponse.json({ success: true });
    response.cookies.delete('manicash-session');
    response.cookies.delete('manicash-rank');
    return response;
  }

  return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
}
