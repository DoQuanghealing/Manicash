
import React from 'react';

interface Props {
  size?: number;
  className?: string;
  color?: string;
}

export const BrandLogo: React.FC<Props> = ({ size = 48, className = "", color = "currentColor" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Central "Q" - Font Inter cực dày, đại diện cho phẩm chất và quản trị */}
      <text 
        x="50" 
        y="55" 
        fill={color} 
        textAnchor="middle" 
        style={{ 
          fontFamily: "'Inter', sans-serif", 
          fontWeight: 900, 
          fontSize: '60px',
          letterSpacing: '-0.05em',
          filter: 'drop-shadow(0px 4px 10px rgba(0,0,0,0.1))'
        }}
      >
        Q
      </text>

      {/* Brand Name: "MANICASH" - Thay thế cho chữ Thịnh Vượng */}
      <text 
        x="50" 
        y="85" 
        fill={color} 
        textAnchor="middle" 
        style={{ 
          fontFamily: "'Be Vietnam Pro', sans-serif", 
          fontWeight: 900, 
          fontSize: '10px',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          opacity: 0.9
        }}
      >
        MANICASH
      </text>

      {/* Sparkle - Hiệu ứng lấp lánh nhẹ nhàng mang tính biểu tượng của sự may mắn/tài lộc */}
      <path 
        d="M75 15L77 20L82 22L77 24L75 29L73 24L68 22L73 20L75 15Z" 
        fill="white" 
        className="animate-pulse"
      />
      
      {/* Subtle bottom line accent - Đường gạch chân tinh tế */}
      <rect x="30" y="92" width="40" height="1.5" rx="0.75" fill={color} opacity="0.3" />
    </svg>
  );
};
