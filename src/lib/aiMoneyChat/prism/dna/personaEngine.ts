/* ═══ PRISM — Financial DNA: Persona engine (PV-3 · B1) ═══
 *
 * Deterministic 100%: cộng trọng số đáp án → điểm 5 persona money-script (0–100)
 * → persona chính (+ lai nếu 2 nhóm sát nhau, theo pattern classifyCapacity).
 * Teaser = chấm trên 4 câu đầu. Giọng MÔ TẢ, KHÔNG phán xét (spec §2, §6).
 */

import { DNA_QUESTIONS, sanitizeDnaAnswers, type DnaAnswer } from './dnaQuestions';

export type DnaPersonaId = 'guardian' | 'spender' | 'avoider' | 'builder' | 'status';

export const DNA_PERSONA_IDS: DnaPersonaId[] = ['guardian', 'spender', 'avoider', 'builder', 'status'];

export interface DnaPersonaProfile {
  id: DnaPersonaId;
  icon: string;
  label: string;
  /** Mô tả ấm áp 1 câu (teaser + fallback deterministic). */
  tagline: string;
  strengths: string[];
  blindspots: string[];
  /** Giải pháp hành vi mặc định (fallback khi không có AI). */
  defaultActions: string[];
  /** Hướng nâng tầm tư duy mặc định (money script lành mạnh hơn). */
  defaultMindsetShift: string;
}

/** 5 persona theo spec §2 — điểm mạnh/điểm mù đều có, không nhóm nào "xấu". */
export const DNA_PERSONAS: Record<DnaPersonaId, DnaPersonaProfile> = {
  guardian: {
    id: 'guardian',
    icon: '🛡️',
    label: 'Người Canh Giữ',
    tagline: 'Kỷ luật và cẩn trọng — tiền trong tay ngài luôn an toàn.',
    strengths: ['An toàn, ít khi rơi vào nợ xấu', 'Kỷ luật chi tiêu thuộc nhóm cao nhất'],
    blindspots: ['Dễ bỏ lỡ cơ hội vì quá thận trọng', 'Căng thẳng vì tiền cả khi tài chính đang ổn'],
    defaultActions: [
      'Trích một khoản nhỏ cố định mỗi tháng cho "tiêu không cần lý do" — cho phép mình hưởng',
      'Thử để 5–10% khoản dư vào một kênh sinh lời an toàn thay vì để yên toàn bộ',
    ],
    defaultMindsetShift: 'Tiền không chỉ để giữ — một phần tiền được phép làm việc và phục vụ niềm vui của ngài.',
  },
  spender: {
    id: 'spender',
    icon: '🎈',
    label: 'Người Phóng Khoáng',
    tagline: 'Hào phóng và tận hưởng — ngài biến tiền thành trải nghiệm sống.',
    strengths: ['Rộng rãi, được quý mến', 'Biết tận hưởng hiện tại — điều nhiều người không dám'],
    blindspots: ['Đệm khẩn cấp mỏng, dễ hụt khi có biến', 'Mục tiêu dài hạn hay bị hiện tại "mượn trước"'],
    defaultActions: [
      'Tự động hoá: trích tiết kiệm NGAY khi nhận tiền, phần còn lại tiêu thoải mái không áy náy',
      'Đặt 1 quỹ khẩn cấp nhỏ (bắt đầu 1 tháng chi tiêu) — vẫn vui nhưng có đệm',
    ],
    defaultMindsetShift: 'Tận hưởng bền nhất là tận hưởng có đệm — lo cho "mình của 6 tháng sau" cũng là một món quà.',
  },
  avoider: {
    id: 'avoider',
    icon: '🙈',
    label: 'Người Né Tránh',
    tagline: 'Nhẹ nhõm và không tham lam — ngài không để tiền điều khiển cảm xúc.',
    strengths: ['Không bị tiền ám ảnh, ít so đo', 'Khi đã nhìn thẳng, tiến bộ rất nhanh vì không cầu toàn'],
    blindspots: ['Không nhìn nên không kiểm soát — rò rỉ âm thầm', 'Nợ/hoá đơn dễ phình to trong "vùng mù"'],
    defaultActions: [
      'Mỗi tối chỉ ghi đúng 1 dòng chi tiêu — không cần đủ, không cần đúng tuyệt đối',
      'Đặt 1 buổi 15 phút/tuần "nhìn tiền cùng quản gia" — nhìn thôi, chưa cần sửa',
    ],
    defaultMindsetShift: 'Nhìn vào tiền không đau như ngài nghĩ — thứ đáng sợ là vùng mù, không phải con số.',
  },
  builder: {
    id: 'builder',
    icon: '🏗️',
    label: 'Người Kiến Tạo',
    tagline: 'Tư duy tăng trưởng — ngài nhìn tiền như hạt giống, không phải chiếc lá.',
    strengths: ['Tài sản có xu hướng sinh sôi theo thời gian', 'Chủ động học và tối ưu liên tục'],
    blindspots: ['Dễ liều với đòn bẩy/kèo mới khi quá tự tin', 'Mải xây tương lai mà quên hưởng hiện tại'],
    defaultActions: [
      'Quy tắc "đệm trước, kèo sau": đủ 3–6 tháng dự phòng rồi mới tăng khẩu vị rủi ro',
      'Lên lịch 1 khoản chi "vô ích nhưng vui" mỗi tháng — hiện tại cũng là tài sản',
    ],
    defaultMindsetShift: 'Tăng trưởng bền cần cả phanh lẫn ga — người kiến tạo giỏi nhất là người còn trụ lại sau sai lầm.',
  },
  status: {
    id: 'status',
    icon: '👑',
    label: 'Người Thể Diện',
    tagline: 'Động lực mạnh mẽ — ngài dám chi để khẳng định giá trị của mình.',
    strengths: ['Động lực kiếm tiền rất cao, dám đầu tư cho hình ảnh', 'Quyết đoán, không ngại chi cho thứ xứng đáng'],
    blindspots: ['Giá trị bản thân dễ bị buộc vào vật chất', 'Chi để "bằng người" dễ vượt xa khả năng thật'],
    defaultActions: [
      'Trước món đồ "khẳng định mình" > 1 triệu: chờ 48 giờ rồi quyết — vẫn muốn thì mua',
      'Chuyển 1 phần ngân sách hình ảnh sang thứ tăng giá trị THẬT (kỹ năng, sức khoẻ)',
    ],
    defaultMindsetShift: 'Giá trị của ngài không nằm ở món đồ đang đeo — thứ người khác nể lâu dài là nội lực và sự vững vàng.',
  },
};

