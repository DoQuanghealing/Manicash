/* ═══ Nội dung tấm trượt Tiết kiệm ═══
 *
 * Ý đồ PO: người dùng thích nhìn thu nhập và chi tiêu, NGẠI nhìn tiết kiệm.
 * Nên khối này không mở đầu bằng con số khô khan mà bằng MỤC TIÊU — thấy "xây
 * nhà" còn thiếu bao nhiêu thì mới có cớ để dành. Tổng quỹ đứng sau.
 */
'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './SheetContent.css';

export default function SavingsSheetContent() {
  const router = useRouter();
  const accounts = useDashboardStore((s) => s.accounts);
  const monthlySavings = useDashboardStore((s) => s.getTotalMonthlySavings());
  const goals = useGoalsStore((s) => s.goals);

  const fundsTotal =
    accounts.reserve.balance + accounts.goals.balance + accounts.investment.balance;

  return (
    <>
      <section className="sh-card">
        <p className="sh-label">Đã để dành tháng này</p>
        <p className="sh-total">{formatCurrency(monthlySavings)}</p>
        <div className="sh-rows">
          <div className="sh-row">
            <span className="sh-row-label">Tổng cả ba quỹ</span>
            <span className="sh-row-value">{formatCurrency(fundsTotal)}</span>
          </div>
          <div className="sh-row">
            <span className="sh-row-label">Quỹ dự phòng</span>
            <span className="sh-row-value">{formatCurrency(accounts.reserve.balance)}</span>
          </div>
          <div className="sh-row">
            <span className="sh-row-label">Quỹ mục tiêu</span>
            <span className="sh-row-value">{formatCurrency(accounts.goals.balance)}</span>
          </div>
          <div className="sh-row">
            <span className="sh-row-label">Quỹ đầu tư</span>
            <span className="sh-row-value">{formatCurrency(accounts.investment.balance)}</span>
          </div>
        </div>
      </section>

      <section className="sh-card">
        <p className="sh-section-title">Để dành cho việc gì</p>

        {goals.length === 0 ? (
          <>
            <p className="sh-empty">
              Chưa có mục tiêu nào. Tiết kiệm không có đích đến thì rất khó giữ — đặt một mục
              tiêu cụ thể trước đã.
            </p>
            <button type="button" className="sh-cta" onClick={() => router.push('/goals')}>
              Đặt mục tiêu đầu tiên <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <>
            <ul className="sh-goals">
              {goals.map((g) => {
                const pct = Math.min(
                  100,
                  Math.round((g.currentAmount / Math.max(g.targetAmount, 1)) * 100),
                );
                const left = Math.max(0, g.targetAmount - g.currentAmount);
                return (
                  <li key={g.id} className="sh-goal">
                    <div className="sh-goal-top">
                      <span className="sh-goal-name">
                        <span aria-hidden>{g.icon}</span> {g.name}
                      </span>
                      <span className="sh-goal-pct">{pct}%</span>
                    </div>
                    <span className="sh-goal-bar">
                      <span
                        className="sh-goal-fill"
                        style={{ width: `${pct}%`, background: g.color }}
                      />
                    </span>
                    <div className="sh-goal-bottom">
                      <span>{formatCurrencyShort(g.currentAmount)} / {formatCurrencyShort(g.targetAmount)}</span>
                      {left > 0 && <span>còn thiếu {formatCurrencyShort(left)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="sh-cta" onClick={() => router.push('/goals')}>
              Quản lý mục tiêu <ChevronRight size={16} />
            </button>
          </>
        )}
      </section>
    </>
  );
}
