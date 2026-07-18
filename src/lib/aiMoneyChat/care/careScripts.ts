/* ═══ Care Companion — 10 kịch bản chăm sóc (Cấp 3 · Phú Vương · 0đ API) ═══
 * PURE + deterministic. KHÔNG token: text là template có sẵn, trigger tính từ snapshot.
 *
 * Ràng buộc ETHICS_CHARTER (xem docs/BUTLER_TIERS_AND_API_COST_PLAN.md §9):
 *  - Tối đa 1 kịch bản/ngày, mỗi kịch bản cooldown ≥3 ngày (gate ở useCareStore).
 *  - Bỏ qua = lùi không nài. Hành động = ĐIỀU HƯỚNG, KHÔNG tự đổi tiền.
 *  - Xưng hô theo honorific user chọn (mặc định "ngài") — không giả định giới tính.
 *
 * File này CHỈ giữ NỘI DUNG (content). Logic "kịch bản nào nổ" ở careTriggers.ts.
 */

export type CareScriptId =
  | 'comeback'      // quay lại sau ≥7 ngày vắng
  | 'bill-mosquito' // bill quá hạn ≥2 ngày
  | 'ghost-3d'      // 3–6 ngày không ghi chép
  | 'payday-guard'  // ≤48h sau lương đã tiêu >30%
  | 'streak-save'   // 23h chưa ghi, streak ≥5 sắp gãy
  | 'sad-guard'     // chi ăn uống/giải trí sau 22h
  | 'task-nudge'    // nhiệm vụ kiếm tiền trễ ≥3 ngày
  | 'night-owl'     // ghi chi tiêu sau 0h
  | 'goal-cheer'    // mục tiêu chạm mốc 50%
  | 'sunday-report';// chủ nhật 19–21h

/** Minigame client (framer-motion, 0đ). null = không có minigame. */
export type CareMinigame = 'squash-roach' | 'squash-mosquito' | 'squash-lazy' | null;

export type CareTone = 'tease' | 'warm' | 'cheer' | 'nudge';

export interface CareAction {
  /** Nút chính — điều hướng (KHÔNG tự đổi tiền). Bỏ trống = chỉ có nút "đã hiểu". */
  label: string;
  /** Route điều hướng khi bấm nút chính. Bỏ trống = chỉ đóng thẻ. */
  target?: string;
  /** Nhãn nút phụ (lùi không nài). */
  dismissLabel: string;
}

export interface CareScript {
  id: CareScriptId;
  /** Ưu tiên giảm dần — component chỉ hiện kịch bản đầu. */
  priority: number;
  emoji: string;
  tone: CareTone;
  title: string;
  body: string;
  minigame: CareMinigame;
  action: CareAction;
}

/** Metadata cố định mỗi kịch bản (không phụ thuộc dữ liệu). */
export const CARE_SCRIPT_META: Record<
  CareScriptId,
  { priority: number; emoji: string; tone: CareTone; minigame: CareMinigame }
> = {
  comeback:        { priority: 95, emoji: '☕', tone: 'warm',  minigame: null },
  'bill-mosquito': { priority: 92, emoji: '🦟', tone: 'nudge', minigame: 'squash-mosquito' },
  'ghost-3d':      { priority: 85, emoji: '📒', tone: 'tease', minigame: 'squash-lazy' },
  'payday-guard':  { priority: 80, emoji: '🏦', tone: 'nudge', minigame: null },
  'streak-save':   { priority: 75, emoji: '🕯️', tone: 'nudge', minigame: null },
  'sad-guard':     { priority: 70, emoji: '🪳', tone: 'tease', minigame: 'squash-roach' },
  'task-nudge':    { priority: 65, emoji: '⏰', tone: 'nudge', minigame: null },
  'night-owl':     { priority: 60, emoji: '🌙', tone: 'warm',  minigame: null },
  'goal-cheer':    { priority: 40, emoji: '🍾', tone: 'cheer', minigame: null },
  'sunday-report': { priority: 30, emoji: '📊', tone: 'warm',  minigame: null },
};

