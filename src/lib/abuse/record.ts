/* ═══ Ghi sự kiện lạm dụng + hồ sơ định danh xuống Firestore ═══
 *
 * CHỈ được gọi khi policy.shouldRecord() nói có — tức đúng lần vượt ngưỡng.
 * Đường nóng nằm ở Redis, chỗ này là ngoại lệ nên bình thường gần như im.
 *
 * Hai kho, hai cách lớn khác nhau:
 *   abuse_events  — NỐI THÊM, lớn theo số lần bị đánh. Cron dọn sau 90 ngày.
 *   abuse_subjects — GHI ĐÈ 1 hàng / 1 định danh. Lớn theo SỐ NGƯỜI, không theo
 *                    số request. Đây là chỗ giữ trạng thái khoá cho bền.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { AbuseVerdict } from './policy';

export interface AbuseEventInput {
  /** 'uid:xxx' hoặc 'ip:1.2.3.4' — băm sẵn ở tầng gọi nếu cần. */
  subject: string;
  kind: string;
  verdict: AbuseVerdict;
  count: number;
  path?: string | null;
}

export async function recordAbuse(input: AbuseEventInput): Promise<void> {
  try {
    const db = getAdminDb();
    const now = FieldValue.serverTimestamp();

    const batch = db.batch();

    batch.set(db.collection('abuse_events').doc(), {
      subject: input.subject,
      kind: input.kind,
      verdict: input.verdict,
      count: input.count,
      path: input.path ?? null,
      createdAt: now,
    });

    /* Hàng hồ sơ: GHI ĐÈ theo định danh. `strikes` cộng dồn bằng increment để
     * hai request song song không đè mất lượt của nhau. */
    batch.set(
      db.collection('abuse_subjects').doc(encodeURIComponent(input.subject)),
      {
        subject: input.subject,
        status: input.verdict === 'lock' ? 'locked' : 'watch',
        lastKind: input.kind,
        lastCount: input.count,
        strikes: FieldValue.increment(1),
        lastSeenAt: now,
        ...(input.verdict === 'lock' ? { lockedAt: now } : {}),
      },
      { merge: true },
    );

    await batch.commit();
  } catch {
    /* Ghi nhật ký hỏng thì KHÔNG được làm hỏng request của người dùng. */
  }
}

/** Trạng thái hiện tại của một định danh — dùng để chặn ở cửa vào. */
export async function getSubjectStatus(subject: string): Promise<'normal' | 'watch' | 'locked'> {
  try {
    const snap = await getAdminDb()
      .collection('abuse_subjects')
      .doc(encodeURIComponent(subject))
      .get();
    const s = snap.data()?.status;
    return s === 'locked' || s === 'watch' ? s : 'normal';
  } catch {
    // Đọc hỏng thì cho qua: hạ tầng trục trặc không được biến thành chặn người dùng.
    return 'normal';
  }
}
