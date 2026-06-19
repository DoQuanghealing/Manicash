/* ═══ PRISM (Lõi Kim Cương) — Người Gác (Proactive Guardian) (P4) ═══
 *
 * Quét tình hình tài chính khi mở chat -> sinh cảnh báo CHỦ ĐỘNG để Lord Diamond
 * "để ý giúp ngài": vượt/sắp vượt ngân sách, bill sắp tới hạn, dòng tiền mỏng,
 * số dư an toàn cạn, lâu không ghi chép.
 *
 * Thuần (pure) + dùng lại 100% hàm `moneyBrain` -> số liệu KHỚP với handler/tab Money.
 * Offline 100%. Component chỉ build MoneySnapshotV1 rồi gọi hàm này.
 */

import type { MoneySnapshotV1 } from '@/lib/moneyBrain';
import {
  getSafeToSpendBreakdown,
  getBudgetCategoryProgress,
  getUpcomingBills,
  getCashRunway,
  getTodayKey,
} from '@/lib/moneyBrain';

export type GuardianSeverity = 'danger' | 'warn' | 'info';

export interface GuardianAlert {
  /** Khóa ổn định (vd 'safe-to-spend', 'budget:food', 'bills', 'runway', 'idle'). */
  id: string;
  severity: GuardianSeverity;
  icon: string;
  title: string;
  message: string;
  /** Câu hỏi gợi ý khi bấm "Xem" -> đi qua PRISM offline. */
  query?: string;
}

export interface GuardianOptions {
  /** Số ngày user không mở chat (idle) — component truyền vào. */
  idleDays?: number;
  /** % ngân sách coi là "sắp vượt" (mặc định 80). */
  nearBudgetPercent?: number;
  /** Số ngày tới hạn bill coi là "sắp" (mặc định 3). */
  billLookaheadDays?: number;
  /** Tối đa số cảnh báo trả về (mặc định 3). */
  limit?: number;
}

const SEVERITY_RANK: Record<GuardianSeverity, number> = { danger: 0, warn: 1, info: 2 };

function vnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

