import { NextResponse, type NextRequest } from 'next/server';
import { completeDueAccountDeletions } from '@/lib/accountDeletion';

export const dynamic = 'force-dynamic';

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET || process.env.ACCOUNT_DELETION_CRON_SECRET;
  const providedSecret = request.headers.get('x-cron-secret');
  const authorization = request.headers.get('authorization');

  if (!expectedSecret) return false;
  if (providedSecret === expectedSecret) return true;
  return authorization === `Bearer ${expectedSecret}`;
}

async function runCron(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const result = await completeDueAccountDeletions();
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
