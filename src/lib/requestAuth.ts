import type { NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export async function getVerifiedRequestUid(request: NextRequest): Promise<string | null> {
  const sessionUid = request.cookies.get('manicash-session')?.value;
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!sessionUid || !match) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    if (decoded.uid !== sessionUid) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}
