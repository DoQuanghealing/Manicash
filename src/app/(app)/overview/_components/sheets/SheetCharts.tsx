/* ═══ SheetCharts — biểu đồ dùng chung trong tấm trượt ═══
 *
 * SVG thuần, không thư viện: nhẹ, không kéo thêm bundle, và quan trọng hơn là
 * kiểm soát được đúng hành vi PO yêu cầu (đường ngưỡng, đổi màu sau khi vượt).
 * Mọi con số truyền vào đã tính sẵn ở src/lib/ — ở đây chỉ đổi số thành toạ độ.
 */
'use client';

import type { IncomePoint, SpendingSeries } from '@/lib/moneyBlocks';
import { BANK_COLOR, CASH_COLOR } from '@/lib/moneyBlocks';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './SheetCharts.css';

// ─────────────────────────── Thu nhập: hai đường ───────────────────────────

/**
 * Hai đường chồng trên cùng một trục: tiền mặt (cam) và tài khoản (xanh).
 * Dùng CHUNG một thang đo — vẽ hai thang riêng sẽ khiến đường nhỏ trông ngang
 * đường lớn, tức là nói dối bằng hình.
 */
export function TwoLineChart({ points }: { points: IncomePoint[] }) {
  const w = 300;
  const h = 120;
  const padY = 8;

  const withData = points.filter((p) => p.total > 0);
  if (withData.length === 0) {
    return <p className="sc-empty">Chưa có khoản thu nào trong kỳ này.</p>;
  }
  if (points.length < 2) {
    return <p className="sc-empty">Cần ít nhất 2 mốc mới thấy được đà tăng.</p>;
  }

  const max = Math.max(...points.map((p) => Math.max(p.cash, p.bank)), 1);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - padY - (v / max) * (h - padY * 2);
  const path = (pick: (p: IncomePoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');

  return (
    <div className="sc-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="sc-svg" role="img" aria-label="Thu nhập theo tiền mặt và tài khoản">
        <line className="sc-axis" x1="0" y1={h - padY} x2={w} y2={h - padY} />
        <path className="sc-line" d={path((p) => p.bank)} stroke={BANK_COLOR} />
        <path className="sc-line" d={path((p) => p.cash)} stroke={CASH_COLOR} />
      </svg>

      <div className="sc-xaxis">
        {points.map((p) => (
          <span key={p.key} className={p.isCurrent ? 'is-current' : ''}>{p.label}</span>
        ))}
      </div>

      <div className="sc-legend">
        <span><i style={{ background: CASH_COLOR }} aria-hidden /> Tiền mặt</span>
        <span><i style={{ background: BANK_COLOR }} aria-hidden /> Trong tài khoản</span>
      </div>
    </div>
  );
}

// ─────────────────────────── Chi tiêu: cột + đường ngưỡng ───────────────────────────

/**
 * Cột chi tiêu kèm đường ngưỡng nằm ngang.
 * Cột/đoạn vượt ngưỡng tô đỏ — đó là cả điểm của biểu đồ này, đừng làm dịu đi.
 * Thang đo phải bao được CẢ ngưỡng, nếu không đường ngưỡng sẽ rơi ra ngoài khung.
 */
export function ThresholdChart({ series }: { series: SpendingSeries }) {
  const { points, threshold, mode } = series;
  const shown = mode === 'monthly' ? points : points;
  if (shown.length === 0) return <p className="sc-empty">Chưa có khoản chi nào.</p>;

  const w = 300;
  const h = 130;
  const padY = 10;
  const value = (p: (typeof shown)[number]) => (mode === 'monthly' ? p.amount : p.cumulative);
  const max = Math.max(...shown.map(value), threshold, 1);
  const y = (v: number) => h - padY - (v / max) * (h - padY * 2);
  const thresholdY = threshold > 0 ? y(threshold) : null;

  const barW = Math.max(4, (w / shown.length) * 0.6);
  const step = w / shown.length;

  return (
    <div className="sc-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="sc-svg" role="img" aria-label="Chi tiêu so với ngưỡng">
        {thresholdY !== null && (
          <>
            <line className="sc-threshold" x1="0" y1={thresholdY} x2={w} y2={thresholdY} />
            <text className="sc-threshold-label" x={w - 2} y={Math.max(9, thresholdY - 4)} textAnchor="end">
              Ngưỡng {formatCurrencyShort(threshold)}
            </text>
          </>
        )}

        {shown.map((p, i) => {
          const v = value(p);
          const top = y(v);
          return (
            <rect
              key={p.key}
              x={i * step + (step - barW) / 2}
              y={top}
              width={barW}
              height={Math.max(0, h - padY - top)}
              rx={Math.min(3, barW / 2)}
              className={`sc-bar${p.isOver ? ' is-over' : ''}${p.isCurrent ? ' is-current' : ''}`}
            />
          );
        })}

        <line className="sc-axis" x1="0" y1={h - padY} x2={w} y2={h - padY} />
      </svg>

      <div className="sc-xaxis">
        {shown.map((p) => (
          <span key={p.key} className={p.isCurrent ? 'is-current' : ''}>{p.label}</span>
        ))}
      </div>

      {mode === 'cumulative' && (
        <p className="sc-note">
          Chưa có tháng trước để so — đang cộng dồn theo ngày trong tháng này.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────── Vành khuyên hai phần ───────────────────────────

interface ShareSlice {
  label: string;
  amount: number;
  percent: number;
  color: string;
}

/**
 * Vành khuyên cho câu hỏi "ngân sách ngốn bao nhiêu phần thu nhập".
 * Tổng các lát có thể VƯỢT 100% (ngân sách lớn hơn thu nhập) — khi đó phải cho
 * thấy rõ là đang bội chi chứ không kẹp về 100 rồi giả vờ vừa đủ.
 */
export function ShareDonut({
  slices,
  centerValue,
  centerCaption,
  isOver,
}: {
  slices: ShareSlice[];
  centerValue: string;
  centerCaption: string;
  isOver?: boolean;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const scale = Math.max(100, slices.reduce((s, x) => s + x.percent, 0));

  // Tính độ dài rồi cộng dồn bằng prefix-sum thay vì biến tích lũy: sửa biến
  // ngoài trong lúc render là thứ React không bảo đảm chạy đúng một lần.
  const lens = slices.map((s) => (s.percent / scale) * c);
  const segs = slices.map((s, i) => {
    const before = lens.slice(0, i).reduce((a, b) => a + b, 0);
    return {
      ...s,
      dash: `${lens[i]} ${c - lens[i]}`,
      offset: before === 0 ? 0 : -before,
    };
  });

  return (
    <div className={`sc-donut${isOver ? ' is-over' : ''}`}>
      <svg viewBox="0 0 110 110" role="img" aria-label={centerCaption}>
        <g transform="rotate(-90 55 55)">
          <circle className="sc-donut-track" cx="55" cy="55" r={r} />
          {segs.map((s) => (
            <circle
              key={s.label}
              cx="55"
              cy="55"
              r={r}
              stroke={s.color}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              className="sc-donut-seg"
            />
          ))}
        </g>
      </svg>
      <div className="sc-donut-center">
        <b>{centerValue}</b>
        <span>{centerCaption}</span>
      </div>

      <ul className="sc-donut-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} aria-hidden />
            <span className="sc-donut-legend-name">{s.label}</span>
            <span className="sc-donut-legend-val">
              {formatCurrencyShort(s.amount)} · {s.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
