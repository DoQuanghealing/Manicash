/* ═══ AI CFO — Deterministic Fallback (Phase 3) ═══
 * Khi LLM thiếu key / lỗi / trả JSON sai: dựng CFOAIResponse từ CFOContextPack.
 * KHÔNG bịa số — chỉ diễn giải các con số đã có trong context.
 */

import type { CFOContextPackV1 } from '@/lib/moneyBrain';
import { formatVND } from '../response/formatMoney';
import type { CFOAIResponse } from './cfoResponseSchema';

const MODE_SUMMARY: Record<CFOContextPackV1['financialMode'], string> = {
  stabilize: 'Ưu tiên hiện tại là ổn định dòng tiền, khóa bill và giảm chi tự do.',
  build_cashflow: 'Tài chính có nền tảng, nhưng cần tăng biên tiết kiệm và đẩy pipeline kiếm tiền.',
  accelerate: 'Bạn có dư địa tốt để tăng tốc đầu tư vào năng lực/công cụ tạo thu nhập.',
  protect_capital: 'Tập trung bảo toàn kỷ luật và phân bổ vốn thông minh.',
};

export function buildDeterministicCFOFallback(context: CFOContextPackV1): CFOAIResponse {
  const { executiveSummary: ex, bills, budget, goals, earningTasks, behavior } = context;

  // ── Summary ──
  const summary = `${MODE_SUMMARY[context.financialMode]} HealthScore tháng này: ${ex.healthScore}/100.`;

  // ── Diagnosis ──
  const diagnosis: string[] = [];
  if (ex.netCashflow < 0) {
    diagnosis.push(`Dòng tiền tháng này âm ${formatVND(Math.abs(ex.netCashflow))} (chi vượt thu).`);
  }
  if (ex.safeToSpend <= 0) {
    diagnosis.push(`Số dư an toàn đang ở mức ${formatVND(ex.safeToSpend)} — cần siết chi ngay.`);
  }
  if (bills.billFundGap > 0) {
    diagnosis.push(`Quỹ bill còn thiếu ${formatVND(bills.billFundGap)} so với bill chưa đóng.`);
  }
  if (budget.overBudgetCategories.length > 0) {
    diagnosis.push(`${budget.overBudgetCategories.length} danh mục đã vượt ngân sách tháng này.`);
  }
  if (goals.atRiskGoals.length > 0) {
    diagnosis.push(`${goals.atRiskGoals.length} mục tiêu đang chậm tiến độ so với kế hoạch.`);
  }
  if (earningTasks.overdueCount > 0) {
    diagnosis.push(`${earningTasks.overdueCount} nhiệm vụ kiếm tiền đang trễ hạn.`);
  }
  if (diagnosis.length === 0) {
    diagnosis.push(
      `Thu ${formatVND(ex.totalIncome)}, chi ${formatVND(ex.totalExpense)}, tỷ lệ tiết kiệm ${Math.round(ex.savingsRate)}% — tình hình tương đối ổn định.`,
    );
  }

  // ── Risks ──
  const risks: string[] = [];
  if (bills.unpaidCount > 0) {
    risks.push(`Còn ${bills.unpaidCount} bill chưa đóng, tổng ${formatVND(bills.totalUnpaidBills)}.`);
  }
  if (budget.overBudgetCategories.length > 0) {
    const top = budget.overBudgetCategories[0];
    risks.push(`Danh mục "${top.categoryName ?? top.categoryId}" vượt ngân sách ${formatVND(top.overspentBy)}.`);
  }
  if (context.healthScore.emergencyRunway < 20) {
    risks.push('Quỹ dự phòng còn mỏng so với chi tiêu hằng tháng.');
  }
  if (earningTasks.expectedIncomePipeline <= 0) {
    risks.push('Chưa có pipeline thu nhập từ nhiệm vụ kiếm tiền.');
  }

  // ── Opportunities ──
  const opportunities: string[] = [];
  if (budget.topExpenseCategories.length > 0) {
    const top = budget.topExpenseCategories[0];
    opportunities.push(
      `Soát danh mục chi lớn nhất "${top.categoryName ?? top.categoryId}" (${formatVND(top.amount)}); cắt 20% tiết kiệm ~${formatVND(top.amount * 0.2)}.`,
    );
  }
  if (behavior.repeatedSmallLeaks.length > 0) {
    const leak = behavior.repeatedSmallLeaks[0];
    opportunities.push(
      `Gom rò rỉ nhỏ ở "${leak.categoryName ?? leak.categoryId}" (${leak.count} lần, ${formatVND(leak.totalAmount)}).`,
    );
  }
  if (earningTasks.expectedIncomePipeline > 0) {
    opportunities.push(
      `Hoàn thành task đang mở để thêm ${formatVND(earningTasks.expectedIncomePipeline)} dòng tiền.`,
    );
  }
  if (goals.plannedMonthlyGoalContributions > 0) {
    opportunities.push(
      `Duy trì nạp mục tiêu đều ${formatVND(goals.plannedMonthlyGoalContributions)}/tháng.`,
    );
  }
  if (opportunities.length === 0) {
    opportunities.push('Tăng thu qua nhiệm vụ kiếm tiền và giữ kỷ luật chi tiêu.');
  }

  // ── Action plan 7 ngày ──
  const actionPlan7Days = [
    bills.unpaidCount > 0
      ? `Rà soát ${bills.unpaidCount} bill chưa đóng và khóa quỹ bill.`
      : 'Kiểm tra lại lịch bill và đảm bảo quỹ bill đủ.',
    budget.topExpenseCategories.length > 0
      ? `Xem lại danh mục chi lớn nhất: ${budget.topExpenseCategories[0].categoryName ?? budget.topExpenseCategories[0].categoryId}.`
      : 'Xem lại các danh mục chi tiêu trong tháng.',
    budget.overBudgetCategories.length > 0
      ? `Đóng băng chi tự do ở ${budget.overBudgetCategories.length} danh mục đã vượt ngân sách.`
      : 'Giữ các danh mục trong hạn mức ngân sách.',
    earningTasks.activeCount + earningTasks.overdueCount > 0
      ? 'Hoàn thành nhiệm vụ kiếm tiền ưu tiên cao nhất.'
      : 'Lên kế hoạch một nguồn thu nhập thêm.',
    goals.plannedMonthlyGoalContributions > 0
      ? 'Xác nhận khoản nạp mục tiêu tháng này.'
      : 'Đặt mục tiêu tiết kiệm và mức nạp đều mỗi tháng.',
    behavior.repeatedSmallLeaks.length > 0
      ? `Soát rò rỉ nhỏ lặp lại ở ${behavior.repeatedSmallLeaks[0].categoryName ?? behavior.repeatedSmallLeaks[0].categoryId}.`
      : 'Soát các khoản chi nhỏ lặp lại trong tuần.',
    'Dành 15 phút cuối tuần để review thu chi và điều chỉnh kế hoạch.',
  ];

  const result: CFOAIResponse = {
    summary,
    diagnosis: diagnosis.slice(0, 6),
    risks: risks.slice(0, 6),
    opportunities: opportunities.slice(0, 6),
    actionPlan7Days: actionPlan7Days.slice(0, 7),
  };
  return result;
}
