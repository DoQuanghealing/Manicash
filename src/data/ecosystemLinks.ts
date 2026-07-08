/* ═══ Hệ sinh thái ManiCash × DuongQuang Academy ═══
 * CHỈ là danh sách LINK (mở tab mới) — KHÔNG gọi API, KHÔNG đồng bộ dữ liệu, KHÔNG
 * đụng gì tới hệ Academy. An toàn tuyệt đối với ràng buộc "không chạm Academy".
 *
 * 👉 PO điền URL thật (khoá học / video cụ thể) vào FEATURED bên dưới khi có.
 * Trước khi có, các mục trỏ về trang chủ Academy.
 */

/** Tên miền gốc của Academy. Sửa 1 chỗ nếu đổi domain. */
export const ACADEMY_BASE = 'https://duongquang.academy';

export type EcosystemKind = 'video' | 'course' | 'site';

export interface EcosystemLink {
  id: string;
  kind: EcosystemKind;
  title: string;
  desc: string;
  /** URL đầy đủ. Để trống '' → dùng ACADEMY_BASE. */
  href: string;
  emoji: string;
}

/** Nội dung nổi bật dẫn sang Academy. PO thay href bằng link video/khoá thật. */
export const ECOSYSTEM_FEATURED: EcosystemLink[] = [
  {
    id: 'academy-home',
    kind: 'site',
    title: 'DuongQuang Academy',
    desc: 'Hệ sinh thái khoá học tài chính & phát triển bản thân.',
    href: '',
    emoji: '🎓',
  },
  {
    id: 'free-money-basics',
    kind: 'video',
    title: 'Video: Nền tảng quản lý tiền',
    desc: 'Bài học miễn phí mở đầu cho người mới bắt đầu.',
    href: '', // PO điền link video thật
    emoji: '🎬',
  },
  {
    id: 'debt-free',
    kind: 'video',
    title: 'Video: Lộ trình thoát nợ',
    desc: 'Các bước thoát nợ thực tế, áp dụng ngay.',
    href: '', // PO điền link video thật
    emoji: '🎬',
  },
];

/** Ghép href cuối (fallback về trang chủ Academy nếu chưa có link riêng). */
export function resolveEcosystemHref(link: EcosystemLink): string {
  return link.href.trim() || ACADEMY_BASE;
}
