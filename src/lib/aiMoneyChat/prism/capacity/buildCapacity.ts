/* ═══ PRISM — La Bàn Năng Lực: adapter raw signal -> components (P5) ═══
 *
 * Chuẩn hóa tín hiệu thô (từ store/snapshot local) về sub-score 0–100, kèm danh
 * sách `pending` (việc cần làm để đo CHÍNH XÁC hơn — survey/AI chưa có ở offline).
 * Thuần (pure) — component chỉ gom số thô rồi gọi hàm này.
 */

import type { CapacityComponents } from './capacityEngine';

/** Tín hiệu thô gom từ dữ liệu local. -1 = "chưa khai/chưa đo" (dùng default). */
export interface CapacityRawSignals {
  // FDS
  daysLoggedLast30: number; // 0..30
  budgetTotal: number; // số danh mục có ngân sách
  budgetWithin: number; // số danh mục không vượt
  goalsTotal: number;
  goalsFunded: number; // goals có savedAmount > 0
  streakDays: number;
  // TAS
  chatUserMessages: number; // proxy AI Interaction
  featuresUsed: number; // số tính năng đã dùng
  featuresTotal: number;
  onboardingDone: number; // 0..onboardingTotal (-1 nếu chưa đo)
  onboardingTotal: number;
  // IPS
  skillsDeclared: number; // survey (-1 nếu chưa khai)
  earningTasksTotal: number;
  earningTasksCompleted: number;
  freeTimeHoursPerWeek: number; // survey (-1 nếu chưa khai)
  // MMS
  emergencyFundMonths: number; // emergency / chi tháng (-1 nếu chưa tính được)
  cfoReportViews: number; // proxy Investment Mindset
}

export interface CapacityBuildResult {
  components: CapacityComponents;
  /** Việc cần làm để đo chính xác hơn (hiển thị dưới thẻ). */
  pending: string[];
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}
function cap(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (value / target) * 100));
}

export function buildCapacityComponents(raw: CapacityRawSignals): CapacityBuildResult {
  const pending: string[] = [];

  // ── FDS ──
  const loggingConsistency = pct(raw.daysLoggedLast30, 30);
  let budgetAdherence: number;
  if (raw.budgetTotal > 0) {
    budgetAdherence = pct(raw.budgetWithin, raw.budgetTotal);
  } else {
    budgetAdherence = 50;
    pending.push('Đặt ngân sách danh mục');
  }
  let goalCommitment: number;
  if (raw.goalsTotal > 0) {
    goalCommitment = pct(raw.goalsFunded, raw.goalsTotal);
  } else {
    // Chưa đặt mục tiêu = "chưa đo", KHÔNG phải thất bại -> default trung tính.
    goalCommitment = 40;
    pending.push('Tạo & nạp mục tiêu lớn');
  }
  const streakMaintenance = cap(raw.streakDays, 30);

  // ── TAS ──
  const aiInteraction = cap(raw.chatUserMessages, 40);
  const featureExploration = pct(raw.featuresUsed, raw.featuresTotal);
  let onboardingSpeed: number;
  if (raw.onboardingTotal > 0 && raw.onboardingDone >= 0) {
    onboardingSpeed = pct(raw.onboardingDone, raw.onboardingTotal);
  } else {
    onboardingSpeed = 50;
  }

  // ── IPS ──
  let skillDiversity: number;
  if (raw.skillsDeclared >= 0) {
    skillDiversity = cap(raw.skillsDeclared, 5);
  } else {
    skillDiversity = 30;
    pending.push('Khai báo kỹ năng của ngài');
  }
  let earningTaskCompletion: number;
  if (raw.earningTasksTotal > 0) {
    earningTaskCompletion = pct(raw.earningTasksCompleted, raw.earningTasksTotal);
  } else {
    // Chưa có earning task = "chưa đo" -> default trung tính (đồng nhất với các field khác).
    earningTaskCompletion = 40;
    pending.push('Tạo nhiệm vụ kiếm tiền (Earning Task)');
  }
  let freeTimeAvailability: number;
  if (raw.freeTimeHoursPerWeek >= 0) {
    freeTimeAvailability = cap(raw.freeTimeHoursPerWeek, 40);
  } else {
    freeTimeAvailability = 50;
    pending.push('Khai báo quỹ thời gian rảnh');
  }

  // ── MMS ──
  let emergencyFundRatio: number;
  if (raw.emergencyFundMonths >= 0) {
    emergencyFundRatio = cap(raw.emergencyFundMonths, 6); // 6 tháng = 100
  } else {
    emergencyFundRatio = 30;
    pending.push('Lập quỹ khẩn cấp');
  }
  const investmentMindset = cap(raw.cfoReportViews, 10);
  // Growth Orientation = phần đánh giá AI qua hội thoại -> để dành P6 (Oracle).
  const growthOrientation = 50;
  pending.push('Mở khóa nhận xét AI Oracle (Pro) để đo Tư duy Tăng trưởng');

  return {
    components: {
      loggingConsistency,
      budgetAdherence,
      goalCommitment,
      streakMaintenance,
      aiInteraction,
      featureExploration,
      onboardingSpeed,
      skillDiversity,
      earningTaskCompletion,
      freeTimeAvailability,
      emergencyFundRatio,
      investmentMindset,
      growthOrientation,
    },
    pending,
  };
}
