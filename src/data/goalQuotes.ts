/* ═══ Goal Quotes — 24 câu phú quý/manifestation ═══
 *
 * Hiển thị random trong GoalDetailModal — tăng động lực + chất Á Đông.
 */

export interface GoalQuote {
  text: string;
  author?: string;
}

export const GOAL_QUOTES: GoalQuote[] = [
  // Cổ học Á Đông
  { text: 'Hành trình vạn dặm bắt đầu từ một bước chân.', author: 'Lão Tử' },
  { text: 'Người không biết tiết kiệm, dù kiếm núi cũng hết.', author: 'Khổng Tử' },
  { text: 'Giàu sang đến từ sự kiên trì hằng ngày, không từ may mắn một lúc.' },
  { text: 'Nước nhỏ giọt lâu ngày cũng xuyên đá. Tiền nhỏ tích lâu thành quỹ lớn.' },
  { text: 'Phú quý không tự đến — phú quý đến với người chuẩn bị.' },

  // Manifestation / tâm thức thịnh vượng
  { text: 'Bạn không thu hút thứ bạn muốn — bạn thu hút thứ bạn LÀ.' },
  { text: 'Tài lộc theo người có kế hoạch, không theo người ước mơ suông.' },
  { text: 'Tâm thức người giàu: nghĩ đầu tư trước, tiêu sau.' },
  { text: 'Tiền chỉ ở lại với người biết quý trọng từng đồng.' },
  { text: 'Đặt mục tiêu rõ ràng = mở cửa cho vũ trụ gửi cơ hội đến.' },

  // Phong thủy tài lộc
  { text: 'Ví sạch — vận tới. Tâm tịnh — tiền sinh.' },
  { text: 'Tích tiền vào quỹ riêng = không cho tài lộc "đi lạc".' },
  { text: 'Mỗi đồng có địa chỉ — đó là phong thủy tài chính.' },

  // Western financial wisdom (Việt hóa)
  { text: 'Đừng tiết kiệm phần còn lại sau chi tiêu — hãy chi tiêu phần còn lại sau tiết kiệm.', author: 'Warren Buffett' },
  { text: 'Người giàu không kiếm nhiều hơn — họ quản lý giỏi hơn.' },
  { text: 'Tài sản lớn nhất không phải tiền — là thói quen tốt với tiền.' },
  { text: 'Một ngày bỏ qua mục tiêu = một ngày làm việc cho người khác.' },

  // Tự do tài chính
  { text: 'Mua tự do trước, mua thoải mái sau.' },
  { text: 'Mục tiêu của tiền không phải tiêu — là cho bạn TỰ DO không cần tiêu.' },

  // Truyền dạy thế hệ
  { text: 'Truyền cho con tiền — con tiêu hết. Truyền cách kiếm — con tự xây.' },

  // Tâm linh thực hành
  { text: 'Cảm ơn từng đồng vào ví. Lòng biết ơn là nam châm tài lộc.' },
  { text: 'Cho đi 10% — vũ trụ sẽ gửi lại nhiều hơn.' },

  // Kỷ luật
  { text: 'Kỷ luật là nhịp cầu giữa mục tiêu và thành tựu.' },
  { text: 'Bạn chỉ cách mục tiêu vài lần "không" với cám dỗ.' },
];

/** Pick deterministic theo goalId — cùng goal luôn ra cùng quote trong phiên. */
export function pickQuoteForGoal(goalId: string): GoalQuote {
  let hash = 0;
  for (const ch of goalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GOAL_QUOTES[hash % GOAL_QUOTES.length];
}
