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

let turn = 0;

/**
 * Khoác một lead-in quản gia ngắn trước nội dung số liệu deterministic.
 * Giữ nguyên markdown phía sau; chỉ thêm 1 dòng + ngắt đoạn.
 */
export function decorateWithVoice(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  const lead = LEAD_INS[turn % LEAD_INS.length];
  turn += 1;
  return `${lead}\n\n${trimmed}`;
}
