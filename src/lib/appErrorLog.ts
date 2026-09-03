/* ═══ Nhật ký lỗi app — thứ trước đây bay thẳng vào hư không ═══
 *
 * Trước PR này, 25 chỗ `console.error` trong API chỉ in ra log Vercel rồi trôi:
 * không truy lại được, không đếm được, không biết lỗi nào đang lặp.
 *
 * GOM THEO VÂN TAY, KHÔNG NỐI THÊM MỖI LẦN. Một lỗi lặp 10.000 lần thì chỉ có
 * MỘT hàng với count=10000. Nối thêm mỗi lần là để một lỗi hỏng vòng lặp tự
 * viết đầy Firestore — cùng cái bẫy như ghi mọi request lúc bị tấn công.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

/** Vân tay ổn định: cùng chỗ + cùng loại lỗi = cùng một hàng. */
export function fingerprint(scope: string, message: string): string {
  const normalized = message
    .slice(0, 200)
    // Bỏ số và uid để "user abc123 not found" và "user xyz789 not found" gom chung.
    .replace(/[0-9a-f]{16,}/gi, '<id>')
    .replace(/\d+/g, '<n>')
    .trim()
    .toLowerCase();
  let h = 0;
  const raw = `${scope}|${normalized}`;
  for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  return `${scope.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}_${(h >>> 0).toString(36)}`;
}

export async function logAppError(scope: string, error: unknown, meta?: Record<string, unknown>): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? '').slice(0, 2000) : null;
    const id = fingerprint(scope, message);

    const db = getAdminDb();
    const ref = db.collection('app_errors').doc(id);

    /* Phải dùng transaction chỉ vì MỘT trường: firstSeenAt.
     * set(..., {merge:true}) sẽ ghi đè firstSeenAt ở MỌI lần lỗi tái diễn, làm
     * "lần đầu thấy" luôn bằng "lần cuối thấy" — mất hẳn thông tin lỗi này có
     * từ bao giờ, vốn là thứ đầu tiên cần biết khi truy một lỗi mới xuất hiện.
     * Firestore không có "chỉ ghi nếu chưa có" cho từng trường, nên phải đọc
     * trước trong transaction. */
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const isNew = !snap.exists;
      tx.set(
        ref,
        {
          scope,
          message: message.slice(0, 500),
          stack,
          meta: meta ?? null,
          count: FieldValue.increment(1),
          lastSeenAt: FieldValue.serverTimestamp(),
          ...(isNew
            ? { firstSeenAt: FieldValue.serverTimestamp(), resolved: false }
            : {}),
        },
        { merge: true },
      );
    });
  } catch {
    /* Nhật ký hỏng không được kéo theo request hỏng. */
  }
}
