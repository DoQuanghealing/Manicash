/* ═══ Butler Messages — Lord Diamond "Vừa Đấm Vừa Xoa" ═══ */

export interface ButlerMessage {
  text: string;
  mood: 'proud' | 'sarcastic' | 'encouraging' | 'calm' | 'shock';
}

type MessageContext =
  | 'income'
  | 'expense_small'
  | 'expense_large'
  | 'resist'
  | 'streak'
  | 'rank_up'
  | 'daily_greeting'
  | 'savings';

const MESSAGES: Record<MessageContext, ButlerMessage[]> = {
  /* ═══ THU NHẬP — Khen ngợi hào hứng (10 câu) ═══ */
  income: [
    { text: 'Xuất sắc! Tiền về như thác đổ, Lord Diamond bái phục khả năng kiếm tiền của cậu! 🏆', mood: 'proud' },
    { text: 'Thêm một viên gạch vàng cho tòa lâu đài tương lai. Cứ đà này thì sớm giàu thôi! 🧱✨', mood: 'proud' },
    { text: 'Hạng Kim Cương không còn xa nữa, thu nhập này thực sự đẳng cấp! 💎', mood: 'proud' },
    { text: 'Tôi thích âm thanh này! Lẻng xẻng và đầy triển vọng. 🎵💰', mood: 'encouraging' },
    { text: 'Cậu chủ là chiến binh tài chính đích thực. Hãy phân bổ thông minh khoản này nhé! ⚔️', mood: 'encouraging' },
    { text: 'Tiền đổ về rồi! Mỗi đồng đều là một viên gạch cho căn hộ 6 tỷ. Cứ thế nhé! 🏠', mood: 'proud' },
    { text: 'Cha mẹ cậu chắc hẳn tự hào lắm. Thu nhập này đậm chất chiến binh! 💪', mood: 'encouraging' },
    { text: 'Lord Diamond dự đoán: Với tốc độ này, cậu sẽ lên hạng trước cả kỳ vọng! 📈🔥', mood: 'proud' },
    { text: 'Khoản thu nhập này xứng đáng được bắn pháo hoa! Cậu chủ tuyệt vời quá! 🎆', mood: 'proud' },
    { text: 'Đây chính là sức mạnh của kỷ luật tài chính. Cậu đang trên con đường đúng đắn! 🌟', mood: 'encouraging' },
  ],

  /* ═══ CHI TIÊU NHỎ — Xắt xéo nhẹ nhàng (20 câu) ═══ */
  expense_small: [
    { text: 'Cậu chủ ơi... miệng thì muốn nhà muốn xe mà tay thì cứ rải tiền thế à? >\"<', mood: 'sarcastic' },
    { text: 'Lại cà phê xịn à? Lord Diamond tự hỏi bao giờ cái máy pha cà phê ở nhà mới được sủng ái? ☕', mood: 'sarcastic' },
    { text: 'Một cú quẹt thẻ, một bước lùi xa căn hộ 6 tỷ. Cậu chủ chọn cái nào? 🏠💸', mood: 'sarcastic' },
    { text: 'Ví của cậu đang gầy đi trông thấy, còn đống đồ này sắp chiếm hết chỗ trong nhà rồi!', mood: 'sarcastic' },
    { text: 'Tôi vừa nghe thấy tiếng số dư khóc thét khi cậu nhấn xác nhận đấy. 😢', mood: 'sarcastic' },
    { text: 'Chi tiêu kiểu này thì đến năm 2099 chúng ta mới mua được nhà nhé! 🗓️', mood: 'sarcastic' },
    { text: 'Lại chi? Cậu chủ định sưu tập hóa đơn thay vì sưu tập tài sản sao? 🧾', mood: 'sarcastic' },
    { text: 'Tôi nghĩ món đồ này sẽ sớm nằm trong góc nhà thôi, giống như khoản tiền này biến mất vậy.', mood: 'sarcastic' },
    { text: 'Cậu chủ hào phóng quá, hào phóng đến mức quên luôn ngày mai ăn gì rồi! 🍜', mood: 'sarcastic' },
    { text: 'Nếu sự tiêu xài là một môn thể thao, chắc chắn cậu đã có huy chương vàng rồi. 🥇', mood: 'sarcastic' },
    { text: 'Khoản này nhỏ thôi, nhưng 10 khoản nhỏ thành quả lớn đó cậu chủ...', mood: 'sarcastic' },
    { text: 'Cậu có biết 365 cốc trà sữa/năm = 1 chuyến du lịch Nhật Bản không? 🇯🇵', mood: 'sarcastic' },
    { text: 'Lord Diamond ghi nhận rồi... ghi nhận cả sự đau lòng nữa. 📝💔', mood: 'sarcastic' },
    { text: 'Số dư vừa gầy đi một chút. Cậu có nghe tiếng nó thở dài không? 😮‍💨', mood: 'sarcastic' },
    { text: 'Mua xong nhớ hít thở sâu và tự hỏi: "Mình THẬT SỰ cần cái này không?"', mood: 'calm' },
    { text: 'Đã ghi nhận. Nhưng nhớ rằng mỗi đồng tiêu đi là một đồng không sinh lời!', mood: 'sarcastic' },
    { text: 'Cậu chủ ơi, ví tiền trống rỗng thì mộng mơ cũng trống rỗng theo đấy!', mood: 'sarcastic' },
    { text: 'Tiền cũng như tình yêu, càng vung vãi thì càng mau hết. 💔💸', mood: 'sarcastic' },
    { text: 'Tay cậu vừa ấn nút, mục tiêu 6 tỷ vừa lùi thêm 1 bước. Có đau không? 🚶', mood: 'sarcastic' },
    { text: 'Thôi được, Lord Diamond sẽ không nói gì nữa... *ngồi ghi sổ trong im lặng* 📖', mood: 'sarcastic' },
  ],

  /* ═══ CHI TIÊU LỚN — Shock + nhắc BreathGate ═══ */
  expense_large: [
    { text: '😱 Ô KÌA! Khoản này lớn đấy! Cậu chủ có chắc không? Hít thở 30 giây đã!', mood: 'shock' },
    { text: 'DỪNG LẠI! Lord Diamond yêu cầu cậu hít thở sâu trước khi phá sản nhé! 🫁', mood: 'shock' },
    { text: 'Khoản chi này bằng cả tháng ăn uống... Cậu chủ đã cân nhắc kỹ chưa? 🤔', mood: 'shock' },
    { text: 'Số dư đang run rẩy vì sợ hãi. Hãy nghĩ lại, làm ơn...', mood: 'shock' },
    { text: 'Nếu chi khoản này, Lord Diamond sẽ phải khóc trong góc 3 ngày liền. 😭', mood: 'shock' },
  ],

  /* ═══ NHỊN CHI TIÊU — Khen x2 ═══ */
  resist: [
    { text: 'ĐỈNH CAO KỶ LUẬT! Cậu vừa tiết kiệm được một khoản. Lord Diamond tự hào! 🏆', mood: 'proud' },
    { text: 'Chiến binh tài chính đích thực! Nhịn được = mạnh hơn 90% người thường! 💪', mood: 'proud' },
    { text: 'Khoản tiền này sẽ cảm ơn cậu trong tương lai. Xuất sắc! ⏱️✨', mood: 'proud' },
    { text: 'Mỗi lần nhịn là một lần thắng bản thân. x2 XP cho chiến binh! ⚡', mood: 'encouraging' },
    { text: 'Cậu chủ vừa chứng minh: MUỐN không phải là CẦN. Tuyệt vời! 🎯', mood: 'proud' },
  ],

  /* ═══ STREAK — Duy trì ═══ */
  streak: [
    { text: 'Ngày thứ {days} liên tiếp! Kỷ luật này đáng giá hơn vàng! 🔥', mood: 'proud' },
    { text: 'Streak đang nóng rực! Cậu chủ đừng để nó nguội nhé! 🔥🔥', mood: 'encouraging' },
    { text: 'Lord Diamond đếm từng ngày. Cậu chủ đang tạo thói quen tỷ phú! 📊', mood: 'proud' },
  ],

  /* ═══ RANK UP ═══ */
  rank_up: [
    { text: 'LEEEEN HẠNG! Lord Diamond chính thức phong tước cho cậu! 🎉👑', mood: 'proud' },
    { text: 'Đẳng cấp mới, mở khóa tính năng mới! Cậu xứng đáng! 🔓✨', mood: 'proud' },
    { text: 'Từ giờ, cậu được gọi là Chiến binh {rank}. Tự hào quá! ⚔️', mood: 'proud' },
  ],

  /* ═══ CHÀO NGÀY MỚI ═══ */
  daily_greeting: [
    { text: 'Ngày mới, tiền mới! Hãy kiếm nhiều và tiêu ít nhé, cậu chủ! 🌅', mood: 'encouraging' },
    { text: 'Lord Diamond đã pha trà xong. Sẵn sàng chinh phục ngày hôm nay! ☕', mood: 'calm' },
    { text: 'Bắt đầu ngày mới bằng việc ghi sổ — thói quen của người giàu! 📝', mood: 'encouraging' },
  ],

  /* ═══ TIẾT KIỆM ═══ */
  savings: [
    { text: 'Tiết kiệm là siêu năng lực mà ít người có. Cậu chủ đang rèn luyện! 💪', mood: 'encouraging' },
    { text: 'Mỗi đồng tiết kiệm = 1 viên gạch cho tòa nhà tương lai. Xây tiếp đi! 🧱', mood: 'proud' },
    { text: 'Warren Buffett bắt đầu từ việc tiết kiệm. Cậu đang đi đúng hướng! 📈', mood: 'encouraging' },
  ],
};

