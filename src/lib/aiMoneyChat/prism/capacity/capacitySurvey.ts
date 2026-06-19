/* ═══ PRISM — Khảo sát năng lực (P6a, offline) ═══
 *
 * Lấp các input KHẢO SÁT mà P5 còn để `pending` (kỹ năng khai báo + thời gian
 * rảnh) → tăng độ chính xác của IPS. Thuần (pure) + offline 100%. KHÔNG AI.
 */

export interface SkillOption {
  id: string;
  label: string;
  icon: string;
}

/** Kỹ năng/thế mạnh khai báo — ánh xạ tiềm năng thu nhập (IPS · Skill Diversity). */
export const SKILL_OPTIONS: SkillOption[] = [
  { id: 'writing', label: 'Viết lách', icon: '✍️' },
  { id: 'design', label: 'Thiết kế', icon: '🎨' },
  { id: 'coding', label: 'Lập trình', icon: '💻' },
  { id: 'sales', label: 'Bán hàng', icon: '🤝' },
  { id: 'teaching', label: 'Giảng dạy', icon: '📚' },
  { id: 'video', label: 'Video/Edit', icon: '🎬' },
  { id: 'marketing', label: 'Marketing', icon: '📣' },
  { id: 'language', label: 'Ngoại ngữ', icon: '🌐' },
  { id: 'handcraft', label: 'Thủ công', icon: '🧵' },
  { id: 'ops', label: 'Quản lý/Vận hành', icon: '🗂️' },
  { id: 'counsel', label: 'Tư vấn/Chữa lành', icon: '💬' },
  { id: 'finance', label: 'Tài chính/Kế toán', icon: '📊' },
];

const SKILL_IDS = new Set(SKILL_OPTIONS.map((s) => s.id));

export interface FreeTimeOption {
  /** Giờ rảnh đại diện/tuần (đưa vào engine). */
  hours: number;
  label: string;
}

/** Quỹ thời gian rảnh/tuần (IPS · Free Time Availability). */
export const FREE_TIME_OPTIONS: FreeTimeOption[] = [
  { hours: 3, label: 'Dưới 5 giờ/tuần' },
  { hours: 8, label: '5–10 giờ/tuần' },
  { hours: 15, label: '10–20 giờ/tuần' },
  { hours: 30, label: 'Trên 20 giờ/tuần' },
];

export interface CapacitySurveyAnswers {
  /** Danh sách id kỹ năng đã chọn. */
  skills: string[];
  /** Giờ rảnh/tuần; -1 = chưa trả lời. */
  freeTimeHoursPerWeek: number;
  /** ISO khi lưu khảo sát (có = đã hoàn thành ít nhất 1 lần). */
  completedAt?: string;
}

export const EMPTY_SURVEY: CapacitySurveyAnswers = {
  skills: [],
  freeTimeHoursPerWeek: -1,
};

/** Đã khai khảo sát chưa (đủ để dùng cho engine thay vì default). */
export function isSurveyComplete(a: CapacitySurveyAnswers | null | undefined): boolean {
  if (!a || !a.completedAt) return false;
  return a.skills.length > 0 || a.freeTimeHoursPerWeek >= 0;
}

/** Lọc/khử trùng kỹ năng hợp lệ. */
export function sanitizeSkills(skills: string[]): string[] {
  return Array.from(new Set(skills.filter((s) => SKILL_IDS.has(s))));
}

export interface SurveySignals {
  /** Số kỹ năng khai báo; -1 nếu chưa khảo sát. */
  skillsDeclared: number;
  /** Giờ rảnh/tuần; -1 nếu chưa khảo sát. */
  freeTimeHoursPerWeek: number;
}

/** Chuyển câu trả lời khảo sát -> tín hiệu thô cho adapter năng lực. */
export function surveyToSignals(a: CapacitySurveyAnswers | null | undefined): SurveySignals {
  if (!isSurveyComplete(a)) {
    return { skillsDeclared: -1, freeTimeHoursPerWeek: -1 };
  }
  return {
    skillsDeclared: sanitizeSkills(a!.skills).length,
    freeTimeHoursPerWeek: a!.freeTimeHoursPerWeek >= 0 ? a!.freeTimeHoursPerWeek : -1,
  };
}
