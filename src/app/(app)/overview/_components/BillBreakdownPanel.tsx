/* ═══ BillBreakdownPanel — thân cửa sổ "Hóa đơn cố định" ═══
 *
 *   · Mỗi hóa đơn hiện hạn đóng có màu: đã thanh toán · còn ≤3 ngày (cam) ·
 *     còn ≤7 ngày (xanh) · quá hạn (đỏ).
 *   · Bấm vào một hóa đơn → biểu đồ cột 12 tháng, kèm % tăng/giảm so với lần
 *     đóng gần nhất (tiền điện tháng nóng vọt lên thì nhìn ra ngay).
 *   · Vành khuyên tổng hóa đơn tháng, chú thích tỷ trọng trên thu nhập.
 *
 * Tính toán nằm ở `@/lib/billAnalytics` (thuần + có test); ở đây chỉ vẽ.
 */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Settings2 } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import {
  buildBillSlices,
  buildBillYearSeries,
  getBillDueStatus,
  getBillShareOfIncome,
} from '@/lib/billAnalytics';
import { buildDonutSegments } from '@/lib/expenseBreakdown';
import './BillBreakdownPanel.css';

const R = 38;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function BillBreakdownPanel({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const billPayments = useFinanceStore((s) => s.billPayments);
  const monthlyIncome = useFinanceStore((s) => s.getMonthlyIncome());
  const [openBillId, setOpenBillId] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const totalBills = fixedBills.reduce((s, b) => s + b.amount, 0);
  const paidCount = fixedBills.filter((b) => b.isPaid).length;

  const slices = useMemo(() => buildBillSlices(fixedBills), [fixedBills]);
  const segments = useMemo(() => buildDonutSegments(slices, CIRCUMFERENCE), [slices]);
  const shareOfIncome = getBillShareOfIncome(totalBills, monthlyIncome);

  // Hóa đơn xếp theo hạn gần nhất trước, đã đóng xuống cuối.
  const sortedBills = useMemo(
    () =>
      [...fixedBills].sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return a.dueDay - b.dueDay;
      }),
    [fixedBills],
  );

  return (
    <div className="blb">
      {/* Tổng + tỷ trọng trên thu nhập */}
      <div className="blb-total">
        <div className="blb-total-copy">
          <span className="blb-total-label">Tổng hóa đơn tháng này</span>
          <span className="blb-total-val">{formatCurrency(totalBills)}</span>
          <span className="blb-total-sub">
            Đã đóng {paidCount}/{fixedBills.length}
            {shareOfIncome !== null && ` • chiếm ${shareOfIncome}% thu nhập tháng`}
          </span>
        </div>
      </div>

      {/* Vành khuyên: mỗi hóa đơn một màu */}
      {slices.length > 0 && (
        <div className="blb-split">
          <p className="blb-section-title">Cơ cấu hóa đơn</p>
          <div className="blb-split-body">
            <svg className="blb-donut" viewBox="0 0 100 100" role="img" aria-label="Cơ cấu hóa đơn cố định">
              <g transform="rotate(-90 50 50)">
                <circle className="blb-donut-track" cx="50" cy="50" r={R} />
                {segments.map((seg, i) => (
                  <circle
                    key={slices[i].billId}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="15"
                    strokeDasharray={seg.dash}
                    strokeDashoffset={seg.offset}
                  />
                ))}
              </g>
              <text className="blb-donut-center" x="50" y="47" textAnchor="middle">
                {shareOfIncome !== null ? `${shareOfIncome}%` : '—'}
              </text>
              <text className="blb-donut-sub" x="50" y="58" textAnchor="middle">
                thu nhập
              </text>
            </svg>

            <ul className="blb-legend">
              {slices.map((s) => (
                <li key={s.billId} className="blb-legend-row">
                  <span className="blb-legend-dot" style={{ background: s.color }} aria-hidden />
                  <span className="blb-legend-name">
                    <span aria-hidden>{s.icon}</span> {s.name}
                  </span>
                  <span className="blb-legend-pct">{s.percent}%</span>
                  <span className="blb-legend-amt">{formatCurrencyShort(s.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          {shareOfIncome !== null && (
            <p className="blb-note">
              Hóa đơn cố định ăn <strong>{shareOfIncome}%</strong> thu nhập tháng này
              ({formatCurrencyShort(totalBills)} / {formatCurrencyShort(monthlyIncome)}).
            </p>
          )}
        </div>
      )}

      {/* Danh sách hóa đơn — bấm để mở biểu đồ năm */}
      <div className="blb-list">
        <p className="blb-section-title">Hóa đơn tháng này</p>
        {sortedBills.length === 0 && <p className="blb-empty">Chưa khai hóa đơn cố định nào.</p>}

        {sortedBills.map((bill) => {
          const status = getBillDueStatus(bill);
          const isOpen = openBillId === bill.id;
          const series = isOpen ? buildBillYearSeries(billPayments, bill.id, year) : [];
          const maxAmount = Math.max(...series.map((p) => p.amount), 1);
          const paidPoints = series.filter((p) => p.amount > 0);
          const latest = paidPoints[paidPoints.length - 1];

          return (
            <div key={bill.id} className={`blb-item${isOpen ? ' blb-item--open' : ''}`}>
              <button
                type="button"
                className="blb-item-head"
                onClick={() => setOpenBillId(isOpen ? null : bill.id)}
                aria-expanded={isOpen}
              >
                <span className="blb-item-icon" aria-hidden>{bill.icon}</span>
                <span className="blb-item-copy">
                  <span className="blb-item-name">{bill.name}</span>
                  <span className={`blb-item-due blb-due--${status.tone}`}>{status.label}</span>
                </span>
                <span className="blb-item-amt">{formatCurrencyShort(bill.amount)}</span>
                <ChevronDown size={16} className={`blb-item-caret${isOpen ? ' blb-item-caret--open' : ''}`} />
              </button>

              {isOpen && (
                <div className="blb-history">
                  <div className="blb-history-head">
                    <span className="blb-history-title">Đã đóng trong năm {year}</span>
                    {/* Hóa đơn cố định (tiền nhà, học phí) tháng nào cũng như nhau
                      * → hiện "▲ 0%" chỉ tổ gây nhiễu. Chỉ báo khi có thay đổi. */}
                    {typeof latest?.changePercent === 'number' && latest.changePercent !== 0 && (
                      <span
                        className={`blb-delta ${latest.changePercent >= 0 ? 'blb-delta--up' : 'blb-delta--down'}`}
                      >
                        {latest.changePercent >= 0 ? '▲' : '▼'} {Math.abs(latest.changePercent)}% so với lần trước
                      </span>
                    )}
                  </div>

                  {paidPoints.length === 0 ? (
                    <p className="blb-empty">Chưa có lịch sử đóng hóa đơn này trong năm.</p>
                  ) : (
                    <div className="blb-bars">
                      {series.map((p) => (
                        <div key={p.month} className="blb-bar-col">
                          <span className="blb-bar-amt">
                            {p.amount > 0 ? formatCurrencyShort(p.amount) : ''}
                          </span>
                          <div className="blb-bar-track">
                            <div
                              className={`blb-bar-fill${p.isCurrent ? ' blb-bar-fill--now' : ''}`}
                              style={{ height: `${p.amount > 0 ? Math.max((p.amount / maxAmount) * 100, 4) : 0}%` }}
                            />
                          </div>
                          <span className={`blb-bar-label${p.isCurrent ? ' blb-bar-label--now' : ''}`}>
                            {p.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="blb-adjust"
        onClick={() => {
          onNavigate?.();
          router.push('/ledger?tab=bills');
        }}
      >
        <Settings2 size={15} />
        <span>Điều chỉnh hóa đơn</span>
      </button>
    </div>
  );
}
