'use client';

import { Crown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useIsPro } from '@/hooks/useIsPro';
import { usePricingModalStore } from '@/stores/usePricingModalStore';
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
  const openPricing = usePricingModalStore((s) => s.open);
  if (isPro) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <button
      type="button"
      className="pro-gate-card"
      onClick={() => {
        trackEvent('pro_gate_blocked', { feature });
        openPricing(`pro_gate:${feature}`);
      }}
    >
      <div className="pro-gate-icon" aria-hidden="true">
        <Crown size={16} />
      </div>
      <div className="pro-gate-body">
        <strong>{label} là tính năng Pro</strong>
        <span>Nâng cấp để mở khoá — chỉ 49.000đ/tháng.</span>
      </div>
      <span className="pro-gate-cta">Nâng cấp</span>
    </button>
  );
}
