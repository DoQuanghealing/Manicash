/* ═══ Dựng dữ liệu giả lập từ file JSON — thuần, không đụng store ═══ */

import type { SimFile, SimTxn } from './schema';

export interface BuiltTxn {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note: string;
  wallet: 'main';
  date: string;
  time: string;
  dateLabel: string;
  dateKey: string;
  method: 'cash' | 'transfer';
}

export interface BuildOptions {
  /** Dịch cả cụm sao cho ngày MỚI NHẤT trong file rơi vào hôm nay. */
  shiftToToday?: boolean;
  now?: Date;
}

const DAY_MS = 86_400_000;

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Trải một dòng giao dịch có `repeatUntil` thành từng ngày.
 * Không có `repeatUntil` thì trả về đúng một ngày.
 */
export function expandDates(t: SimTxn): string[] {
  if (!t.repeatUntil) return [t.date];
  const out: string[] = [];
  const end = parseDate(t.repeatUntil).getTime();
  // Trần 400 ngày: file ghi nhầm repeatUntil xa 10 năm sẽ dựng ~3.650 giao dịch
  // và treo trình duyệt. Thà cắt còn hơn đứng hình mà không hiểu vì sao.
  for (let d = parseDate(t.date).getTime(), i = 0; d <= end && i < 400; d += DAY_MS, i++) {
    out.push(dateKeyOf(new Date(d)));
  }
  return out;
}

/**
 * Mốc để dịch: ngày MUỘN NHẤT xuất hiện ở bất kỳ đâu trong file.
 * Trả `null` nếu file không có ngày nào.
 */
export function latestDateIn(file: SimFile): string | null {
  let latest: string | null = null;
  const bump = (s?: string) => {
    if (s && (latest === null || s > latest)) latest = s;
  };
  for (const t of file.transactions ?? []) {
    bump(t.date);
    bump(t.repeatUntil);
  }
  for (const k of file.tasks ?? []) {
    bump(k.start);
    bump(k.end);
  }
  // CỐ Ý bỏ qua goal.deadline: hạn mục tiêu thường ở tương lai xa (mua nhà 2030),
  // lấy nó làm mốc thì cả sổ sách bị kéo lùi nhiều năm.
  return latest;
}

/** Giờ rải đều trong ngày để danh sách không bị dồn cùng một mốc. */
function timeFor(index: number): string {
  const h = 7 + (index * 3) % 14; // 07:00 → 20:00
  const m = (index * 17) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface BuiltSimulation {
  transactions: BuiltTxn[];
  shiftDays: number;
  /** Ngày mới nhất sau khi dịch — để giao diện báo lại cho người dùng. */
  latestAfterShift: string | null;
}

/**
 * Dựng danh sách giao dịch.
 *
 * ⚠️ `id` phải theo đúng dạng `txn-<ms>-<rand>` vì bộ chỉ số hành vi moi mốc GHI
 * từ chính id (xem lib/behavior/usageMetrics.ts). Dùng dạng khác thì màn CRM đọc
 * ra "không tính được" cho toàn bộ dữ liệu demo.
 * Mốc ms đặt bằng thời điểm giao dịch + vài phút, để demo trông như người ghi ngay.
 */
export function buildSimulation(file: SimFile, opts: BuildOptions = {}): BuiltSimulation {
  const now = opts.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let shiftDays = 0;
  if (opts.shiftToToday !== false) {
    const latest = latestDateIn(file);
    if (latest) {
      shiftDays = Math.round((today.getTime() - parseDate(latest).getTime()) / DAY_MS);
    }
  }

  const transactions: BuiltTxn[] = [];
  let seq = 0;

  for (const t of file.transactions ?? []) {
    for (const rawKey of expandDates(t)) {
      const shifted = new Date(parseDate(rawKey).getTime() + shiftDays * DAY_MS);
      // Bỏ giao dịch bị dịch sang TƯƠNG LAI: sổ sách hiện khoản chi của ngày mai
      // là thứ khách xem sẽ thắc mắc ngay.
      if (shifted.getTime() > today.getTime()) continue;

      const time = t.time ?? timeFor(seq);
      const [hh, mm] = time.split(':').map(Number);
      const at = new Date(shifted);
      at.setHours(hh, mm, 0, 0);

      transactions.push({
        id: `txn-${at.getTime() + seq * 1000 + 300_000}-s${seq.toString(36)}`,
        type: t.type,
        amount: t.amount,
        categoryId: t.categoryId,
        note: t.note ?? '',
        wallet: 'main',
        date: at.toISOString(),
        time,
        dateLabel: '',
        dateKey: dateKeyOf(shifted),
        method: t.method ?? 'transfer',
      });
      seq++;
    }
  }

  transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

  const latest = latestDateIn(file);
  return {
    transactions,
    shiftDays,
    latestAfterShift: latest
      ? dateKeyOf(new Date(parseDate(latest).getTime() + shiftDays * DAY_MS))
      : null,
  };
}

/** Dịch một ngày lẻ theo cùng mốc dịch — dùng cho mục tiêu và nhiệm vụ. */
export function shiftDate(dateStr: string, shiftDays: number): string {
  return dateKeyOf(new Date(parseDate(dateStr).getTime() + shiftDays * DAY_MS));
}
