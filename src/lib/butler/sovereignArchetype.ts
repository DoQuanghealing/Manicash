/* ═══ Phú Vương — Map kỹ năng khảo sát → nhóm nghề (teaser Bước 2) ═══
 * Tự chứa, KHÔNG phụ thuộc dữ liệu tài chính → dùng cho lời mời nâng cấp (self-contained).
 * Nhãn nhóm GIỮ ĐỒNG BỘ với capacityEngine (Chuyên gia Số / Nhà Khai vấn / Sáng tạo Nội dung /
 * Kỹ sư Vận hành) để người dùng không thấy lệch khi đo năng lực đầy đủ trong chat.
 *
 * ⚠️ TUYỆT ĐỐI KHÔNG số thu nhập ở teaser — chỉ nhóm nghề + điểm mạnh (xem BUTLER_PHU_VUONG_SCRIPT §3).
 */

export interface SovereignArchetype {
  label: string;
  /** Điểm mạnh 1 câu — thay cho con số thu nhập. */
  strength: string;
}

/** Nhóm mặc định khi chưa khai kỹ năng — vẫn tôn trọng, không "chấm rớt". */
const DEFAULT_ARCHETYPE: SovereignArchetype = {
  label: 'Người Khai Phá',
  strength: 'nền tảng kỷ luật đang lên — tiềm năng còn rộng mở',
};

/** id kỹ năng (từ SKILL_OPTIONS) → nhóm nghề nghiêng về. */
const SKILL_TO_GROUP: Record<string, string> = {
  coding: 'automation',
  ops: 'automation',
  finance: 'expert',
  teaching: 'coach',
  counsel: 'coach',
  writing: 'creator',
  design: 'creator',
  video: 'creator',
  marketing: 'creator',
  sales: 'coach',
  language: 'expert',
  handcraft: 'creator',
};

const GROUP_META: Record<string, SovereignArchetype> = {
  automation: { label: 'Kỹ sư Vận hành', strength: 'tư duy hệ thống — biến quy trình thành cỗ máy' },
  expert: { label: 'Chuyên gia Số', strength: 'chiều sâu chuyên môn — đóng gói thành sản phẩm số' },
  coach: { label: 'Nhà Khai vấn', strength: 'thấu cảm & dẫn dắt — giúp người khác đi qua tiền bạc' },
  creator: { label: 'Sáng tạo Nội dung', strength: 'sức sáng tạo & lan tỏa — nhân bản sức ảnh hưởng' },
};

/** Chọn nhóm nghề nghiêng về nhất từ danh sách kỹ năng đã chọn (đa số phiếu). */
export function archetypeFromSkills(skills: string[]): SovereignArchetype {
  if (!skills || skills.length === 0) return DEFAULT_ARCHETYPE;
  const tally: Record<string, number> = {};
  for (const s of skills) {
    const g = SKILL_TO_GROUP[s];
    if (g) tally[g] = (tally[g] ?? 0) + 1;
  }
  let best: string | null = null;
  let bestN = 0;
  for (const g of Object.keys(tally)) {
    if (tally[g] > bestN) {
      best = g;
      bestN = tally[g];
    }
  }
  return best ? GROUP_META[best] : DEFAULT_ARCHETYPE;
}