/** Quét snapshot -> danh sách cảnh báo, xếp theo độ nghiêm trọng, cắt theo limit. */
export function detectGuardianAlerts(
  snapshot: MoneySnapshotV1,
  opts: GuardianOptions = {},
): GuardianAlert[] {
  const nearPct = opts.nearBudgetPercent ?? 80;
  const billDays = opts.billLookaheadDays ?? 3;
  const limit = opts.limit ?? 3;
  const alerts: GuardianAlert[] = [];

  // 1) Số dư an toàn để chi. CHỈ cảnh báo khi đã có cơ sở thu nhập — tránh báo
  //    "nguy hiểm" giả trên tài khoản mới/trống (income=0 -> safeToSpend=0 -> danger).
  const sts = getSafeToSpendBreakdown(snapshot);
  const hasIncomeBasis = sts.monthlyIncome > 0 || sts.carryOver > 0;
  if (hasIncomeBasis && sts.status === 'danger') {
    alerts.push({
      id: 'safe-to-spend',
      severity: 'danger',
      icon: '🚨',
      title: 'Vùng nguy hiểm chi tiêu',
      message: `Số dư an toàn tháng này chỉ còn ${vnd(sts.safeToSpend)}đ. Nên phanh chi tự do lại.`,
      query: 'tháng này còn bao nhiêu để xài',
    });
  } else if (hasIncomeBasis && sts.status === 'caution') {
    alerts.push({
      id: 'safe-to-spend',
      severity: 'warn',
      icon: '⚠️',
      title: 'Số dư đang mỏng',
      message: `Còn ~${vnd(sts.safeToSpendPerDay)}đ/ngày cho ${sts.daysLeftInMonth} ngày tới.`,
      query: 'tháng này còn bao nhiêu để xài',
    });
  }

  // 2) Ngân sách vượt / sắp vượt. Xếp hạng "vượt" theo TỈ LỆ chi/hạn mức (KHÔNG
  //    dùng progress vì đã clamp 100 -> không phân biệt được vượt nhẹ vs vượt nặng).
  const progress = getBudgetCategoryProgress(snapshot).filter((b) => b.monthlyLimit > 0);
  const over = progress
    .filter((b) => b.isOverBudget)
    .sort((a, b) => b.spent / b.monthlyLimit - a.spent / a.monthlyLimit)
    .slice(0, 2);
  for (const b of over) {
    alerts.push({
      id: `budget:${b.categoryId}`,
      severity: 'danger',
      icon: '📊',
      title: `Vượt ngân sách ${b.categoryName}`,
      message: `Đã chi ${vnd(b.spent)}đ / ${vnd(b.monthlyLimit)}đ hạn mức.`,
      query: 'danh mục nào vượt ngân sách',
    });
  }
  if (over.length === 0) {
    const near = progress
      .filter((b) => !b.isOverBudget && b.progress >= nearPct)
      .sort((a, b) => b.progress - a.progress)[0];
    if (near) {
      alerts.push({
        id: `budget:${near.categoryId}`,
        severity: 'warn',
        icon: '📊',
        title: `Sắp vượt ngân sách ${near.categoryName}`,
        message: `Đã dùng ${Math.round(near.progress)}% hạn mức (${vnd(near.spent)}đ).`,
        query: 'danh mục nào vượt ngân sách',
      });
    }
  }

  // 3) Hóa đơn sắp tới hạn. Tự tính SỐ NGÀY THỰC tới hạn (getUpcomingBills xếp
  //    theo dueDay nên sai thứ tự khi vắt qua đầu tháng) + chọn bill gần hạn nhất.
  const upcoming = getUpcomingBills(snapshot, billDays);
  if (upcoming.length > 0) {
    const todayKey = getTodayKey(snapshot.clientNow, snapshot.timezone);
    const [ty, tm, td] = todayKey.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    const daysToDue = (dueDay?: number): number => {
      const dd = dueDay ?? td;
      return dd >= td ? dd - td : daysInMonth - td + dd;
    };
    const sorted = [...upcoming].sort((a, b) => daysToDue(a.dueDay) - daysToDue(b.dueDay));
    const soonest = sorted[0];
    const d = daysToDue(soonest.dueDay);
    const when = d <= 0 ? 'hôm nay' : d === 1 ? 'ngày mai' : `trong ${d} ngày`;
    const more = upcoming.length > 1 ? ` (+${upcoming.length - 1} bill khác)` : '';
    alerts.push({
      id: 'bills',
      severity: 'warn',
      icon: '📋',
      title: 'Hóa đơn sắp tới hạn',
      message: `${soonest.name} ${vnd(soonest.amount)}đ tới hạn ${when}${more}.`,
      query: 'bill nào sắp tới hạn',
    });
  }

  // 4) Dòng tiền cạn (runway sống còn).
  const days = getCashRunway(snapshot).survivalRunwayDays;
  if (Number.isFinite(days) && days > 0 && days < 30) {
    alerts.push({
      id: 'runway',
      severity: days < 10 ? 'danger' : 'warn',
      icon: '💧',
      title: 'Dòng tiền mỏng',
      message: `Tiền mặt chỉ đủ trụ ~${Math.round(days)} ngày ở mức chi hiện tại.`,
      query: 'điểm sức khỏe tài chính của tôi',
    });
  }

  // 5) Lâu không ghi chép (idle).
  if (opts.idleDays && opts.idleDays >= 3) {
    alerts.push({
      id: 'idle',
      severity: 'info',
      icon: '👋',
      title: 'Lâu rồi chưa gặp ngài',
      message: `${opts.idleDays} ngày chưa ghi chép. Dành 1 phút "kiểm toán" hôm nay nhé.`,
    });
  }

  return alerts
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, limit);
}