export function money(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString('vi-VN')}đ`;
}

/** Dữ liệu động để chèn vào body (mỗi kịch bản dùng phần nó cần). */
export interface CareContentInput {
  addr: string;
  billName?: string;
  billAmount?: number;
  daysAway?: number;
  spentPct?: number;
  streak?: number;
  goalName?: string;
  taskName?: string;
  taskLateDays?: number;
  weekIncome?: number;
  weekExpense?: number;
}

/**
 * Dựng title + body cho một kịch bản (PURE). Tách khỏi trigger để test nội dung riêng
 * và để trigger chỉ lo "nổ hay không".
 */
export function buildCareScript(id: CareScriptId, input: CareContentInput): CareScript {
  const meta = CARE_SCRIPT_META[id];
  const { title, body, action } = CONTENT[id](input);
  return { id, ...meta, title, body, action };
}

type ContentFn = (i: CareContentInput) => { title: string; body: string; action: CareAction };

const CONTENT: Record<CareScriptId, ContentFn> = {
  comeback: (i) => ({
    title: 'Mừng người trở lại',
    body: `${i.addr}! Ta lau bụi két sắt mỗi ngày chờ người về suốt ${i.daysAway ?? 7} ngày qua. Kể ta nghe hôm nay ${i.addr} tiêu gì nào ☕`,
    action: { label: 'Ghi khoản đầu tiên', target: '/input', dismissLabel: 'Để lát nữa' },
  }),
  'bill-mosquito': (i) => ({
    title: 'Con muỗi hoá đơn vo ve',
    body: `Con muỗi "${i.billName ?? 'hoá đơn'}" vo ve mấy hôm rồi, mỗi lần hút ${money(i.billAmount ?? 0)} máu của ${i.addr}. Đập nó chứ?`,
    action: { label: 'Đập nó = đi thanh toán', target: '/ledger?tab=bills', dismissLabel: 'Nuôi thêm hôm nữa' },
  }),
  'ghost-3d': (i) => ({
    title: 'Ai bắt cóc chủ nhân của ta?',
    body: `${i.daysAway ?? 3} ngày ${i.addr} không đụng sổ sách. Tên "Lười Biếng" nào đã bắt cóc ${i.addr} của ta rồi? Để ta lập biên bản 📜`,
    action: { label: 'Đập hắn = ghi ngay', target: '/input', dismissLabel: 'Ta bận thật mà 😅' },
  }),
  'payday-guard': (i) => ({
    title: 'Tiền chạy nhanh hơn ta đuổi',
    body: `Lương vừa về mà đã bay ${i.spentPct ?? 30}%… tiền chạy nhanh hơn cả ta đuổi. Cho ta dựng hàng rào ngân sách cho ${i.addr} nhé?`,
    action: { label: 'Đặt rào ngân sách', target: '/ledger?tab=categories', dismissLabel: 'Kệ ta 😎' },
  }),
  'streak-save': (i) => ({
    title: 'Chuỗi ghi chép đang run rẩy',
    body: `Chuỗi ${i.streak ?? 5} ngày của ${i.addr} đang run rẩy bên bờ vực. Ta không muốn viết cáo phó cho nó đâu 🕯️ — ghi nhanh một khoản là cứu được.`,
    action: { label: 'Ghi nhanh cứu chuỗi', target: '/input', dismissLabel: 'Cứ để nó gãy' },
  }),
  'sad-guard': (i) => ({
    title: 'Tên sở khanh nào làm chủ nhân buồn?',
    body: `Đêm khuya mà ${i.addr} còn chi cho ăn uống/giải trí… Hôm nay tên sở khanh nào làm ${i.addr} không vui hay sao mà quên mất vượng tài rồi? Để ta xử lý hắn cho.`,
    action: { label: 'Xử lý sở khanh cho ta', dismissLabel: 'Không có gì đâu' },
  }),
  'task-nudge': (i) => ({
    title: 'Deadline không đập được như con gián',
    body: `Nhiệm vụ "${i.taskName ?? 'kiếm tiền'}" trễ ${i.taskLateDays ?? 3} ngày rồi. Deadline không đập được như con gián đâu ${i.addr} ạ. Ta chia nhỏ giúp nhé?`,
    action: { label: 'Xem nhiệm vụ', target: '/money', dismissLabel: 'Hoãn thêm chút' },
  }),
  'night-owl': (i) => ({
    title: 'Ví tiền và sức khoẻ đang thức khuya',
    body: `Khuya lắc mà còn ghi chi tiêu? Ví tiền và sức khoẻ của ${i.addr} đang rủ nhau thức khuya đấy 🌙 Ngủ sớm, mai ta soát sổ cùng.`,
    action: { label: 'Đã hiểu', dismissLabel: 'Đóng' },
  }),
  'goal-cheer': (i) => ({
    title: 'Nửa đường rồi!',
    body: `Nửa đường rồi! Quỹ "${i.goalName ?? 'mục tiêu'}" của ${i.addr} đã chạm 50%. Ta ướp sẵn sâm-panh ảo 🍾 — nửa còn lại ta cá ${i.addr} xong sớm thôi.`,
    action: { label: 'Xem mục tiêu', target: '/goals', dismissLabel: 'Tuyệt, cảm ơn ta' },
  }),
  'sunday-report': (i) => ({
    title: 'Tổng kết chủ nhật',
    body: `Tuần này ${i.addr} tiêu ${money(i.weekExpense ?? 0)}, kiếm ${money(i.weekIncome ?? 0)} — đội "Kiếm" và đội "Tiêu" đang so kè. Muốn nghe chiến thuật tuần sau không?`,
    action: { label: 'Nghe chiến thuật', target: '/report', dismissLabel: 'Để tuần sau' },
  }),
};