// Anti-repeat: track last used index per context
const lastUsed = new Map<MessageContext, number>();

export function getButlerMessage(context: MessageContext, butlerName?: string): ButlerMessage {
  const pool = MESSAGES[context];
  if (!pool || pool.length === 0) {
    const fallbackText = butlerName
      ? `${butlerName} đang quan sát...`
      : 'Lord Diamond đang quan sát...';
    return { text: fallbackText, mood: 'calm' };
  }

  const lastIdx = lastUsed.get(context) ?? -1;
  let nextIdx: number;

  // Avoid repeating the same message consecutively
  do {
    nextIdx = Math.floor(Math.random() * pool.length);
  } while (nextIdx === lastIdx && pool.length > 1);

  lastUsed.set(context, nextIdx);
  const msg = pool[nextIdx];

  if (butlerName && butlerName !== 'Lord Diamond') {
    return { ...msg, text: msg.text.replaceAll('Lord Diamond', butlerName) };
  }
  return msg;
}

export function getButlerMessageByMood(mood: ButlerMessage['mood'], butlerName?: string): ButlerMessage {
  const allMessages = Object.values(MESSAGES).flat();
  const filtered = allMessages.filter((m) => m.mood === mood);
  if (filtered.length === 0) {
    const fallbackText = butlerName
      ? `${butlerName} mỉm cười...`
      : 'Lord Diamond mỉm cười...';
    return { text: fallbackText, mood: 'calm' };
  }
  const msg = filtered[Math.floor(Math.random() * filtered.length)];

  if (butlerName && butlerName !== 'Lord Diamond') {
    return { ...msg, text: msg.text.replaceAll('Lord Diamond', butlerName) };
  }
  return msg;
}

