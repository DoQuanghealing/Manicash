/* ═══ Vibed Copy — Text variants theo vibe ═══
 *
 * Single source of truth cho các text có nhiều phiên bản theo nhóm tuổi.
 * Use: getCopy('greeting.morning', vibe) → string
 */

import type { AppVibe } from '@/lib/ageGroup';

type CopyMap = Record<AppVibe, string>;

/** Lookup table — mỗi key có 3 phiên bản. */
const COPY: Record<string, CopyMap> = {
  // ── Greeting (header) ───────────────────────────────────────
  'greeting.morning': {
    young:   'Sáng rồi ní, dậy chạy đi',
    pro:     'Chào buổi sáng',
    classic: 'Một ngày mới an lành',
  },
  'greeting.afternoon': {
    young:   'Chiều rồi, đói chưa?',
    pro:     'Chào buổi chiều',
    classic: 'Chiều thư thái nhé',
  },
  'greeting.evening': {
    young:   'Tối rồi, chốt đơn coi nào',
    pro:     'Chào buổi tối',
    classic: 'Buổi tối ấm áp',
  },

  // ── Wellness (overview card) ────────────────────────────────
  'wellness.morning': {
    young:   '🌅 Sáng rồi! Hít thở vài hơi rồi quẩy thôi ✨',
    pro:     '🌅 Chào ngày mới! Hít thở sâu 3 phút trước khi bắt đầu nhé.',
    classic: '🌅 Bình minh đến. Một ly trà ấm rồi bắt đầu nhé.',
  },
  'wellness.afternoon': {
    young:   '🚶 Đứng dậy đi vài bước đi, không sẽ thành "deadcat" mất',
    pro:     '🚶 Chiều rồi! Đi bộ 15 phút để giảm stress và tái tạo năng lượng.',
    classic: '🚶 Vận động nhẹ buổi chiều giúp tinh thần thư thái hơn.',
  },
  'wellness.late_afternoon': {
    young:   '🏊 Tập thể dục đi rồi tối hú hí — sức bền là tiền đó',
    pro:     '🏊 Đi bơi hoặc tập thể dục buổi chiều để có năng lượng cho buổi tối!',
    classic: '🏊 Vận động nhẹ nhàng giúp ngủ ngon hơn về đêm.',
  },
  'wellness.evening': {
    young:   '🍽️ Ăn nhẹ thôi, no quá ngủ không ngon đâu nha',
    pro:     '🍽️ Buổi tối thư giãn. Ăn nhẹ và nghỉ ngơi cho ngày mai hiệu quả hơn.',
    classic: '🍽️ Bữa tối cùng gia đình là khoản đầu tư đáng giá nhất.',
  },
  'wellness.night': {
    young:   '🌙 11h rồi ní, không lại "team lười dậy" ngày mai đó',
    pro:     '🌙 Ngủ trước 11h để cơ thể phục hồi tốt nhất. Ngày mai sẽ tốt hơn!',
    classic: '🌙 Đêm yên. Nghỉ ngơi sớm để mai tỉnh táo hơn nhé.',
  },

  // ── Mission empty state ─────────────────────────────────────
  'mission.all_done_today': {
    young:   '🎉 Quẩy đủ rồi, mai quay lại nhé!',
    pro:     '🎉 Hoàn thành xuất sắc. Hẹn lại bạn ngày mai!',
    classic: '🎉 Trọn vẹn 1 ngày. Mai mình tiếp tục nhé.',
  },
};

/**
 * Lấy copy theo key + vibe. Fallback về 'pro' nếu key thiếu variant cho vibe đó.
 */
export function getCopy(key: string, vibe: AppVibe): string {
  const map = COPY[key];
  if (!map) return key; // fallback hiển thị key nếu thiếu
  return map[vibe] ?? map.pro ?? '';
}
