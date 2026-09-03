/* ═══ Nạp dữ liệu giả lập vào store (chỉ chạy ở trình duyệt) ═══
 *
 * ⚠️ CHỈ ĐƯỢC GỌI KHI simulationAwareStorage ĐANG Ở CHẾ ĐỘ GIẢ LẬP.
 * Hàm này ghi thẳng vào store; nếu cờ giả lập chưa bật thì middleware persist
 * sẽ đẩy toàn bộ số giả xuống localStorage và ĐÈ dữ liệu thật. Đó đúng là lỗi
 * đã làm mất dữ liệu của PO ở bản demo cũ, nên có chốt cứng ở đầu hàm.
 */
'use client';

import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { isSimulationActive } from '@/stores/simulationStorage';
import type { SimFile } from './schema';
import { buildSimulation, shiftDate } from './build';

const PALETTE = ['#7C3AED', '#16A34A', '#EA580C', '#EC5F9B', '#4B7BE5', '#D4B36A'];

export interface ApplyResult {
  transactions: number;
  goals: number;
  tasks: number;
  bills: number;
  shiftDays: number;
}

export function applySimulation(file: SimFile, shiftToToday: boolean): ApplyResult {
  if (!isSimulationActive()) {
    // Chốt cứng: thà không nạp còn hơn đè dữ liệu thật.
    throw new Error(
      'Chưa bật chế độ giả lập — từ chối nạp để không ghi số giả vào dữ liệu thật.',
    );
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const built = buildSimulation(file, { shiftToToday, now });
  const shift = built.shiftDays;

  // ── Giao dịch + hoá đơn + số dư ──
  const bills = (file.bills ?? []).map((b, i) => ({
    id: `bill-sim-${i}`,
    name: b.name,
    icon: b.icon ?? '🧾',
    amount: b.amount,
    dueDay: b.dueDay,
    isPaid: b.isPaid === true,
  }));

  const acc = file.accounts ?? {};
  useFinanceStore.setState({
    transactions: built.transactions as never,
    mainBalance: acc.main ?? 0,
    cashBalance: acc.cash ?? 0,
    emergencyBalance: acc.reserve ?? 0,
    billFundBalance: acc.billFund ?? 0,
    fixedBills: bills as never,
    billPayments: [],
    billSnapshots: [],
  } as never);

  // ── Ba quỹ + góp tháng này ──
  const nowIso = now.toISOString();
  const monthlyGoalTotal = (file.goals ?? []).reduce((s, g) => s + (g.monthly ?? 0), 0);
  useDashboardStore.setState({
    accounts: {
      spending: { balance: acc.spending ?? 0, limit: acc.spendingLimit ?? 0 },
      reserve: { balance: acc.reserve ?? 0 },
      goals: { balance: acc.goalsFund ?? 0 },
      investment: { balance: acc.investment ?? 0 },
    },
    /* Góp tháng này phải KHỚP tổng `monthly` của các mục tiêu, nếu không khối
     * "Tiết kiệm" trên Tổng quan và số dư khả dụng sẽ nói hai con số khác nhau —
     * khách xem sẽ hỏi ngay. */
    monthlyContributions: {
      reserve: [],
      goals: monthlyGoalTotal > 0 ? [{ amount: monthlyGoalTotal, createdAt: nowIso, month: monthKey }] : [],
      investment: [],
    },
  } as never);

  // ── Ngưỡng chi tiêu ──
  useBudgetStore.setState({
    currentMonth: monthKey,
    carryOver: 0,
    categoryBudgets: (file.budgets ?? []).map((b) => ({
      categoryId: b.categoryId,
      monthlyLimit: b.monthlyLimit,
      spent: 0,
      month: monthKey,
    })),
  } as never);

  // ── Mục tiêu ──
  useGoalsStore.setState({
    goals: (file.goals ?? []).map((g, i) => ({
      id: `goal-sim-${i}`,
      name: g.name,
      icon: g.icon ?? '🎯',
      targetAmount: g.target,
      currentAmount: g.current ?? 0,
      // `monthlyContributionTarget` mới là con số safe-to-spend trừ đi, KHÔNG
      // phải currentAmount. Nhầm hai cái này là số dư khả dụng ra sai.
      monthlyContributionTarget: g.monthly ?? 0,
      deadline: g.deadline ? shiftDate(g.deadline, shift) : undefined,
      color: g.color ?? PALETTE[i % PALETTE.length],
      milestones: [],
      createdAt: nowIso,
    })),
  } as never);

  // ── Nhiệm vụ kiếm tiền + nhiệm vụ con ──
  useTaskStore.setState({
    tasks: (file.tasks ?? []).map((t, i) => ({
      id: `task-sim-${i}`,
      name: t.name,
      expectedAmount: t.expected,
      startDate: `${shiftDate(t.start, shift)}T00:00:00.000Z`,
      endDate: `${shiftDate(t.end, shift)}T23:59:59.000Z`,
      subTasks: (t.subTasks ?? []).map((name, j) => ({
        id: `sub-sim-${i}-${j}`,
        name,
        // Tick sẵn một nửa để thanh tiến độ trông có tiến triển, không phải 0%.
        isCompleted: j < Math.floor((t.subTasks?.length ?? 0) / 2),
      })),
      createdAt: nowIso,
    })),
    xpPenalties: [],
  } as never);

  useSettingsStore.setState({ hideBalance: file.profile?.hideBalance === true } as never);

  return {
    transactions: built.transactions.length,
    goals: (file.goals ?? []).length,
    tasks: (file.tasks ?? []).length,
    bills: bills.length,
    shiftDays: shift,
  };
}
