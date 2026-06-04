'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useIsPro } from '@/hooks/useIsPro';
import { trackEvent } from '@/lib/analytics/events';
import './pro-gate.css';

interface ProGateProps {
  /** Feature id for analytics + copy. */
  feature: string;
  /** Short label shown in the upgrade prompt, e.g. "CFO Lord Diamond". */
  label: string;
  children: ReactNode;
  /** Optional custom prompt instead of the default card. */
  fallback?: ReactNode;
}

/** Renders children for Pro users; shows an upgrade prompt for Free users. */
export default function ProGate({ feature, label, children, fallback }: ProGateProps) {
  const isPro = useIsPro();
  if (isPro) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <Link
      href="/upgrade"
      className="pro-gate-card"
      onClick={() => trackEvent('pro_gate_blocked', { feature })}
    >
      <div className="pro-gate-icon" aria-hidden="true">
        <Crown size={16} />
      </div>
      <div className="pro-gate-body">
        <strong>{label} là tính năng Pro</strong>
        <span>Nâng cấp để mở khoá — chỉ 49.000đ/tháng.</span>
      </div>
      <span className="pro-gate-cta">Nâng cấp</span>
    </Link>
  );
}
