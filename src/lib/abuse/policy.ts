/* ═══ Luật chống lạm dụng — thuần, không đụng mạng ═══
 *
 * TRIẾT LÝ (mượn từ repo elearning, đã chạy thật):
 * Mạng lag thì khách bấm nhiều lần, tải lại 3-5 lần. ĐÓ KHÔNG PHẢI TẤN CÔNG.
 * Vì vậy có ba mức, và mức KHOÁ chỉ dành cho tốc độ mà tay người không đạt tới:
 *
 *   bình thường → theo dõi (ghi lại, chưa làm gì) → khoá (chỉ mức bot)
 *
 * Khoá nhầm một người dùng thật tốn hơn nhiều so với bỏ lọt một kẻ phá: người
 * bị khoá oan sẽ bỏ app và kể lại, còn kẻ phá thì lần sau vẫn chặn được.
 */

export type AbuseVerdict = 'ok' | 'watch' | 'lock';

export interface AbuseRule {
  /** Cửa sổ đếm, tính bằng giây. */
  windowSec: number;
  /** Vượt mức này thì ghi nhận để theo dõi. */
  watchAt: number;
  /** Vượt mức này thì khoá — đặt ở tốc độ BOT, không phải tốc độ người sốt ruột. */
  lockAt: number;
}

/**
 * Ngưỡng theo loại đường.
 *
 * `ai` thấp hơn hẳn vì mỗi lượt gọi tốn tiền thật cho LLM — ở đây kẻ lạm dụng
 * đốt ví mình chứ không chỉ tốn CPU.
 */
export const RULES: Record<string, AbuseRule> = {
  // Đường API thường: người sốt ruột bấm ~1-2 lần/giây là cùng.
  api: { windowSec: 60, watchAt: 120, lockAt: 600 },
  // Đường gọi AI: tốn tiền thật mỗi lượt.
  ai: { windowSec: 60, watchAt: 15, lockAt: 40 },
  // Đăng nhập / thanh toán: dò mật khẩu và thử thẻ đều nằm ở đây.
  auth: { windowSec: 300, watchAt: 10, lockAt: 30 },
};

export function ruleFor(kind: string): AbuseRule {
  return RULES[kind] ?? RULES.api;
}

/** Xếp mức từ số đếm. Đếm hỏng (0) thì luôn là 'ok' — xem chú thích incrementCounter. */
export function judge(count: number, rule: AbuseRule): AbuseVerdict {
  if (count >= rule.lockAt) return 'lock';
  if (count >= rule.watchAt) return 'watch';
  return 'ok';
}

/**
 * Có nên GHI sự kiện xuống Firestore không.
 *
 * Đây là chốt chặn giữ cho kho không phình: đường nóng đếm trong Redis, còn
 * Firestore CHỈ nhận khi đã vượt ngưỡng. Lúc bình thường gần như không ghi gì.
 *
 * Thêm nữa: chỉ ghi ở đúng lần VƯỢT NGƯỠNG, không ghi mọi request sau đó. Kẻ
 * đánh 10.000 lượt/phút mà ghi hết là mình tự tay biến cuộc tấn công thành hoá
 * đơn Firestore — đúng thứ họ muốn.
 */
export function shouldRecord(count: number, rule: AbuseRule): boolean {
  return count === rule.watchAt || count === rule.lockAt;
}

/** Số ngày giữ dữ liệu — quá hạn thì cron dọn. */
export const RETENTION_DAYS = 90;
