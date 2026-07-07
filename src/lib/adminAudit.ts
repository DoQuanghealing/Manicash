import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { AdminIdentity } from '@/lib/requireAdmin';

/**
 * Ghi lại mọi hành động admin (ai · làm gì · lúc nào) vào `admin_audit`.
 * Best-effort — không chặn luồng chính nếu ghi lỗi. Dùng cho bảo mật + R&D.
 */
export async function logAdminAction(
  admin: AdminIdentity,
  action: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await getAdminDb().collection('admin_audit').add({
      uid: admin.uid,
      email: admin.email,
      action,
      detail: detail ?? null,
      at: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[adminAudit] write failed:', error);
  }
}
