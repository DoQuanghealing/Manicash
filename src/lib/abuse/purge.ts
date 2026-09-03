/* ═══ Dọn dữ liệu quá hạn — thứ giữ cho kho không phình theo thời gian ═══
 *
 * Học cách phân loại của repo elearning: KHÔNG xoá sạch theo tuổi, mà giữ lại
 * đúng thứ còn giá trị:
 *   abuse_events    → xoá theo tuổi. Chỉ là nhật ký, hết hạn là hết việc.
 *   abuse_subjects  → xoá hàng 'watch' đã im lâu; GIỮ 'locked' vô thời hạn.
 *                     Xoá hàng đang khoá là tự mở cửa lại cho kẻ đã bị chặn.
 *   app_errors      → xoá lỗi ĐÃ đánh dấu xong. Lỗi chưa xử lý thì giữ, dù cũ —
 *                     cũ mà chưa sửa nghĩa là còn nợ, không phải hết hạn.
 *   metric_snapshots→ xoá theo tuổi. CRM chỉ cần bản gần đây.
 *
 * Bộ đếm nóng KHÔNG có ở đây: nó nằm trong Redis với TTL, tự biến mất.
 */
import { getAdminDb } from '@/lib/firebaseAdmin';
import { RETENTION_DAYS } from './policy';

/** Firestore giới hạn 500 thao tác/batch — chia mẻ, đừng gửi một cục. */
const BATCH = 400;

async function deleteQuery(
  build: (db: FirebaseFirestore.Firestore) => FirebaseFirestore.Query,
): Promise<number> {
  const db = getAdminDb();
  let removed = 0;
  // Lặp tới khi hết: mỗi vòng chỉ lấy BATCH hàng để không nạp cả collection vào RAM.
  for (let round = 0; round < 25; round++) {
    const snap = await build(db).limit(BATCH).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    removed += snap.size;
    if (snap.size < BATCH) break;
  }
  return removed;
}

export interface PurgeResult {
  abuseEvents: number;
  abuseSubjects: number;
  appErrors: number;
  snapshots: number;
}

export async function purgeExpired(now = new Date()): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
  const cutoffDateLocal = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  const abuseEvents = await deleteQuery((db) =>
    db.collection('abuse_events').where('createdAt', '<', cutoff),
  );

  // GIỮ 'locked'. Chỉ dọn hàng đang theo dõi mà đã im lâu.
  const abuseSubjects = await deleteQuery((db) =>
    db.collection('abuse_subjects').where('status', '==', 'watch').where('lastSeenAt', '<', cutoff),
  );

  // GIỮ lỗi chưa xử lý, dù cũ.
  const appErrors = await deleteQuery((db) =>
    db.collection('app_errors').where('resolved', '==', true).where('lastSeenAt', '<', cutoff),
  );

  const snapshots = await deleteQuery((db) =>
    db.collection('metric_snapshots').where('dateLocal', '<', cutoffDateLocal),
  );

  return { abuseEvents, abuseSubjects, appErrors, snapshots };
}