export type DnaScores = Record<DnaPersonaId, number>;

export interface DnaPersonaResult {
  /** Persona chính. */
  primary: DnaPersonaProfile;
  /** Persona phụ khi lai (2 nhóm sát điểm). */
  secondary?: DnaPersonaProfile;
  isHybrid: boolean;
  /** Nhãn lai, vd "Người Canh Giữ × Người Né Tránh". */
  hybridLabel?: string;
  /** Điểm 0–100 từng persona (chuẩn hoá theo tổng trọng số đã chấm). */
  scores: DnaScores;
  /** Số câu đã trả lời hợp lệ. */
  answeredCount: number;
}

const EMPTY_SCORES: DnaScores = { guardian: 0, spender: 0, avoider: 0, builder: 0, status: 0 };

/** Chênh lệch điểm tối đa (trên thang 0–100) để coi là lai — đồng bộ classifyCapacity. */
const HYBRID_MARGIN = 15;

/**
 * Cộng trọng số các đáp án → điểm thô, rồi chuẩn hoá 0–100 theo TỔNG điểm đã chấm
 * (share of voice — trả lời ít câu vẫn so sánh được giữa các persona).
 */
export function scoreDnaAnswers(answersInput: DnaAnswer[]): { scores: DnaScores; answeredCount: number } {
  const answers = sanitizeDnaAnswers(answersInput);
  const raw: DnaScores = { ...EMPTY_SCORES };
  for (const a of answers) {
    const q = DNA_QUESTIONS.find((x) => x.id === a.questionId);
    const o = q?.options.find((x) => x.id === a.optionId);
    if (!o) continue;
    for (const pid of DNA_PERSONA_IDS) {
      raw[pid] += o.weights[pid] ?? 0;
    }
  }
  const total = DNA_PERSONA_IDS.reduce((s, pid) => s + raw[pid], 0);
  if (total <= 0) return { scores: { ...EMPTY_SCORES }, answeredCount: answers.length };
  const scores = { ...EMPTY_SCORES };
  for (const pid of DNA_PERSONA_IDS) {
    scores[pid] = Math.round((raw[pid] / total) * 100);
  }
  return { scores, answeredCount: answers.length };
}

/**
 * Persona chính (+ lai). Null khi chưa trả lời câu nào chấm được điểm.
 * Tie-break ổn định: điểm bằng nhau → theo thứ tự DNA_PERSONA_IDS (deterministic).
 */
export function resolveDnaPersona(answersInput: DnaAnswer[]): DnaPersonaResult | null {
  const { scores, answeredCount } = scoreDnaAnswers(answersInput);
  const ranked = [...DNA_PERSONA_IDS].sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0];
  if (scores[top] <= 0) return null;

  const second = ranked[1];
  const isHybrid = scores[second] > 0 && scores[top] - scores[second] <= HYBRID_MARGIN;
  const primary = DNA_PERSONAS[top];
  const secondary = isHybrid ? DNA_PERSONAS[second] : undefined;

  return {
    primary,
    secondary,
    isHybrid,
    hybridLabel: secondary ? `${primary.label} × ${secondary.label}` : undefined,
    scores,
    answeredCount,
  };
}

/** Persona SƠ BỘ từ 4 câu teaser (0 token) — lọc bỏ câu ngoài teaser cho chắc. */
export function resolveTeaserPersona(answersInput: DnaAnswer[]): DnaPersonaResult | null {
  const teaserIds = new Set(DNA_QUESTIONS.filter((q) => q.teaser).map((q) => q.id));
  return resolveDnaPersona(sanitizeDnaAnswers(answersInput).filter((a) => teaserIds.has(a.questionId)));
}
