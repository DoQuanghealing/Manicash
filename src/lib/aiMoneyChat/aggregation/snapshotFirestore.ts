/* ═══ AI Money Chat — Snapshot Firestore fallback (SERVER-ONLY) ═══
 * Đường này chỉ chạy khi KHÔNG có clientSnapshot (vd webhook/cron phía server).
 * Tách khỏi snapshotBuilder.ts + chỉ nạp qua `await import()` sau cổng
 * `typeof window === 'undefined'` để firebase-admin không lọt vào bundle client.
 *
 * Sau khi bỏ mô hình core/finance (không còn sổ cái trên Firestore), server không
 * còn nguồn số dư để dựng snapshot → trả snapshot rỗng kèm cảnh báo. PRISM ở client
 * luôn gửi clientSnapshot nên hầu như không bao giờ tới đây.
 */
import type { MonthlyFinancialSnapshot } from './types';
import { emptySnapshot } from './snapshotBuilder';

export async function buildFromFirestore(
  uid: string,
  monthKey: string,
  now: Date,
): Promise<MonthlyFinancialSnapshot> {
  return emptySnapshot(uid, monthKey, now, [
    'Phiên server chưa có dữ liệu — gửi clientSnapshot để có phân tích đầy đủ.',
  ]);
}
