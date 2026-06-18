/* ═══ PRISM — Thẻ La Bàn Năng Lực (P5) ═══
 * Radar SVG 4 đỉnh (hình kim cương) + 4 chỉ số + nhóm nghề + việc cần hoàn thiện.
 * Thuần presentational (không lib biểu đồ ngoài). Offline.
 */
'use client';

import type { CapacityResult } from '@/lib/aiMoneyChat/prism/capacity/capacityEngine';
import './capacity-card.css';

const AXES = [
  { key: 'FDS', label: 'Kỷ luật', angle: -90 },
  { key: 'TAS', label: 'Công nghệ', angle: 0 },
  { key: 'IPS', label: 'Thu nhập', angle: 90 },
  { key: 'MMS', label: 'Tư duy', angle: 180 },
] as const;

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function ringPoints(cx: number, cy: number, R: number, frac: number): string {
  return AXES.map((ax) => polar(cx, cy, R * frac, ax.angle).join(',')).join(' ');
}

export default function CapacityCard({ result }: { result: CapacityResult }) {
  const { scores, classification, pending } = result;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const R = 80;

  const dataPoints = AXES.map((ax) =>
    polar(cx, cy, R * (scores[ax.key] / 100), ax.angle).join(','),
  ).join(' ');

  const heading = classification.isHybrid && classification.hybridLabel
    ? classification.hybridLabel
    : classification.label;

  return (
    <div className="cap-card">
      <div className="cap-card-head">
        <span className="cap-card-kicker">💎 Bản đồ năng lực</span>
        <span className="cap-card-group">{heading}</span>
        <span className="cap-card-tagline">{classification.tagline}</span>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} className="cap-radar" role="img" aria-label="Biểu đồ radar năng lực">
        <defs>
          <linearGradient id="capFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {/* Lưới đồng tâm */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ringPoints(cx, cy, R, f)} className="cap-grid" />
        ))}
        {/* Trục */}
        {AXES.map((ax) => {
          const [x, y] = polar(cx, cy, R, ax.angle);
          return <line key={ax.key} x1={cx} y1={cy} x2={x} y2={y} className="cap-axis" />;
        })}
        {/* Vùng điểm */}
        <polygon points={dataPoints} className="cap-area" fill="url(#capFill)" />
        {/* Điểm đỉnh + nhãn */}
        {AXES.map((ax) => {
          const [px, py] = polar(cx, cy, R * (scores[ax.key] / 100), ax.angle);
          const [lx, ly] = polar(cx, cy, R + 16, ax.angle);
          return (
            <g key={ax.key}>
              <circle cx={px} cy={py} r={3} className="cap-dot" />
              <text x={lx} y={ly} className="cap-label" textAnchor="middle" dominantBaseline="middle">
                {ax.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="cap-scores">
        {AXES.map((ax) => (
          <div key={ax.key} className="cap-score-row">
            <span className="cap-score-key">{ax.key}</span>
            <span className="cap-score-name">{ax.label}</span>
            <div className="cap-score-bar">
              <div className="cap-score-fill" style={{ width: `${scores[ax.key]}%` }} />
            </div>
            <span className="cap-score-val">{scores[ax.key]}</span>
          </div>
        ))}
      </div>

      {classification.suggestions.length > 0 && (
        <div className="cap-suggest">
          <span className="cap-suggest-title">Hướng đi gợi ý</span>
          <div className="cap-suggest-tags">
            {classification.suggestions.map((s) => (
              <span key={s} className="cap-suggest-tag">{s}</span>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="cap-pending">
          <span className="cap-pending-title">⚙️ Đo sơ bộ — hoàn thiện để chính xác hơn:</span>
          <ul>
            {pending.slice(0, 4).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
