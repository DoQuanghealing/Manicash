/* ═══ AI Money Chat — Intent Patterns (Phase 1) ═══
 * Bộ luật rule-based cho classifier. Mỗi pattern = 1 intent classifiable.
 *
 * QUY ƯỚC QUAN TRỌNG: keyword & regex ở đây viết bằng TIẾNG VIỆT KHÔNG DẤU
 * (ASCII fold). Lý do:
 *  - Người Việt chat thường gõ KHÔNG dấu ("con bao nhieu tien").
 *  - classifier normalize input về dạng fold dấu (NFD strip + đ->d) trước khi
 *    match, GIỐNG hệt parser.ts hiện có. Nhờ vậy "tiền điện" và "tien dien"
 *    đều khớp keyword 'dien'.
 *
 * FOLLOW_UP và UNKNOWN KHÔNG có pattern ở đây:
 *  - FOLLOW_UP: detect bằng heuristic ("tai sao", "do", "no"...) tại route — Phase 4.
 *  - UNKNOWN: là kết quả mặc định khi không pattern nào vượt ngưỡng.
 */

import type { ChatIntentType, IntentPipeline } from './types';

export interface IntentPattern {
  /** Intent mà pattern này nhận diện. */
  type: ChatIntentType;
  /**
   * Mảng regex BẮT BUỘC khớp (chạy trên text đã fold dấu).
   * Tất cả phải pass thì pattern mới được chấm điểm. Để trống nếu chỉ dựa keyword.
   */
  mustMatch?: RegExp[];
  /** Túi từ khóa — mỗi keyword (substring) xuất hiện cộng 1 hit. */
  keywords: string[];
  /** Trọng số intent: intent càng đặc thù càng cao (0.9 - 1.1). */
  weight: number;
  /** Pipeline xử lý sau khi phân loại. */
  pipeline: IntentPipeline;
}

/**
 * Thứ tự không ảnh hưởng kết quả (classifier dùng argmax theo score),
 * nhưng nhóm theo pipeline cho dễ đọc.
 */
