/*
 * Webhook Token API
 *
 * POST   /api/webhook-token - generate or rotate token for authenticated user.
 * DELETE /api/webhook-token - invalidate token for authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebaseAdmin';
import { generateToken } from '@/lib/sms/tokenGenerator';
import type { WebhookToken } from '@/types/webhook';

async function verifyUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(authHeader.slice(7).trim());
    return decoded.uid;
  } catch (e) {
    console.error('[webhook-token] verifyIdToken failed:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await verifyUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Authorization Bearer token khong hop le' }, { status: 401 });
  }

  const db = getAdminDb();
  const docRef = db.collection('webhook_tokens').doc(userId);
  const now = new Date().toISOString();

  let createdAt = now;
  try {
    const existing = await docRef.get();
    if (existing.exists) {
      createdAt = (existing.data() as WebhookToken).createdAt ?? now;
    }
  } catch (e) {
    console.error('[webhook-token] read existing failed:', e);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  }

  const token = generateToken();
  const rotatedAt = new Date().toISOString();
  const doc: WebhookToken = { userId, token, createdAt, rotatedAt };

  try {
    await docRef.set(doc);
  } catch (e) {
    console.error('[webhook-token] write failed:', e);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  }

  return NextResponse.json({ token, createdAt, rotatedAt });
}

export async function DELETE(req: NextRequest) {
  const userId = await verifyUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Authorization Bearer token khong hop le' }, { status: 401 });
  }

  try {
    await getAdminDb().collection('webhook_tokens').doc(userId).delete();
  } catch (e) {
    console.error('[webhook-token] delete failed:', e);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  }

  return NextResponse.json({ status: 'deleted' });
}
