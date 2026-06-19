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

type AxisKey = 'FDS' | 'TAS' | 'IPS' | 'MMS';

interface GroupRule {
  groupId: Exclude<CapacityGroupId, 'general'>;
  label: string;
  tagline: string;
  suggestions: string[];
  primaryKey: AxisKey;
  primaryMin: number;
  secondaryKey: AxisKey;
  secondaryMin: number;
}

/** Ngưỡng & mô tả nhóm theo docs/CAPACITY_LOGIC_SPEC.md (ma trận phân loại). */
const GROUP_RULES: GroupRule[] = [
  {
    groupId: 'automation',
    label: 'Kỹ sư Vận hành',
    tagline: 'Tối ưu hóa & tự động hóa — biến quy trình thành cỗ máy.',
    suggestions: ['AI Automation', 'Setup CRM', 'Workflow tự động'],
    primaryKey: 'TAS', primaryMin: 80, secondaryKey: 'FDS', secondaryMin: 70,
  },
  {
    groupId: 'expert',
    label: 'Chuyên gia Số',
    tagline: 'Đóng gói chuyên môn thành sản phẩm số bán tự động.',
    suggestions: ['E-learning', 'Bán Ebook/Template', 'Landing Page Auto'],
    primaryKey: 'FDS', primaryMin: 70, secondaryKey: 'TAS', secondaryMin: 60,
  },
  {
    groupId: 'coach',
    label: 'Nhà Khai vấn',
    tagline: 'Thấu cảm & dẫn dắt — giúp người khác đi qua hành trình tiền bạc.',
    suggestions: ['Coach tài chính', 'Khai vấn/Chữa lành', 'Mentor 1-1'],
    primaryKey: 'MMS', primaryMin: 70, secondaryKey: 'FDS', secondaryMin: 60,
  },
  {
    groupId: 'creator',
    label: 'Sáng tạo Nội dung',
    tagline: 'Lan tỏa & sáng tạo — dùng AI để nhân bản sức ảnh hưởng.',
    suggestions: ['YouTube AI', 'KOC/TikTok', 'Video giấu mặt'],
    primaryKey: 'TAS', primaryMin: 70, secondaryKey: 'IPS', secondaryMin: 50,
  },
];

/** Tập trục của 1 nhóm (đã sort) — để nhận biết 2 nhóm có cùng "cặp trục" hay không. */
function axisSig(g: GroupRule): string {
  return [g.primaryKey, g.secondaryKey].sort().join('+');
}

/** Nhãn lai có chủ đích cho các cặp nhóm quan trọng (spec: Coach×Tech = lead xịn nhất). */
const HYBRID_NAMES: Record<string, string> = {
  'coach+creator': 'Nhà Khai vấn Công nghệ',
  'automation+coach': 'Nhà Khai vấn Công nghệ',
  'creator+expert': 'Chuyên gia Sáng tạo',
  'automation+creator': 'Kiến trúc sư Nội dung',
};

/** Phân loại nhóm nghề theo phân phối điểm (nhận diện Hybrid trên 2 trục KHÁC nhau). */
export function classifyCapacity(s: CapacityScores): CapacityClassification {
  const scored = GROUP_RULES.map((g) => ({
    rule: g,
    primary: s[g.primaryKey],
    secondary: s[g.secondaryKey],
  }));
  const matched = scored
    .filter((m) => m.primary > m.rule.primaryMin && m.secondary > m.rule.secondaryMin)
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
  const topSig = axisSig(top.rule);
  // Hybrid CHỈ khi nhóm thứ 2 dùng CẶP TRỤC KHÁC (tài năng thật sự khác), không
  // phải cùng cặp TAS+FDS đảo primary/secondary (automation vs expert).
  const second = matched.find((m) => axisSig(m.rule) !== topSig);
  const isHybrid =
    !!second &&
    Math.abs(top.primary + top.secondary - (second.primary + second.secondary)) <= 15;

  let hybridLabel: string | undefined;
  if (isHybrid && second) {
    const key = [top.rule.groupId, second.rule.groupId].sort().join('+');
    hybridLabel = HYBRID_NAMES[key] ?? `${top.rule.label} × ${second.rule.label}`;
  }

  return {
    groupId: top.rule.groupId,
    label: top.rule.label,
    tagline: top.rule.tagline,
    suggestions: top.rule.suggestions,
    isHybrid,
    hybridLabel,
  };
}
