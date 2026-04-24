/* ═══ Butler Drawer — Motivational Quotes + AI Suggestions ═══ */

export const MOTIVATION_QUOTES = [
  'Cậu chủ ơi, thêm 1 task nhỏ là gần hơn với chiếc xe mơ ước rồi! 🚗✨',
  'Kỷ luật là sức mạnh, hãy rà soát chi tiêu hôm nay nhé! 💪',
  'Tiền không tự sinh ra, nó đến từ sự nỗ lực của cậu chủ đấy! 🔥',
  'Mỗi đồng tiết kiệm hôm nay = tự do tài chính ngày mai! 🌅',
  'Lord Diamond tin rằng cậu chủ sẽ đạt mục tiêu tháng này! 🏆',
  'Đầu tư vào bản thân là khoản đầu tư sinh lời cao nhất! 📚',
  'Người giàu không chi nhiều, họ chi đúng. Cậu chủ cũng vậy! 💎',
  'Hãy biến mỗi ngày thành một bước tiến trên hành trình tài chính! 🚀',
  'Cậu chủ đang làm tốt lắm! Giữ vững nhịp độ nhé! 🎯',
  'Tiền bạc là công cụ, không phải mục đích. Dùng nó thông minh! 🧠',
  'Streak 7 ngày liên tiếp = +500 XP bonus! Đừng bỏ cuộc! 🔥',
  'Mỗi bill trả đúng hạn = 1 bước gần hơn với tự do! ✅',
  'Cậu chủ ơi, hãy nhớ: chi tiêu thông minh ≠ chi tiêu ít! 🧐',
  'Lord Diamond đã tính: còn 3 tháng nữa là đạt mục tiêu tiết kiệm! 📊',
  'Sáng tạo nguồn thu mới đi! Lord Diamond sẽ giúp quản lý! 💡',
  'Năng lượng tài chính của cậu chủ hôm nay: ⚡⚡⚡⚡⚡ (5/5)!',
  'Hãy dành 10 phút mỗi tối để review chi tiêu. Nhỏ mà hiệu quả! ⏰',
  'Cậu chủ có biết: 80% người giàu có thói quen ghi chép tài chính? 📝',
  'Lord Diamond tự hào về sự kỷ luật của cậu chủ! Tiếp tục nhé! 👑',
  'Một khoản thu nhỏ mỗi ngày = triệu đồng mỗi tháng! Bắt đầu thôi! 💰',
];

export interface AISuggestion {
  id: string;
  icon: string;
  title: string;
  description: string;
  category: 'increase' | 'reduce' | 'optimize' | 'discipline' | 'plan';
}

export const AI_SUGGESTIONS: AISuggestion[] = [
  {
    id: 'sug-1',
    icon: '📈',
    title: 'Tăng thu nhập',
    description: 'Nhận thêm 1-2 task freelance trong tuần này. Mục tiêu: +2 triệu/tuần.',
    category: 'increase',
  },
  {
    id: 'sug-2',
    icon: '✂️',
    title: 'Cắt giảm chi tiêu',
    description: 'Mục "Cà phê" đang tốn 1.5tr/tháng. Giảm 30% = tiết kiệm 450k!',
    category: 'reduce',
  },
  {
    id: 'sug-3',
    icon: '🔄',
    title: 'Tối ưu nguồn lực',
    description: 'Chuyển tiền nhàn rỗi sang quỹ bill cố định để trả trước khi đến hạn.',
    category: 'optimize',
  },
  {
    id: 'sug-4',
    icon: '⚔️',
    title: 'Rèn kỷ luật',
    description: 'Duy trì streak ghi chép 7 ngày liên tiếp để nhận +500 XP bonus!',
    category: 'discipline',
  },
  {
    id: 'sug-5',
    icon: '🗺️',
    title: 'Lập kế hoạch',
    description: 'Đặt mục tiêu tiết kiệm tháng tới: 5 triệu. Chia nhỏ = 167k/ngày.',
    category: 'plan',
  },
];
