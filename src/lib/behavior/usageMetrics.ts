/* ═══ Chỉ số HÀNH VI DÙNG APP — thuần, không đụng store ═══
 *
 * Trả lời ba câu PO chốt, KHÔNG đụng tới số tiền:
 *   1. Có ghi chép đều không?         → đều đặn, chuỗi ngày, bỏ bê rồi quay lại
 *   2. Ghi ngay hay dồn cuối ngày?    → khoảng cách từ lúc tiêu tới lúc ghi
 *   3. Dùng nông hay sâu?             → chạm bao nhiêu tính năng
 *
 * ⚠️ CỐ Ý KHÔNG có số tiền, tên khoản, ghi chú. Đây là dữ liệu hành vi để quản
 * gia tư vấn và để CRM nhìn, không phải bản sao sổ sách. Thêm số tiền vào đây
 * là biến một tệp hành vi thành một tệp tài chính — khác hẳn về mức nhạy cảm.
 *
 * ⚠️ "Ghi lúc nào" LẤY TỪ ĐÂU: Transaction không có trường recordedAt, nhưng id
 * sinh theo `txn-${Date.now()}-${rand}` nên chính id đã mang mốc ghi. Nhờ vậy
 * tính được cho cả dữ liệu cũ, không phải đổi schema hay chạy migration.
 * Id không đúng dạng đó (giao dịch seed, bản rất cũ) thì BỎ QUA, không đoán.
 */

export interface UsageBehaviorInput {
  /** Chỉ cần id + dateKey + date. KHÔNG nhận amount — xem chú thích đầu file. */
  transactions: { id: string; dateKey: string; date: string }[];
  /** Tính năng đã chạm — do phía gọi tổng hợp từ store. */
  features: UsageFeatures;
  now?: Date;
}

/* Chỉ gồm tính năng suy được từ dữ liệu ĐÃ LƯU BỀN.
 * Cố ý KHÔNG có 'đã mở báo cáo CFO': tín hiệu đó nằm ở usePageVisitStore vốn
 * không persist, tải lại trang là mất. Để một trường luôn false thì mọi người
 * đều bị đọc thành "dùng nông" — thà thiếu còn hơn sai. */
export interface UsageFeatures {
  goals: boolean;
  chat: boolean;
  tasks: boolean;
  bills: boolean;
}

export interface UsageBehavior {
  daysLogged7: number;
  daysLogged30: number;
  currentStreak: number;
  longestGapDays: number;
  returnedAfterGap: boolean;
  medianLagMinutes: number | null;
  sameDayRate: number | null;
  promptRate: number | null;
  lagSampleSize: number;
  features: UsageFeatures;
  featureDepth: number;
}

const DAY_MS = 86_400_000;
/** Bỏ bê từ 3 ngày trở lên mới coi là "đứt", dưới đó là nhịp sinh hoạt bình thường. */
export const GAP_DAYS = 3;
/** Ghi trong 2 giờ coi là "ghi ngay". */
const PROMPT_WINDOW_MIN = 120;

