/* ═══ PRISM (Lõi Kim Cương) — Lớp giọng Lord Diamond (P1) ═══
 * Handler deterministic đã xưng "ngài" sẵn; lớp này chỉ thêm một câu mở đầu
 * ngắn theo phong cách quản gia để câu trả lời OFFLINE vẫn có hồn, không khô
 * như tra cứu. Xoay vòng nhẹ qua các lượt để không lặp lại.
 *
 * KHÔNG dùng cho báo cáo CFO / tư vấn sâu (những thứ đó đi qua LLM ở server).
 */

const LEAD_INS = [
  'Vâng, thưa ngài. 💎',
  'Để Lord Diamond rà sổ giúp ngài. 📒',
  'Tôi xem ngay đây ạ. ✨',
  'Thưa ngài, đây ạ. 🤵',
  'Sổ sách của ngài đây. 📊',
];

/**
 * Khoác một lead-in quản gia ngắn trước nội dung số liệu deterministic.
 * Chọn lead-in DETERMINISTIC theo độ dài message (cùng câu -> cùng lead-in,
 * không phụ thuộc thứ tự gọi -> không rò state giữa các phiên/hội thoại).
 */
export function decorateWithVoice(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  const lead = LEAD_INS[trimmed.length % LEAD_INS.length];
  return `${lead}\n\n${trimmed}`;
}
