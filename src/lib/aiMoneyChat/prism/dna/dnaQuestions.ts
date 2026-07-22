/* ═══ PRISM — Financial DNA: Bộ câu trắc nghiệm (PV-3 · B1) ═══
 *
 * Phần A của bài test tâm lý tiền (docs/FINANCIAL_DNA_SPEC.md §3): 8 câu bấm chọn,
 * mỗi đáp án gắn TRỌNG SỐ tới 5 persona money-script. 4 câu đầu (teaser=true) là
 * teaser 0 token cho luồng mời Phú Vương. Thuần (pure) + offline 100%. KHÔNG AI.
 *
 * ⚠️ BẢN NHÁP chờ PO duyệt (spec §9) — chỉnh label/weights tại đây, KHÔNG đổi id
 * (id đã persist trong store của user).
 */

import type { DnaPersonaId } from './personaEngine';

export interface DnaOption {
  id: string;
  label: string;
  /** Điểm cộng cho từng persona khi chọn đáp án này (1–3). */
  weights: Partial<Record<DnaPersonaId, number>>;
}

export interface DnaQuestion {
  id: string;
  text: string;
  /** Thuộc teaser 4 câu (persona sơ bộ, 0 token). */
  teaser: boolean;
  options: DnaOption[];
}

export const DNA_QUESTIONS: DnaQuestion[] = [
  {
    id: 'q1_surplus',
    text: 'Cuối tháng dư ra một khoản, ngài thường…',
    teaser: true,
    options: [
      { id: 'keep', label: 'Để yên cho chắc — có tiền nằm đó mới an tâm', weights: { guardian: 3 } },
      { id: 'enjoy', label: 'Tiêu nốt cho đã — tiền là để sống chứ', weights: { spender: 3 } },
      { id: 'invest', label: 'Chuyển ngay vào tiết kiệm/đầu tư theo kế hoạch', weights: { builder: 3 } },
      { id: 'flex', label: 'Mua thứ mình xứng đáng — đồ đẹp, trải nghiệm sang', weights: { status: 3 } },
      { id: 'unknown', label: 'Thú thật… tôi không rõ cuối tháng có dư hay không', weights: { avoider: 3 } },
    ],
  },
  {
    id: 'q2_feeling',
    text: 'Nhìn vào bảng chi tiêu của mình, ngài cảm thấy…',
    teaser: true,
    options: [
      { id: 'anxious', label: 'Lo lắng — lúc nào cũng sợ thiếu', weights: { guardian: 2, avoider: 1 } },
      { id: 'fine', label: 'Thoải mái — tiêu rồi thì thôi, nghĩ nhiều mệt', weights: { spender: 2 } },
      { id: 'curious', label: 'Tò mò — muốn tối ưu xem còn cắt/tăng được gì', weights: { builder: 3 } },
      { id: 'avoid', label: 'Ngại — thà không nhìn còn hơn', weights: { avoider: 3 } },
    ],
  },
  {
    id: 'q3_meaning',
    text: 'Với ngài, tiền chủ yếu là…',
    teaser: true,
    options: [
      { id: 'safety', label: 'Sự an toàn — tấm đệm cho mọi bất trắc', weights: { guardian: 3 } },
      { id: 'joy', label: 'Niềm vui hiện tại — trải nghiệm, ăn ngon, đi chơi', weights: { spender: 3 } },
      { id: 'tool', label: 'Công cụ — tiền phải đẻ ra tiền', weights: { builder: 3 } },
      { id: 'measure', label: 'Thước đo — thành công phải nhìn thấy được', weights: { status: 3 } },
    ],
  },
  {
    id: 'q4_guilt',
    text: 'Khoản chi khiến ngài áy náy nhất gần đây…',
    teaser: true,
    options: [
      { id: 'rarely', label: 'Hầu như không có — tôi rất ít khi dám chi', weights: { guardian: 2 } },
      { id: 'fun', label: 'Mấy bữa vui bạn bè, giải trí hơi quá tay', weights: { spender: 2 } },
      { id: 'forgot', label: 'Có khoản tôi còn không nhớ đã tiêu vào việc gì', weights: { avoider: 3 } },
      { id: 'brand', label: 'Món đồ hiệu/xịn mua để "bằng bạn bằng bè"', weights: { status: 3 } },
      { id: 'bet', label: 'Khoá học/khoản đầu tư chưa sinh lời như kỳ vọng', weights: { builder: 2 } },
    ],
  },
  {
    id: 'q5_tracking',
    text: 'Chuyện ghi chép thu chi của ngài giống với…',
    teaser: false,
    options: [
      { id: 'daily', label: 'Ghi đều mỗi ngày, thiếu một dòng là khó chịu', weights: { guardian: 2, builder: 1 } },
      { id: 'sometimes', label: 'Thỉnh thoảng nhớ thì ghi', weights: { spender: 1, avoider: 1 } },
      { id: 'never', label: 'Gần như không — nhìn số dư rồi… đoán', weights: { avoider: 3 } },
      { id: 'auto', label: 'Có hệ thống/công cụ tự tổng kết, cuối tháng rà một lượt', weights: { builder: 2 } },
    ],
  },
  {
    id: 'q6_overbudget',
    text: 'Tháng này lỡ tiêu vượt kế hoạch, phản ứng của ngài…',
    teaser: false,
    options: [
      { id: 'clampdown', label: 'Dằn vặt, lập tức thắt chặt mọi khoản', weights: { guardian: 3 } },
      { id: 'letgo', label: 'Kệ — vui là chính, tháng sau tính tiếp', weights: { spender: 2, avoider: 1 } },
      { id: 'analyze', label: 'Ngồi xem vượt ở đâu, vì sao, rồi điều chỉnh', weights: { builder: 3 } },
      { id: 'earnmore', label: 'Tìm cách kiếm thêm để bù, không muốn giảm mức sống', weights: { status: 2, builder: 1 } },
    ],
  },
  {
    id: 'q7_debt',
    text: 'Thái độ của ngài với vay nợ…',
    teaser: false,
    options: [
      { id: 'never', label: 'Tuyệt đối tránh — nợ là mất ngủ', weights: { guardian: 3 } },
      { id: 'enjoy_first', label: 'Trả góp/hưởng trước trả sau, miễn trong khả năng', weights: { spender: 2 } },
      { id: 'leverage', label: 'Đòn bẩy tốt nếu tính kỹ được dòng tiền trả', weights: { builder: 3 } },
      { id: 'unclear', label: 'Tôi… không nắm rõ mình đang nợ tổng bao nhiêu', weights: { avoider: 3 } },
      { id: 'image', label: 'Vay được để nâng hình ảnh/cơ hội thì đáng', weights: { status: 3 } },
    ],
  },
  {
    id: 'q8_fiveyears',
    text: '5 năm nữa, bức tranh tiền bạc ngài muốn thấy nhất…',
    teaser: false,
    options: [
      { id: 'cushion', label: 'Một khoản dự phòng đủ dày để không phải lo', weights: { guardian: 3 } },
      { id: 'experience', label: 'Sống thoải mái, nhiều trải nghiệm đáng nhớ', weights: { spender: 3 } },
      { id: 'assets', label: 'Tài sản tự sinh thu nhập đều đặn', weights: { builder: 3 } },
      { id: 'respect', label: 'Vị thế được nể trọng — nhà, xe, sự nghiệp nhìn thấy được', weights: { status: 3 } },
      { id: 'notyet', label: 'Thú thật là tôi chưa dám nghĩ xa vậy', weights: { avoider: 2 } },
    ],
  },
];

