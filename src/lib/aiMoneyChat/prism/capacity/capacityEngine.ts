/* ═══ PRISM (Lõi Kim Cương) — La Bàn Năng Lực: engine (P5) ═══
 *
 * 4 chỉ số (0–100) theo Weighted Scoring (docs/CAPACITY_LOGIC_SPEC.md):
 *   FDS Kỷ luật · TAS Công nghệ · IPS Tiềm năng thu nhập · MMS Tư duy thịnh vượng.
 * 80% deterministic (tính từ dữ liệu local). Phân nhóm nghề theo PHÂN PHỐI điểm
 * (nhận diện Hybrid). 20% nhận xét "có hồn" để dành P6 (Oracle/AI, cần mạng+credit).
 *
 * Thuần (pure) + offline 100%.
 */

/** Sub-score thành phần, MỖI cái đã chuẩn hóa 0–100 (adapter lo việc chuẩn hóa). */
export interface CapacityComponents {
  // FDS
  loggingConsistency: number;
  budgetAdherence: number;
  goalCommitment: number;
  streakMaintenance: number;
  // TAS
  aiInteraction: number;
  featureExploration: number;
  onboardingSpeed: number;
  // IPS
  skillDiversity: number;
  earningTaskCompletion: number;
  freeTimeAvailability: number;
  // MMS
  emergencyFundRatio: number;
  investmentMindset: number;
  growthOrientation: number;
}

export interface CapacityScores {
  FDS: number;
  TAS: number;
  IPS: number;
  MMS: number;
}

export type CapacityGroupId =
  | 'creator'
  | 'expert'
  | 'coach'
  | 'automation'
  | 'general';

export interface CapacityClassification {
  groupId: CapacityGroupId;
  label: string;
  tagline: string;
  /** Gợi ý hướng đi (cho recommendation/Coach ở P6). */
  suggestions: string[];
  isHybrid: boolean;
  /** Nhãn lai khi 2 nhóm cùng mạnh (vd "Nhà Khai vấn × Chuyên gia Số"). */
  hybridLabel?: string;
}

/** Kết quả đo năng lực hoàn chỉnh — render trong thẻ chat (P5). */
export interface CapacityResult {
  scores: CapacityScores;
  classification: CapacityClassification;
  /** Việc cần làm để đo chính xác hơn (survey/AI chưa có offline). */
  pending: string[];
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Tính 4 chỉ số từ sub-score thành phần (đã chuẩn hóa 0–100). */
export function computeCapacity(c: CapacityComponents): CapacityScores {
  const fds =
    c.loggingConsistency * 0.4 +
    c.budgetAdherence * 0.3 +
    c.goalCommitment * 0.2 +
    c.streakMaintenance * 0.1;
  const tas =
    c.aiInteraction * 0.5 + c.featureExploration * 0.3 + c.onboardingSpeed * 0.2;
  const ips =
    c.skillDiversity * 0.4 +
    c.earningTaskCompletion * 0.4 +
    c.freeTimeAvailability * 0.2;
  const mms =
    c.emergencyFundRatio * 0.4 +
    c.investmentMindset * 0.3 +
    c.growthOrientation * 0.3;
  return {
    FDS: Math.round(clamp100(fds)),
    TAS: Math.round(clamp100(tas)),
    IPS: Math.round(clamp100(ips)),
    MMS: Math.round(clamp100(mms)),
  };
}

interface GroupRule {
  groupId: Exclude<CapacityGroupId, 'general'>;
  label: string;
  tagline: string;
  suggestions: string[];
  primary: number;
  primaryMin: number;
  secondary: number;
  secondaryMin: number;
}

/** Ngưỡng & mô tả nhóm theo docs/CAPACITY_LOGIC_SPEC.md (ma trận phân loại). */
function groupRules(s: CapacityScores): GroupRule[] {
  return [
    {
      groupId: 'automation',
      label: 'Kỹ sư Vận hành',
      tagline: 'Tối ưu hóa & tự động hóa — biến quy trình thành cỗ máy.',
      suggestions: ['AI Automation', 'Setup CRM', 'Workflow tự động'],
      primary: s.TAS, primaryMin: 80, secondary: s.FDS, secondaryMin: 70,
    },
    {
      groupId: 'expert',
      label: 'Chuyên gia Số',
      tagline: 'Đóng gói chuyên môn thành sản phẩm số bán tự động.',
      suggestions: ['E-learning', 'Bán Ebook/Template', 'Landing Page Auto'],
      primary: s.FDS, primaryMin: 70, secondary: s.TAS, secondaryMin: 60,
    },
    {
      groupId: 'coach',
      label: 'Nhà Khai vấn',
      tagline: 'Thấu cảm & dẫn dắt — giúp người khác đi qua hành trình tiền bạc.',
      suggestions: ['Coach tài chính', 'Khai vấn/Chữa lành', 'Mentor 1-1'],
      primary: s.MMS, primaryMin: 70, secondary: s.FDS, secondaryMin: 60,
    },
    {
      groupId: 'creator',
      label: 'Sáng tạo Nội dung',
      tagline: 'Lan tỏa & sáng tạo — dùng AI để nhân bản sức ảnh hưởng.',
      suggestions: ['YouTube AI', 'KOC/TikTok', 'Video giấu mặt'],
      primary: s.TAS, primaryMin: 70, secondary: s.IPS, secondaryMin: 50,
    },
  ];
}

/** Phân loại nhóm nghề theo phân phối điểm (nhận diện Hybrid). */
export function classifyCapacity(s: CapacityScores): CapacityClassification {
  const matched = groupRules(s)
    .filter((g) => g.primary > g.primaryMin && g.secondary > g.secondaryMin)
    .sort((a, b) => b.primary + b.secondary - (a.primary + a.secondary));

  if (matched.length === 0) {
    return {
      groupId: 'general',
      label: 'Người Khai Phá',
      tagline: 'Đang xây nền — dùng app đều tay vài tuần để lộ rõ thế mạnh.',
      suggestions: ['Ghi chép đều mỗi ngày', 'Đặt 1 mục tiêu lớn', 'Thử lệnh /baocao'],
      isHybrid: false,
    };
  }

  const top = matched[0];
  const second = matched[1];
  const isHybrid =
    !!second &&
    Math.abs(top.primary + top.secondary - (second.primary + second.secondary)) <= 15;

  return {
    groupId: top.groupId,
    label: top.label,
    tagline: top.tagline,
    suggestions: top.suggestions,
    isHybrid,
    hybridLabel: isHybrid ? `${top.label} × ${second!.label}` : undefined,
  };
}
