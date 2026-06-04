'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Crown, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { purchasePro } from '@/lib/monetization/billingClient';
import {
  getProStatus,
  isMonetizationEnabled,
  PRO_FEATURES,
  PRO_PRICE_VND,
} from '@/lib/monetization/entitlement';
import { trackEvent } from '@/lib/analytics/events';
import './upgrade.css';

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN');
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function UpgradeContent() {
  const user = useAuthStore((s) => s.user);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const status = getProStatus(user);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    trackEvent('upgrade_view', { tier: status.tier });
  }, [status.tier]);

  async function handleUpgrade() {
    setLoading(true);
    setMessage(null);
    trackEvent('upgrade_start', { source: 'upgrade_page' });

    const result = await purchasePro();
    setLoading(false);

    if (result.ok) {
      updateUserProfile({
        tier: 'pro',
        plan: 'premium',
        isPremium: true,
        premiumExpiresAt: result.premiumExpiresAt ?? null,
      });
      setMessage({ kind: 'ok', text: 'Chúc mừng! Bạn đã là thành viên Pro. 💎' });
      trackEvent('upgrade_success', { source: 'upgrade_page' });
    } else {
      setMessage({ kind: 'err', text: result.reason });
      trackEvent('upgrade_failed', { reason: result.source });
    }
  }

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

        <div className="upgrade-price">
          <span className="upgrade-price-value">{formatVnd(PRO_PRICE_VND)}đ</span>
          <span className="upgrade-price-period">/ tháng</span>
        </div>
      </section>

      {status.isPro ? (
        <section className="upgrade-status upgrade-status-pro">
          <ShieldCheck size={18} />
          <div>
            <strong>Bạn đang là thành viên Pro</strong>
            {status.expiresAt && status.daysRemaining > 0 && (
              <span>Còn {status.daysRemaining} ngày — gia hạn đến {formatDate(status.expiresAt)}.</span>
            )}
            {!status.enforced && <span>Đang ở chế độ dùng thử mở (chưa bật thu phí).</span>}
          </div>
        </section>
      ) : (
        status.isExpired && (
          <section className="upgrade-status upgrade-status-expired">
            <span>Gói Pro của bạn đã hết hạn. Gia hạn để tiếp tục dùng tính năng AI.</span>
          </section>
        )
      )}

      <section className="upgrade-features">
        {PRO_FEATURES.map((feature) => (
          <div key={feature.id} className="upgrade-feature">
            <div className="upgrade-feature-icon" aria-hidden="true">
              <Check size={15} />
            </div>
            <div>
              <strong>{feature.title}</strong>
              <p>{feature.description}</p>
            </div>
          </div>
        ))}
      </section>

      {message && (
        <p className={`upgrade-message upgrade-message-${message.kind}`}>{message.text}</p>
      )}

      {!status.isPro && (
        <button type="button" className="upgrade-cta" onClick={handleUpgrade} disabled={loading}>
          {loading ? <Loader2 size={18} className="upgrade-spin" /> : <Sparkles size={18} />}
          {loading ? 'Đang xử lý...' : `Nâng cấp Pro — ${formatVnd(PRO_PRICE_VND)}đ/tháng`}
        </button>
      )}

      <p className="upgrade-footnote">
        Thanh toán qua Google Play. Có thể huỷ bất cứ lúc nào trong cài đặt cửa hàng.
        {!isMonetizationEnabled() && ' (Tính năng thanh toán chưa được kích hoạt.)'}
      </p>
    </div>
  );
}
