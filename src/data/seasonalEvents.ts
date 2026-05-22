/* ═══ Seasonal Events — Sự kiện theo lịch ═══
 *
 * Mỗi event có 3-6 chương quest tuyến tính. Hoàn thành chương N mở chương N+1.
 * Final chapter unlock theme limited + eLearning content.
 *
 * Engine: chỉ 1 event active tại 1 thời điểm (so today với startDate/endDate).
 * Khi không có event nào active → banner ẩn.
 *
 * Để test/demo: có thể đổi startDate/endDate của event muốn xem.
 */

export type SeasonalMetric =
  | 'event_saved'           // VND tiết kiệm từ khi event start
  | 'event_resist'          // số lần resist từ khi event start
  | 'event_income_logged'   // số khoản thu nhập ghi từ khi event start
  | 'event_task_completed'  // earning task hoàn thành từ khi event start
  | 'event_app_days';       // số ngày unique mở app từ khi event start

export interface SeasonalChapter {
  id: string;
  order: number;        // 1..N
  title: string;
  scenario: string;     // tình huống, không mệnh lệnh
  hint: string;
  icon: string;
  metric: SeasonalMetric;
  target: number;
  xpReward: number;
  rewardItemIds?: string[];
}

export interface SeasonalEvent {
  id: string;
  name: string;
  subtitle: string;     // mô tả ngắn dưới tên
  icon: string;         // hero icon
  themeColor: string;   // accent CSS color
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  chapters: SeasonalChapter[];
  /** Reward cuối cùng khi hoàn thành tất cả chương — limited cosmetic + eLearning. */
  finalRewardItemIds: string[];
  finalRewardLabel: string;
}

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  // ═══ EVENT 1: Hè 2026 — Săn Tài Lộc Mùa Hè ═══
  {
    id: 'event-summer-2026',
    name: 'Hè Vàng 2026',
    subtitle: 'Săn tài lộc mùa nóng — Tận dụng thời gian rỗi để bứt phá',
    icon: '☀️',
    themeColor: '#F97316',
    startDate: '2026-05-01',
    endDate: '2026-08-31',
    chapters: [
      {
        id: 'summer-c1',
        order: 1,
        title: 'Chương 1: Khởi động hè',
        scenario:
          'Mùa hè là thời điểm "ngủ đông" của nhiều người. Nhưng người làm chủ tài chính dùng hè để bứt phá. Mở app 5 ngày để cam kết.',
        hint: 'Mở app mỗi ngày — streak tự đếm',
        icon: '🌅',
        metric: 'event_app_days',
        target: 5,
        xpReward: 150,
        rewardItemIds: ['theme-emerald'],
      },
      {
        id: 'summer-c2',
        order: 2,
        title: 'Chương 2: Cày Hè',
        scenario:
          'Hè rảnh = cơ hội kiếm thêm. Freelance, gia sư, bán đồ cũ. Hoàn thành 2 nhiệm vụ kiếm tiền để mở khóa kho báu.',
        hint: 'Tab Tiền → Nhiệm vụ kiếm tiền → tạo + hoàn thành',
        icon: '⚒️',
        metric: 'event_task_completed',
        target: 2,
        xpReward: 250,
        rewardItemIds: ['elearning-vitien'],
      },
      {
        id: 'summer-c3',
        order: 3,
        title: 'Chương 3: Tích Lũy',
        scenario:
          'Tiền kiếm xong đừng tiêu hết. Tiết kiệm 1tr vào các quỹ để chuẩn bị cho mùa thu (thường nhiều chi phí: tựu trường, lễ).',
        hint: 'Mở giao dịch transfer → split vào quỹ',
        icon: '🏦',
        metric: 'event_saved',
        target: 1_000_000,
        xpReward: 300,
      },
      {
        id: 'summer-c4',
        order: 4,
        title: 'Chương 4: Kỷ Luật Hè',
        scenario:
          'Hè dễ chi vào ăn uống, du lịch, hẹn hò. Kiềm chế 3 lần chi tiêu impulse để chứng minh bản lĩnh.',
        hint: 'Khi sắp tiêu — bấm "Kiềm chế" thay vì "Ghi chi"',
        icon: '🛡️',
        metric: 'event_resist',
        target: 3,
        xpReward: 350,
      },
    ],
    finalRewardItemIds: ['title-saver', 'effect-coinrain', 'elearning-banlam'],
    finalRewardLabel: 'Bộ Mùa Hè — Title "Thợ Săn Tiết Kiệm" + Hiệu ứng Mưa Tiền + Khóa Phong Thủy Bàn Làm',
  },

  // ═══ EVENT 2: Trung Thu 2026 — Đoàn viên tài chính ═══
  {
    id: 'event-midautumn-2026',
    name: 'Trung Thu Đoàn Viên',
    subtitle: 'Tài lộc & tình thân — Chuẩn bị quỹ biếu, quỹ học cho con',
    icon: '🌕',
    themeColor: '#EAB308',
    startDate: '2026-09-01',
    endDate: '2026-10-15',
    chapters: [
      {
        id: 'midautumn-c1',
        order: 1,
        title: 'Chương 1: Quỹ Biếu',
        scenario:
          'Trung Thu là dịp biếu quà ông bà, cha mẹ, con cháu. Tiết kiệm 500k vào quỹ trước khi đến rằm.',
        hint: 'Transfer vào quỹ Mục Tiêu',
        icon: '🎁',
        metric: 'event_saved',
        target: 500_000,
        xpReward: 200,
      },
      {
        id: 'midautumn-c2',
        order: 2,
        title: 'Chương 2: Ghi nhận thu nhập',
        scenario:
          'Theo dõi rõ thu nhập tháng này để biết khả năng chi cho Trung Thu mà không phá ví. Ghi 3 khoản thu.',
        hint: 'Ghi đầy đủ mọi khoản — lương, freelance, quà',
        icon: '💰',
        metric: 'event_income_logged',
        target: 3,
        xpReward: 150,
      },
      {
        id: 'midautumn-c3',
        order: 3,
        title: 'Chương 3: Cam kết',
        scenario:
          'Mở app 7 ngày liên tiếp trong dịp Trung Thu — gia đình quây quần nhưng tài chính vẫn được kiểm soát.',
        hint: 'Mở app mỗi ngày',
        icon: '🌙',
        metric: 'event_app_days',
        target: 7,
        xpReward: 250,
      },
    ],
    finalRewardItemIds: ['elearning-tamthuc-1', 'sound-tet'],
    finalRewardLabel: 'Bộ Trung Thu — Video "Bí mật thịnh vượng P1" + Sound Pack Pháo Tết',
  },

  // ═══ EVENT 3: Tết Bính Ngọ 2026 (đã qua — giữ để test/replay) ═══
  {
    id: 'event-tet-2026',
    name: 'Tết Bính Ngọ 2026',
    subtitle: 'Kích tài lộc năm Ngựa Lửa — Khai xuân vận may',
    icon: '🐎',
    themeColor: '#DC2626',
    startDate: '2026-01-15',
    endDate: '2026-02-28',
    chapters: [
      {
        id: 'tet-c1',
        order: 1,
        title: 'Chương 1: Tổng kết năm cũ',
        scenario:
          'Năm cũ qua — ghi rõ tình hình tài chính. 5 khoản thu nhập để có bức tranh đầy đủ.',
        hint: 'Ghi lại các khoản thu cuối năm',
        icon: '📋',
        metric: 'event_income_logged',
        target: 5,
        xpReward: 200,
      },
      {
        id: 'tet-c2',
        order: 2,
        title: 'Chương 2: Quỹ Tết',
        scenario:
          'Tiết kiệm 2tr cho quỹ Tết — biếu cha mẹ, lì xì cháu, ăn Tết không lo.',
        hint: 'Split vào quỹ Mục Tiêu',
        icon: '🧧',
        metric: 'event_saved',
        target: 2_000_000,
        xpReward: 400,
      },
      {
        id: 'tet-c3',
        order: 3,
        title: 'Chương 3: Khai bút đầu xuân',
        scenario:
          'Mùng 1 Tết: mở app ghi 1 khoản — dù chỉ 50k cũng được. Khai bút = khởi đầu năm mới có kỷ luật.',
        hint: 'Bất kỳ giao dịch nào trong dịp Tết',
        icon: '🖋️',
        metric: 'event_app_days',
        target: 3,
        xpReward: 300,
      },
    ],
    finalRewardItemIds: ['theme-tet-2026', 'butler-tet', 'elearning-tet2026'],
    finalRewardLabel: 'Bộ Tết Bính Ngọ — Theme Đỏ Vàng + Quản gia Áo Dài + Khóa Kích Tài Lộc 2026',
  },
];

/**
 * Trả event đang active (today nằm giữa startDate-endDate).
 * Nếu nhiều event overlap, lấy event có startDate gần nhất.
 */
export function getActiveSeasonalEvent(now: Date = new Date()): SeasonalEvent | null {
  const today = now.toISOString().slice(0, 10);
  const active = SEASONAL_EVENTS.filter((e) => today >= e.startDate && today <= e.endDate);
  if (active.length === 0) return null;
  // Sort by startDate desc — lấy event start gần nhất
  active.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return active[0];
}

/** Tìm event theo id (cho replay/testing). */
export function getSeasonalEventById(id: string): SeasonalEvent | undefined {
  return SEASONAL_EVENTS.find((e) => e.id === id);
}
