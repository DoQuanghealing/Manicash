'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Crown } from 'lucide-react';
import { useProStatus } from '@/hooks/useIsPro';
import { isMonetizationEnabled } from '@/lib/monetization/entitlement';
import { trackEvent } from '@/lib/analytics/events';
import PricingCards from '@/components/pricing/PricingCards';
import './upgrade.css';

export default function UpgradeContent() {
  const status = useProStatus();

  useEffect(() => {
    trackEvent('upgrade_view', { source: 'upgrade_page', tier: status.tier });
  }, [status.tier]);

  return (
    <div className="upgrade-page">
      <nav className="upgrade-nav">
        <Link href="/money" className="upgrade-back">
          <ArrowLeft size={18} />
          Quay lại
        </Link>
      </nav>

      <section className="upgrade-hero">
        <div className="upgrade-crown" aria-hidden="true">
          <Crown size={28} />
        </div>
        <h1>ManiCash Pro</h1>
        <p className="upgrade-lead">
          Mở khoá người quản gia tài chính AI đầy đủ — nhập liệu bằng lời nói, báo cáo
          cá nhân hoá và tự động ghi sổ.
        </p>
      </section>

      <PricingCards />

      <p className="upgrade-footnote">
        Thanh toán an toàn qua PayOS. Gói tự động không gia hạn — bạn chủ động mua lại.
        {!isMonetizationEnabled() && ' (Tính năng thanh toán chưa được kích hoạt.)'}
      </p>
    </div>
  );
}