/** Mốc GHI, moi từ id. `null` nếu id không phải dạng sinh tự động. */
export function parseRecordedAt(id: string): number | null {
  const m = /^txn-(\d{10,16})-/.exec(id);
  if (!m) return null;
  const ms = Number(m[1]);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Dựng hồ sơ hành vi.
 *
 * Dùng TRUNG VỊ chứ không phải trung bình cho khoảng cách ghi: một lần nhập bù
 * giao dịch từ tháng trước là đủ kéo trung bình lên hàng nghìn phút và bôi đen
 * cả hồ sơ của người vốn ghi rất chăm. Trung vị không bị một điểm lạ lôi đi.
 */
export function buildUsageBehavior(input: UsageBehaviorInput): UsageBehavior {
  const now = input.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── 1. Đều đặn ──
  const keys = new Set<string>();
  for (const t of input.transactions) if (t.dateKey) keys.add(t.dateKey);

  let daysLogged7 = 0;
  let daysLogged30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    if (keys.has(dateKeyOf(d))) {
      daysLogged30++;
      if (i < 7) daysLogged7++;
    }
  }

  // Chuỗi tính từ HÔM NAY; chưa ghi hôm nay thì cho phép bắt đầu từ hôm qua —
  // không thì cả ngày hôm nay chuỗi hiện 0 và người dùng tưởng mất chuỗi.
  let currentStreak = 0;
  const startOffset = keys.has(dateKeyOf(today)) ? 0 : 1;
  for (let i = startOffset; i < 400; i++) {
    if (!keys.has(dateKeyOf(new Date(today.getTime() - i * DAY_MS)))) break;
    currentStreak++;
  }

  /* Chỉ tính đứt quãng TỪ NGÀY GHI ĐẦU TIÊN trở đi.
   * Quét trọn 30 ngày là sai: người mới dùng app 10 ngày liên tục sẽ có 20 ngày
   * "trống" phía trước — vốn là lúc họ CHƯA BIẾT tới app — và bị gắn nhãn "đã
   * bỏ bê rồi quay lại". Test đã bắt đúng ca này. */
  let oldestLogged = -1;
  for (let i = 29; i >= 0; i--) {
    if (keys.has(dateKeyOf(new Date(today.getTime() - i * DAY_MS)))) {
      oldestLogged = i;
      break;
    }
  }

  let longestGapDays = 0;
  let run = 0;
  for (let i = oldestLogged; i >= 0; i--) {
    if (i < 0) break;
    if (keys.has(dateKeyOf(new Date(today.getTime() - i * DAY_MS)))) {
      longestGapDays = Math.max(longestGapDays, run);
      run = 0;
    } else {
      run++;
    }
  }
  longestGapDays = Math.max(longestGapDays, run);
  // Quay lại = có đứt quãng dài, MÀ gần đây vẫn ghi. Đứt rồi im luôn thì không phải quay lại.
  const returnedAfterGap = longestGapDays >= GAP_DAYS && daysLogged7 > 0;

  // ── 2. Ghi ngay hay dồn ──
  const lags: number[] = [];
  let sameDay = 0;
  let prompt = 0;
  for (const t of input.transactions) {
    const recordedAt = parseRecordedAt(t.id);
    if (recordedAt === null || !t.date) continue;
    const happenedAt = new Date(t.date).getTime();
    if (!Number.isFinite(happenedAt)) continue;
    // Ghi TRƯỚC lúc tiêu (ghi kế hoạch) thì không phải "trễ" — kẹp về 0.
    const lagMin = Math.max(0, Math.round((recordedAt - happenedAt) / 60_000));
    lags.push(lagMin);
    if (dateKeyOf(new Date(recordedAt)) === t.dateKey) sameDay++;
    if (lagMin <= PROMPT_WINDOW_MIN) prompt++;
  }
  const n = lags.length;
  const pct = (x: number) => Math.round((x / n) * 1000) / 10;

  // ── 3. Dùng nông hay sâu ──
  const f = input.features;
  const featureDepth = [f.goals, f.chat, f.tasks, f.bills].filter(Boolean).length;

  return {
    daysLogged7,
    daysLogged30,
    currentStreak,
    longestGapDays,
    returnedAfterGap,
    medianLagMinutes: median(lags),
    sameDayRate: n ? pct(sameDay) : null,
    promptRate: n ? pct(prompt) : null,
    lagSampleSize: n,
    features: f,
    featureDepth,
  };
}

/* ─────────────────────────── Đọc thành lời khuyên ─────────────────────────── */

export type UsageSignal =
  | 'chua_du_du_lieu'
  | 'ghi_deu'
  | 'dang_troi'
  | 'da_quay_lai'
  | 'hay_don_cuoi_ngay'
  | 'dung_nong';

/**
 * Một tín hiệu DUY NHẤT để quản gia mở lời — cố ý không trả về danh sách.
 * Nói một điều đúng lúc thì người ta nghe; nói bốn điều cùng lúc thì thành cằn
 * nhằn và người ta tắt thông báo.
 *
 * Thứ tự ưu tiên là thứ tự khẩn: sắp mất người dùng > vừa kéo lại được > chất
 * lượng số liệu > độ sâu > khen.
 */
export function readUsageSignal(b: UsageBehavior): UsageSignal {
  if (b.daysLogged30 < 3) return 'chua_du_du_lieu';
  if (b.daysLogged7 === 0) return 'dang_troi';
  if (b.returnedAfterGap) return 'da_quay_lai';
  if (b.sameDayRate !== null && b.sameDayRate < 50 && b.lagSampleSize >= 5) return 'hay_don_cuoi_ngay';
  if (b.featureDepth <= 1) return 'dung_nong';
  return 'ghi_deu';
}
