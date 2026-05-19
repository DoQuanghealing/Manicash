'use client';

import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { BadgeDefinition } from '@/data/badgeDefinitions';
import './BadgeImage.css';

interface Props {
  badge: BadgeDefinition;
  unlocked: boolean;
  size?: number;
}

export default function BadgeImage({ badge, unlocked, size = 96 }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  
  // Try to find the icon from lucide-react dynamically
  const IconComponent = (LucideIcons as any)[badge.fallbackIcon] || LucideIcons.Award;

  if (imgFailed) {
    return (
      <div 
        className={`badge-fallback ${unlocked ? 'unlocked' : 'locked'}`}
        style={{ width: size, height: size }}
        title={badge.name}
      >
        <IconComponent size={Math.round(size * 0.5)} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={`/badges/${badge.category}/${badge.fileName}`}
      alt={badge.name}
      width={size}
      height={size}
      className={`badge-img ${unlocked ? 'unlocked' : 'locked'}`}
      onError={() => setImgFailed(true)}
      loading="lazy"
    />
  );
}
