/* ═══ P0 Monetization — client billing flow ═══
 * Acquires a purchase token from the platform billing layer, then verifies it
 * server-side at /api/billing/verify. The native Google Play Billing step (via a
 * Capacitor plugin) plugs into acquirePurchaseToken(); web/dev falls back to a
 * mock token that only succeeds when the server has BILLING_ALLOW_MOCK=true.
 */

import { PRO_PRODUCT_ID, type Tier } from './entitlement';
import { apiUrl } from '@/lib/apiBase';

export interface PurchaseResult {
  ok: boolean;
  source: string;
  reason: string;
  tier?: Tier;
  premiumExpiresAt?: string;
}

interface AcquiredPurchase {
  provider: 'google_play' | 'mock';
  productId: string;
  purchaseToken: string;
  orderId: string;
}

async function getFirebaseIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { getFirebaseAuth } = await import('@/lib/firebase/config');
  return getFirebaseAuth().currentUser?.getIdToken() ?? null;
}

/**
 * Get a purchase token from the platform store. On a real Android build this
 * launches the Google Play purchase sheet via a Capacitor plugin; on web/dev it
 * returns a mock token for end-to-end testing of the verify → grant flow.
 */
async function acquirePurchaseToken(): Promise<AcquiredPurchase | null> {
  // TODO: detect Capacitor native + call Google Play Billing plugin here.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    provider: 'mock',
    productId: PRO_PRODUCT_ID,
    purchaseToken: `mock-token-${stamp}`,
    orderId: `mock-order-${stamp}`,
  };
}

const DEVICE_ID_KEY = 'manicash.deviceId';

/** ID thiết bị bền (localStorage) cho vân tay nhẹ chống lách dùng thử. */
export function getOrCreateDeviceId(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const rand = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      id = `dev_${rand}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/** Kích hoạt dùng thử Pro 30 ngày (1 lần/đời). 409 nếu đã thử (uid/email/device). */
export async function startTrial(): Promise<PurchaseResult> {
  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(apiUrl('/api/billing/trial'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
    });
    const data = await response.json().catch(() => null);

    if (response.ok && data?.source === 'granted') {
      return { ok: true, source: 'granted', reason: data.reason ?? 'Đã kích hoạt dùng thử.', tier: data.tier, premiumExpiresAt: data.premiumExpiresAt };
    }
    return {
      ok: false,
      source: data?.source ?? 'error',
      reason: typeof data?.reason === 'string' ? data.reason : `Kích hoạt thất bại (${response.status}).`,
    };
  } catch (error) {
    return { ok: false, source: 'error', reason: error instanceof Error ? error.message : 'Không kết nối được dịch vụ.' };
  }
}

/** Tạo link PayOS theo kỳ hạn (plan) rồi chuyển hướng tới trang thanh toán. */
export async function startCheckout(plan: string): Promise<PurchaseResult> {
  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(apiUrl('/api/payos/create-link'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok && data?.checkoutUrl) {
      if (typeof window !== 'undefined') window.location.href = data.checkoutUrl;
      return { ok: true, source: 'redirect', reason: 'Đang chuyển tới trang thanh toán…' };
    }
    return {
      ok: false,
      source: 'error',
      reason: typeof data?.error === 'string' ? data.error : `Không tạo được link (${res.status}).`,
    };
  } catch (error) {
    return { ok: false, source: 'error', reason: error instanceof Error ? error.message : 'Không kết nối được dịch vụ.' };
  }
}

export async function purchasePro(): Promise<PurchaseResult> {
  try {
    const purchase = await acquirePurchaseToken();
    if (!purchase) {
      return { ok: false, source: 'cancelled', reason: 'Người dùng đã huỷ hoặc cửa hàng không khả dụng.' };
    }

    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(apiUrl('/api/billing/verify'), {
      method: 'POST',
      headers,
      body: JSON.stringify(purchase),
    });
    const data = await response.json().catch(() => null);

    if (response.ok && data?.source === 'granted') {
      return {
        ok: true,
        source: 'granted',
        reason: data.reason ?? 'Đã nâng cấp Pro.',
        tier: data.tier,
        premiumExpiresAt: data.premiumExpiresAt,
      };
    }

    return {
      ok: false,
      source: data?.source ?? 'error',
      reason: typeof data?.reason === 'string' ? data.reason : `Xác minh thất bại (${response.status}).`,
    };
  } catch (error) {
    return {
      ok: false,
      source: 'error',
      reason: error instanceof Error ? error.message : 'Không kết nối được dịch vụ thanh toán.',
    };
  }
}
