/* ═══ Session API — Set/Delete session cookie after Firebase auth ═══ */
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { action, uid, rank } = body;

  if (action === 'login' && uid) {
    const response = NextResponse.json({ success: true });

    // Set session cookie (HttpOnly for security)
    response.cookies.set('manicash-session', uid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Set rank cookie (readable by proxy for content gating)
    if (rank) {
      response.cookies.set('manicash-rank', rank, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  }

  if (action === 'logout') {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('manicash-session');
    response.cookies.delete('manicash-rank');
    return response;
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
