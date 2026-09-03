/* ═══ File giả lập MẪU — để PO tải về rồi sửa lại ═══
 *
 * Ngày ghi TUYỆT ĐỐI cho dễ đọc. Khi nạp, tick "dịch mốc về hôm nay" sẽ dịch cả
 * cụm sao cho ngày mới nhất rơi vào hôm nay — nên file này dùng lại được mãi,
 * không cần sửa ngày mỗi lần demo.
 *
 * Hồ sơ mẫu: người thu 2 nguồn (lương + kinh doanh), ăn uống ghi từng bữa,
 * có 3 mục tiêu và 2 nhiệm vụ kiếm tiền đang chạy.
 */
import type { SimFile } from './schema';

export const SAMPLE_SIM_FILE: SimFile = {
  label: 'Hồ sơ mẫu — thu 2 nguồn, 2 tháng',

  profile: { displayName: 'Minh', hideBalance: false },

  accounts: {
    main: 24_500_000,
    cash: 2_400_000,
    spending: 10_000_000,
    spendingLimit: 8_500_000,
    reserve: 42_000_000,
    goalsFund: 159_500_000,
    investment: 28_000_000,
    billFund: 1_751_000,
  },

  budgets: [
    { categoryId: 'food', monthlyLimit: 5_000_000 },
    { categoryId: 'transport', monthlyLimit: 1_200_000 },
    { categoryId: 'shopping', monthlyLimit: 1_500_000 },
    { categoryId: 'coffee', monthlyLimit: 800_000 },
  ],

  transactions: [
    // ── Tháng trước ──
    { date: '2026-08-05', type: 'income', categoryId: 'salary', amount: 20_000_000, note: 'Lương tháng 8', time: '09:00' },
    { date: '2026-08-12', type: 'income', categoryId: 'business', amount: 5_400_000, note: 'Hoa hồng đợt 1', time: '14:30' },
    { date: '2026-08-24', type: 'income', categoryId: 'business', amount: 4_600_000, note: 'Hoa hồng đợt 2', time: '15:10' },
    // Ăn uống: một dòng trải cả tháng nhờ repeatUntil
    { date: '2026-08-01', repeatUntil: '2026-08-31', type: 'expense', categoryId: 'food', amount: 58_000, note: 'Ăn trưa', time: '12:00', method: 'cash' },
    { date: '2026-08-01', repeatUntil: '2026-08-31', type: 'expense', categoryId: 'food', amount: 62_000, note: 'Ăn tối', time: '19:00', method: 'cash' },
    { date: '2026-08-14', type: 'expense', categoryId: 'shopping', amount: 620_000, note: 'Đồ dùng gia đình', time: '21:00' },

    // ── Tháng này ──
    { date: '2026-09-05', type: 'income', categoryId: 'salary', amount: 20_000_000, note: 'Lương tháng 9', time: '09:00' },
    { date: '2026-09-12', type: 'income', categoryId: 'business', amount: 7_000_000, note: 'Hoa hồng đợt 1', time: '14:30' },
    { date: '2026-09-01', repeatUntil: '2026-09-14', type: 'expense', categoryId: 'food', amount: 32_000, note: 'Ăn sáng', time: '07:15', method: 'cash' },
    { date: '2026-09-01', repeatUntil: '2026-09-14', type: 'expense', categoryId: 'food', amount: 58_000, note: 'Ăn trưa', time: '12:00', method: 'cash' },
    { date: '2026-09-01', repeatUntil: '2026-09-14', type: 'expense', categoryId: 'coffee', amount: 35_000, note: 'Cà phê', time: '08:30', method: 'cash' },
    { date: '2026-09-07', type: 'expense', categoryId: 'transport', amount: 110_000, note: 'Đổ xăng', time: '18:00' },
    { date: '2026-09-11', type: 'expense', categoryId: 'shopping', amount: 780_000, note: 'Đặt hàng online', time: '21:30' },
  ],

  bills: [
    { name: 'Tiền nhà', icon: '🏠', amount: 4_000_000, dueDay: 5, isPaid: true },
    { name: 'Internet', icon: '🌐', amount: 250_000, dueDay: 8, isPaid: true },
    { name: 'Điện + nước', icon: '💡', amount: 1_451_000, dueDay: 15, isPaid: false },
    { name: 'Điện thoại', icon: '📱', amount: 300_000, dueDay: 20, isPaid: false },
  ],

  goals: [
    { name: 'Mua nhà', icon: '🏡', target: 900_000_000, current: 128_000_000, monthly: 2_500_000, deadline: '2031-12-31' },
    { name: 'Xe máy mới', icon: '🛵', target: 45_000_000, current: 31_500_000, monthly: 1_000_000, deadline: '2027-06-30' },
    { name: 'Quỹ dự phòng', icon: '🛡️', target: 100_000_000, current: 42_000_000, monthly: 1_500_000 },
  ],

  tasks: [
    {
      name: 'Freelance thiết kế landing',
      expected: 8_000_000,
      start: '2026-09-02',
      end: '2026-09-20',
      subTasks: ['Chốt yêu cầu với khách', 'Gửi bản nháp', 'Sửa theo góp ý', 'Bàn giao + nhận tiền'],
    },
    {
      name: 'Bán khoá học nhỏ',
      expected: 5_000_000,
      start: '2026-09-08',
      end: '2026-09-30',
      subTasks: ['Soạn nội dung 5 buổi', 'Dựng trang bán', 'Chạy bài giới thiệu'],
    },
  ],
};
