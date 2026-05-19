import type { RankDefinition } from '@/types/gamification';

interface Props {
  rank: RankDefinition;
  size?: number;
}

export default function HexagonLevelBadge({ rank, size = 64 }: Props) {
  const strokeWidth = Math.max(2, size * 0.05);
  const padding = strokeWidth * 2;
  const w = size;
  const h = size;

  // Calculate hexagon points
  const points = [
    [w * 0.5, padding],
    [w - padding, h * 0.25],
    [w - padding, h * 0.75],
    [w * 0.5, h - padding],
    [padding, h * 0.75],
    [padding, h * 0.25],
  ].map((p) => p.join(',')).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`grad-${rank.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={rank.gradientFrom} />
              <stop offset="100%" stopColor={rank.gradientTo} />
            </linearGradient>
            <filter id={`glow-${rank.id}`}>
              <feGaussianBlur stdDeviation={strokeWidth} result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <polygon
            points={points}
            fill="var(--surface-mute)"
            stroke={`url(#grad-${rank.id})`}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            filter={`url(#glow-${rank.id})`}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.35,
          }}
        >
          {rank.icon}
        </div>
      </div>
    </div>
  );
}
