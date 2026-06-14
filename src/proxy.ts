/* ═══ Proxy — Auth Guard + Rate Limit + Auto-Ban (Next.js 16) ═══ */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, isBanned } from '@/lib/security';

/* ── Protected routes ── */
const PROTECTED_PREFIXES = [
  '/overview',
  '/ledger',
  '/input',
  '/goals',
  '/money',
  '/academy',
  '/settings',
];

/* ── Routes that skip rate limiting + ban check ── */
const SKIP_RATE_LIMIT_PREFIXES = [
  '/_next',
  '/favicon',
  '/sounds',
  '/api/admin',
  // CHỈ webhook PayOS (server-to-server, IP cố định) mới skip ban/rate-limit — xác thực
  // bằng chữ ký. create-link/status/confirm có auth riêng → GIỮ rate-limit (chống spam).
  '/api/payos/webhook',
];

/* ── Rank-gated academy courses ── */
const RANK_GATED_COURSES: Record<string, string> = {
  'spending-101': 'bronze',
  'savings-mindset': 'silver',
  'investing-basics': 'gold',
  'passive-income': 'platinum',
  'business-network': 'emerald',
  'advanced-investing': 'diamond',
};

const RANK_HIERARCHY = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond'];

/* ── CORS: cho phép app mobile (Capacitor) gọi API cross-origin ── */
const ALLOWED_ORIGINS = new Set([
  'https://localhost', // Capacitor Android (androidScheme: 'https')
  'capacitor://localhost', // iOS (v2)
  'http://localhost:3000', // dev: test mobile against local API
]);

/** Trả về CORS headers nếu origin nằm trong allowlist; rỗng nếu không. */
function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }
  return {};
}

/* ── Get real IP from request ── */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  return req.headers.get('x-client-ip') || '127.0.0.1';
}

/* ═══ Main Proxy Function (Next.js 16 convention) ═══ */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');
  const isApi = pathname.startsWith('/api/');

  // CORS preflight cho API — trả lời trước mọi ban/rate-limit/skip check
  if (isApi && req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Skip static assets and internal routes
  if (SKIP_RATE_LIMIT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const clientIP = getClientIP(req);
  const sessionUID = req.cookies.get('manicash-session')?.value;

  /* ─── LAYER 1: Ban Check ─── */
  if (isBanned(clientIP, 'ip')) {
    return new NextResponse(
      JSON.stringify({
        error: 'ACCESS_DENIED',
        message: 'IP của bạn đã bị chặn vĩnh viễn do vi phạm. Liên hệ admin để được hỗ trợ.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (sessionUID && isBanned(sessionUID, 'uid')) {
    const response = new NextResponse(
      JSON.stringify({
        error: 'ACCOUNT_BANNED',
        message: 'Tài khoản của bạn đã bị chặn vĩnh viễn. Liên hệ admin để được hỗ trợ.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
    response.cookies.delete('manicash-session');
    response.cookies.delete('manicash-rank');
    return response;
  }

  /* ─── LAYER 2: Rate Limiting ─── */
  const ipCheck = checkRateLimit(clientIP, 'ip');

  if (!ipCheck.allowed) {
    if (ipCheck.banned) {
      return new NextResponse(
        JSON.stringify({
          error: 'IP_BANNED',
          message: 'IP của bạn đã bị chặn vĩnh viễn do gửi quá nhiều requests.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        error: 'RATE_LIMITED',
        message: 'Bạn đang gửi requests quá nhanh. Vui lòng đợi.',
        retryAfterMs: ipCheck.retryAfterMs,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(ipCheck.retryAfterMs / 1000)),
          'X-RateLimit-Remaining': String(ipCheck.remaining),
        },
      }
    );
  }

  // Also rate limit by UID if logged in
  if (sessionUID) {
    const uidCheck = checkRateLimit(sessionUID, 'uid');

    if (!uidCheck.allowed) {
      if (uidCheck.banned) {
        const response = new NextResponse(
          JSON.stringify({
            error: 'ACCOUNT_BANNED',
            message: 'Tài khoản của bạn đã bị chặn vĩnh viễn do gửi quá nhiều requests.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
        response.cookies.delete('manicash-session');
        return response;
      }

      return new NextResponse(
        JSON.stringify({
          error: 'RATE_LIMITED',
          message: 'Tài khoản đang gửi requests quá nhanh.',
          retryAfterMs: uidCheck.retryAfterMs,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(uidCheck.retryAfterMs / 1000)),
          },
        }
      );
    }
  }

  /* ─── LAYER 3: Auth Guard ─── */
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    const session = req.cookies.get('manicash-session')?.value;

    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  /* ─── LAYER 4: Academy Rank Gating ─── */
  if (pathname.startsWith('/academy/')) {
    const segments = pathname.split('/');
    const courseId = segments[2];

    if (courseId && RANK_GATED_COURSES[courseId]) {
      const requiredRank = RANK_GATED_COURSES[courseId];
      const userRank = req.cookies.get('manicash-rank')?.value || 'iron';

      const userRankIndex = RANK_HIERARCHY.indexOf(userRank);
      const requiredIndex = RANK_HIERARCHY.indexOf(requiredRank);

      if (userRankIndex < requiredIndex) {
        const url = req.nextUrl.clone();
        url.searchParams.set('gated', requiredRank);
        return NextResponse.rewrite(url);
      }
    }
  }

  /* ─── Pass through with security headers ─── */
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Remaining', String(ipCheck.remaining));
  response.headers.set('X-RateLimit-Limit', '30');
  // CORS cho API response thành công (mobile gọi cross-origin)
  if (isApi) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      response.headers.set(k, v);
    }
  }
  return response;
}

/* ── Matcher ── */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sounds/).*)',
  ],
};