export const INTENT_PATTERNS: IntentPattern[] = [
  // ─────────────── Deterministic ───────────────
  {
    // Nhập liệu: bắt buộc có CON SỐ trong câu (50k, 20tr, 1300...).
    type: 'LOG_TRANSACTION',
    mustMatch: [/\d/],
    keywords: ['mua', 'nhan', 'tra', 'luong', 'thanh toan', 'chi'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_BALANCE',
    keywords: ['con bao nhieu', 'so du', 'bao nhieu tien', 'tien con'],
    weight: 0.95,
    pipeline: 'deterministic',
  },
  {
    // Bất kỳ câu nhắc tới một loại bill -> intent bill (handler tự quyết liệt kê/tổng/cụ thể).
    // Bắt cả "tiền điện đóng chưa", "còn bill nào chưa đóng", "tổng bill bao nhiêu".
    type: 'QUERY_BILL_STATUS',
    mustMatch: [/(bill|hoa don|dien|nuoc|internet|wifi|thue nha|tien nha|nha tro|tra gop|tien hoc|dien thoai)/],
    keywords: ['bill', 'hoa don', 'chua', 'roi', 'dong', 'thanh toan', 'bao nhieu', 'con', 'tong', 'tra', 'xong'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    // "tháng này tôi thu/kiếm bao nhiêu" — thu nhập theo period.
    type: 'QUERY_INCOME',
    keywords: ['thu nhap', 'kiem duoc', 'da thu', 'thu bao nhieu', 'kiem bao nhieu', 'thu duoc bao nhieu', 'tien luong', 'thu nhap thang'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    // "danh mục nào vượt ngân sách", "còn bao nhiêu ngân sách"
    type: 'QUERY_BUDGET_STATUS',
    keywords: ['ngan sach', 'vuot nguong', 'vuot ngan sach', 'vuot budget', 'con bao nhieu ngan sach', 'bao nhieu ngan sach', 'sap lo', 'vuot', 'budget', 'han muc'],
    weight: 1.1,
    pipeline: 'deterministic',
  },
  {
    // "ăn uống tháng này xài bao nhiêu" — chỉ fire khi câu NÊU TÊN danh mục.
    // KHÔNG dùng \ban\b trần (sẽ dính "an toàn" của safe-to-spend).
    type: 'QUERY_CATEGORY_SPENDING',
    mustMatch: [/\ban uong\b|\bca phe\b|cafe|di chuyen|\bxang\b|mua sam|shopping|giai tri|suc khoe|sieu thi|di cho/],
    keywords: ['xai bao nhieu', 'chi bao nhieu', 'het bao nhieu', 'da chi', 'tieu bao nhieu', 'con bao nhieu', 'ngan sach', 'bao nhieu'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_SAVINGS',
    keywords: ['tiet kiem', 'de danh', 'tich luy'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    // "tháng này còn bao nhiêu để xài" / "mỗi ngày nên tiêu bao nhiêu" / "còn tiêu an toàn"
    type: 'QUERY_SAFE_TO_SPEND',
    mustMatch: [/(con|duoc|de).*(xai|tieu|chi|spend)|(moi|mot)\s*ngay|nen (tieu|xai|chi)|tieu an toan/],
    keywords: ['de xai', 'con xai', 'thoai mai', 'con bao nhieu de', 'moi ngay', 'nen tieu', 'tieu an toan', 'an toan'],
    weight: 0.95,
    pipeline: 'deterministic',
  },
  {
    // "hôm nay/tháng này đã chi bao nhiêu", "tiêu hết bao nhiêu"
    type: 'QUERY_SPENDING',
    keywords: ['da chi', 'chi bao nhieu', 'chi tieu', 'tieu het', 'tieu bao nhieu', 'chi het', 'da tieu'],
    weight: 0.95,
    pipeline: 'deterministic',
  },
  {
    // Tasks: BẮT BUỘC có từ ngữ liên quan công việc -> tránh "hôm nay" dính nhầm
    // câu chi tiêu ("hôm nay tôi chi bao nhiêu").
    type: 'QUERY_TASKS_TODAY',
    mustMatch: [/viec|nhiem vu|task|lam gi|lam them|cong viec|tre han|dang lam/],
    keywords: ['hom nay', 'viec gi', 'nhiem vu', 'lam gi', 'task', 'tre han', 'dang lam'],
    weight: 0.95,
    pipeline: 'deterministic',
  },
  {
    // "nếu làm hết task thì có thêm bao nhiêu" — pipeline thu nhập kỳ vọng.
    type: 'QUERY_EARNING_PIPELINE',
    keywords: ['pipeline', 'kiem them', 'lam het task', 'hoan thanh het', 'them bao nhieu', 'du kien thu', 'tong thu nhap du kien', 'lam het'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_GOAL_PROGRESS',
    keywords: ['muc tieu', 'goal', 'toi dau', 'tien do', 'quy khan cap', 'mua nha', 'mua xe', 'con thieu bao nhieu', 'phan tram'],
    weight: 0.9,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_HEALTH_SCORE',
    keywords: ['suc khoe tai chinh', 'health score', 'diem tai chinh', 'diem suc khoe', 'suc khoe'],
    weight: 1.1,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_STREAK',
    keywords: ['streak', 'chuoi ngay', 'chuoi ghi', 'khien', 'shield', 'chuoi'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  // ─────────────── Stochastic (LLM) ───────────────
  {
    type: 'CFO_REPORT',
    keywords: ['bao cao', 'report', 'cfo', 'tong ket thang'],
    weight: 1.1,
    pipeline: 'llm',
  },
  {
    type: 'ANALYZE_FINANCE',
    keywords: ['phan tich', 'danh gia', 'nang luc tai chinh', 'nhan xet'],
    weight: 1.0,
    pipeline: 'llm',
  },
  {
    type: 'ADVICE_CUT_SPENDING',
    keywords: ['cat giam', 'goi y', 'tiet kiem them', 'toi uu'],
    weight: 1.0,
    pipeline: 'llm',
  },
];

/**
 * Stop-words tiếng Việt (đã fold dấu) — loại khỏi câu trước khi match.
 * Giữ danh sách NGẮN và an toàn: chỉ các hư từ thật sự vô nghĩa, tránh xóa
 * nhầm từ mang tín hiệu (vd KHÔNG bỏ "do", "no" vì cần cho FOLLOW_UP ở Phase 4).
 *
 * CHÚ Ý collision do fold dấu: KHÔNG bỏ "toi" — vì "tới" (đến) fold cũng ra
 * "toi" giống "tôi", bỏ đi sẽ nuốt mất tín hiệu "tới đâu" của QUERY_GOAL_PROGRESS.
 */
export const STOP_WORDS = new Set<string>([
  'minh',
  'la',
  'co',
  'va',
  'cua',
  'cho',
  'thi',
  'nhe',
  'a',
  'oi',
  'voi',
  'cai',
]);

/** Tra cứu pipeline mặc định theo intent type (UNKNOWN/FOLLOW_UP -> deterministic). */
export function getPatternPipeline(type: ChatIntentType): IntentPipeline {
  const pattern = INTENT_PATTERNS.find((p) => p.type === type);
  return pattern?.pipeline ?? 'deterministic';
}
