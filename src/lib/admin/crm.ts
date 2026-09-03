/* ═══ Admin M5 — CRM hành vi (đọc metric_snapshots) ═══
 *
 * Nguồn: collection `metric_snapshots`, mỗi user mỗi ngày một hàng, do
 * MetricSnapshotCollector gửi lên và server chỉ ghi khi user ĐÃ ĐỒNG Ý.
 *
 * ⚠️ Vì vậy CRM chỉ thấy người đã bật đóng góp dữ liệu. Người chưa bật là KHÔNG
 * CÓ HÀNG, không phải "hành vi rỗng" — hai thứ đó khác nhau và giao diện phải
 * nói rõ, nếu không sẽ đọc nhầm thành "người này không dùng app".
 *
 * ⚠️ Ở đây KHÔNG có số tiền. Xem chú thích `scalars` trong MetricSnapshotCollector.
 */
import { getAdminDb } from '@/lib/firebaseAdmin';

export interface CrmUsage {
  daysLogged7: number | null;
  daysLogged30: number | null;
  currentStreak: number | null;
  longestGapDays: number | null;
  returnedAfterGap: boolean | null;
  medianLagMinutes: number | null;
  sameDayRate: number | null;
  promptRate: number | null;
  lagSampleSize: number | null;
  featureDepth: number | null;
  features: Record<string, boolean> | null;
}

export interface CrmRow {
  uid: string;
  email: string | null;
  dateLocal: string;
  rank: string | null;
  xp: number | null;
  streak: number | null;
  usage: CrmUsage | null;
  /** Tín hiệu để quản gia mở lời — tính lại phía server cho nhất quán. */
  signal: string | null;
  daysSinceSnapshot: number;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

function readUsage(raw: unknown): CrmUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  return {
    daysLogged7: num(u.daysLogged7),
    daysLogged30: num(u.daysLogged30),
    currentStreak: num(u.currentStreak),
    longestGapDays: num(u.longestGapDays),
    returnedAfterGap: bool(u.returnedAfterGap),
    medianLagMinutes: num(u.medianLagMinutes),
    sameDayRate: num(u.sameDayRate),
    promptRate: num(u.promptRate),
    lagSampleSize: num(u.lagSampleSize),
    featureDepth: num(u.featureDepth),
    features:
      u.features && typeof u.features === 'object'
        ? (u.features as Record<string, boolean>)
        : null,
  };
}

/** Tín hiệu tư vấn — giữ đồng bộ với readUsageSignal ở lib/behavior. */
function signalOf(u: CrmUsage | null): string | null {
  if (!u || u.daysLogged30 === null) return null;
  if (u.daysLogged30 < 3) return 'chua_du_du_lieu';
  if (u.daysLogged7 === 0) return 'dang_troi';
  if (u.returnedAfterGap) return 'da_quay_lai';
  if (u.sameDayRate !== null && u.sameDayRate < 50 && (u.lagSampleSize ?? 0) >= 5) return 'hay_don_cuoi_ngay';
  if ((u.featureDepth ?? 0) <= 1) return 'dung_nong';
  return 'ghi_deu';
}

function daysBetween(dateLocal: string, now: Date): number {
  const [y, m, d] = dateLocal.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const then = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000));
}

/**
 * Bản ghi MỚI NHẤT của mỗi user.
 *
 * Firestore không có DISTINCT ON, nên lấy `limit` bản gần nhất theo ngày rồi gom
 * ở bộ nhớ. Chấp nhận được vì mỗi user chỉ một hàng/ngày: quét 500 hàng là phủ
 * khoảng 500 lượt-người-ngày gần nhất. Khi lượng người tăng thì phải đổi sang
 * ghi thêm một document "mới nhất" riêng cho mỗi user — ĐỪNG nâng limit lên vô hạn.
 */
export async function listBehaviorRows(limit = 500): Promise<{ rows: CrmRow[]; scanned: number }> {
  const db = getAdminDb();
  const snap = await db
    .collection('metric_snapshots')
    .orderBy('dateLocal', 'desc')
    .limit(Math.min(Math.max(limit, 1), 1000))
    .get();

  const now = new Date();
  const latest = new Map<string, CrmRow>();

  for (const doc of snap.docs) {
    const d = doc.data() ?? {};
    const uid = typeof d.uid === 'string' ? d.uid : null;
    const dateLocal = typeof d.dateLocal === 'string' ? d.dateLocal : null;
    if (!uid || !dateLocal) continue;
    if (latest.has(uid)) continue; // đã sắp giảm dần nên hàng đầu tiên là mới nhất

    const behavior = (d.behavior ?? {}) as Record<string, unknown>;
    const usage = readUsage(behavior.usage);
    latest.set(uid, {
      uid,
      email: null, // ghép ở tầng route, tránh đọc Auth trong vòng lặp
      dateLocal,
      rank: typeof behavior.rank === 'string' ? behavior.rank : null,
      xp: num(behavior.xp),
      streak: num(behavior.streak),
      usage,
      signal: signalOf(usage),
      daysSinceSnapshot: daysBetween(dateLocal, now),
    });
  }

  return { rows: [...latest.values()], scanned: snap.size };
}