export const TEASER_QUESTIONS: DnaQuestion[] = DNA_QUESTIONS.filter((q) => q.teaser);

/** Câu trả lời 1 câu hỏi (id-based, an toàn khi đổi label). */
export interface DnaAnswer {
  questionId: string;
  optionId: string;
}

const QUESTION_BY_ID = new Map(DNA_QUESTIONS.map((q) => [q.id, q]));

/** Lọc câu trả lời hợp lệ + khử trùng lặp theo câu hỏi (giữ lần chọn ĐẦU). */
export function sanitizeDnaAnswers(input: unknown): DnaAnswer[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: DnaAnswer[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const { questionId, optionId } = item as Record<string, unknown>;
    if (typeof questionId !== 'string' || typeof optionId !== 'string') continue;
    const q = QUESTION_BY_ID.get(questionId);
    if (!q || seen.has(questionId)) continue;
    if (!q.options.some((o) => o.id === optionId)) continue;
    seen.add(questionId);
    out.push({ questionId, optionId });
  }
  return out;
}

/** Nhãn hiển thị của đáp án đã chọn (cho prompt LLM) — null nếu không hợp lệ. */
export function describeAnswer(a: DnaAnswer): { question: string; answer: string } | null {
  const q = QUESTION_BY_ID.get(a.questionId);
  const o = q?.options.find((x) => x.id === a.optionId);
  if (!q || !o) return null;
  return { question: q.text, answer: o.label };
}
