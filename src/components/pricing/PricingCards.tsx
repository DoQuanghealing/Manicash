/* ═══ PricingCards — cửa sổ 3 gói (Base / Pro / Dùng thử) ═══
 * Dùng chung cho PricingModal (cửa sổ) và trang /upgrade. Tông cam; khung đang dùng
 * đổi xanh lá + "Đã kích hoạt". Pro có bộ chọn kỳ hạn (Tháng/6 tháng/Năm).
 */
'use client';

import { useMemo, useState } from 'react';
import { Check, Crown, Gift, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { purchasePro, startCheckout, startTrial } from '@/lib/monetization/billingClient';
import {
  getPlanCard,
  PRO_SKUS,
  tierForSku,
  entitlementFieldsForTier,
  type ProPeriodSkuId,
  type ProSkuId,
} from '@/lib/monetization/entitlement';
import { trackEvent } from '@/lib/analytics/events';
import './pricing.css';

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN');
}

const BASE_FEATURES = [
  'Quản lý thu chi, 3 ví, chia tiền, ngân sách',
  'Mục tiêu & nhiệm vụ kiếm tiền (giới hạn 3)',
  'Gamification: rank, XP, streak',
  'Báo cáo CFO bản tóm tắt · 1 lượt AI/ngày',
];

const PRO_FEATURE_LINES = [
  'AI Money Chat 20 lượt/ngày',
  'Báo cáo CFO AI viết riêng (sâu)',
  'Tự động ghi giao dịch từ SMS',
  'Không giới hạn wishlist / mục tiêu / nhiệm vụ',
  'Ưu tiên tính năng mới',
];

/** Phú Vương (cấp quản gia 3) — nói ĐÚNG những gì cấp 3 mở thêm so với Pro. */
const PRO_PLUS_FEATURE_LINES = [
  'Quản gia Phú Vương 🐉 — cấp cao nhất',
  'Quản gia chăm sóc chủ động (10 kịch bản, 0đ)',
  'Thẩm định nhiệm vụ kiếm tiền không giới hạn',
  'AI Money Chat 80 lượt/ngày · báo cáo sâu 15 lượt/ngày',
  'Toàn bộ quyền lợi Pro',
];

const PERIOD_ORDER: ProPeriodSkuId[] = ['monthly', 'half_year', 'yearly'];
const PERIOD_LABEL: Record<ProPeriodSkuId, string> = { monthly: 'Tháng', half_year: '6 tháng', yearly: 'Năm' };
const PERIOD_NOTE: Record<ProPeriodSkuId, string> = { monthly: '', half_year: 'Tiết kiệm', yearly: 'Tặng ~2 tháng' };

type LoadingKind = 'pro' | 'trial' | 'pro_plus' | null;

interface PricingCardsProps {
  /** Gọi khi nâng cấp/dùng thử thành công (modal đóng lại). */
  onSuccess?: () => void;
}

export default function PricingCards({ onSuccess }: PricingCardsProps) {
  const user = useAuthStore((s) => s.user);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const card = useMemo(() => getPlanCard(user), [user]);

  const [period, setPeriod] = useState<ProPeriodSkuId>('monthly');
  const [loading, setLoading] = useState<LoadingKind>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  /** Cập nhật lạc quan phía client — tier lấy từ SKU đã mua (server vẫn là nguồn sự thật). */
  function applyGrant(
    premiumExpiresAt: string | null | undefined,
    provider: 'payos' | 'trial',
    skuId: ProSkuId = 'monthly',
  ) {
    updateUserProfile({
      ...entitlementFieldsForTier(provider === 'trial' ? 'pro' : tierForSku(skuId)),
      premiumExpiresAt: premiumExpiresAt ?? null,
      billingProvider: provider,
      ...(provider === 'trial' ? { trialUsedAt: new Date().toISOString() } : {}),
    });
  }

  /** Mua 1 SKU bất kỳ (kỳ hạn Pro hoặc Phú Vương). */
  async function handleCheckout(skuId: ProSkuId, kind: Exclude<LoadingKind, null>) {
    setLoading(kind);
    setMessage(null);
    trackEvent('upgrade_start', { source: 'pricing', plan: skuId });

    // PayOS bật → tạo link + chuyển hướng (cấp quyền qua webhook). Chưa bật → placeholder mock.
    if (process.env.NEXT_PUBLIC_PAYOS_ENABLED === 'true') {
      const r = await startCheckout(skuId);
      if (!r.ok) {
        setLoading(null);
        setMessage({ kind: 'err', text: r.reason });
        trackEvent('upgrade_failed', { reason: r.source });
      }
      // ok → trình duyệt đang chuyển sang PayOS; giữ loading.
      return;
    }

    const result = await purchasePro();
    setLoading(null);
    if (result.ok) {
      applyGrant(result.premiumExpiresAt, 'payos', skuId);
      setMessage({
        kind: 'ok',
        text: tierForSku(skuId) === 'pro_plus'
          ? 'Chúc mừng! Quản gia Phú Vương đã sẵn sàng hầu ngài 🐉'
          : 'Chúc mừng! Bạn đã là thành viên Pro 💎',
      });
      trackEvent('upgrade_success', { source: 'pricing', plan: skuId });
      onSuccess?.();
    } else {
      setMessage({ kind: 'err', text: result.reason });
      trackEvent('upgrade_failed', { reason: result.source });
    }
  }

  async function handleTrial() {
    setLoading('trial');
    setMessage(null);
    trackEvent('upgrade_start', { source: 'pricing', plan: 'trial' });
    const result = await startTrial();
    setLoading(null);
    if (result.ok) {
      applyGrant(result.premiumExpiresAt, 'trial');
      setMessage({ kind: 'ok', text: 'Đã kích hoạt dùng thử Pro 30 ngày 🎁' });
      trackEvent('upgrade_success', { source: 'pricing', plan: 'trial' });
      onSuccess?.();
    } else {
      setMessage({ kind: 'err', text: result.reason });
      trackEvent('upgrade_failed', { reason: result.source });
    }
  }

  const sku = PRO_SKUS[period];

  return (
    <div className="pc-wrap">
      {/* ─── Base ─── */}
      <article className={`pc-card pc-base ${card.active === 'base' ? 'pc-card--active' : ''}`}>
        <header className="pc-head">
          <span className="pc-name">Base</span>
          {card.active === 'base' && <span className="pc-badge pc-badge--active">Đang dùng ✓</span>}
        </header>
        <div className="pc-price"><span className="pc-amount">0đ</span></div>
        <ul className="pc-feats">
          {BASE_FEATURES.map((f) => (
            <li key={f}><Check size={14} /> {f}</li>
          ))}
        </ul>
        {card.active !== 'base' && <p className="pc-note">Gói mặc định miễn phí.</p>}
      </article>

      {/* ─── Pro ─── */}
      <article className={`pc-card pc-pro ${card.active === 'pro' ? 'pc-card--active' : ''}`}>
        <header className="pc-head">
          <span className="pc-name"><Crown size={15} /> Pro</span>
          {card.active === 'pro'
            ? <span className="pc-badge pc-badge--active">Đã kích hoạt</span>
            : <span className="pc-badge pc-badge--star">⭐ Phổ biến</span>}
        </header>

        <div className="pc-periods" role="tablist" aria-label="Kỳ hạn">
          {PERIOD_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              className={`pc-period ${period === p ? 'pc-period--on' : ''}`}
              onClick={() => setPeriod(p)}
            >
              <span>{PERIOD_LABEL[p]}</span>
              {PERIOD_NOTE[p] && <em className="pc-period-note">{PERIOD_NOTE[p]}</em>}
            </button>
          ))}
        </div>

        <div className="pc-price">
          <span className="pc-amount">{formatVnd(sku.amount)}đ</span>
          <span className="pc-per">/ {PERIOD_LABEL[period].toLowerCase()}</span>
        </div>

        <ul className="pc-feats">
          {PRO_FEATURE_LINES.map((f) => (
            <li key={f}><Check size={14} /> {f}</li>
          ))}
        </ul>

        {card.active === 'pro' ? (
          <p className="pc-note pc-note--ok">Bạn đang là Pro · còn {card.daysRemaining} ngày.</p>
        ) : (
          <button
            type="button"
            className="pc-cta pc-cta--pro"
            onClick={() => handleCheckout(period, 'pro')}
            disabled={loading !== null}
          >
            {loading === 'pro' ? <Loader2 size={16} className="pc-spin" /> : <Sparkles size={16} />}
            {loading === 'pro' ? 'Đang xử lý...' : card.active === 'trial' ? 'Lên Pro trả phí' : 'Nâng cấp Pro'}
          </button>
        )}
      </article>

      {/* ─── Phú Vương (Pro Plus · cấp quản gia 3) ─── */}
      <article className={`pc-card pc-plus ${card.active === 'pro_plus' ? 'pc-card--active' : ''}`}>
        <header className="pc-head">
          <span className="pc-name">🐉 Phú Vương</span>
          {card.active === 'pro_plus'
            ? <span className="pc-badge pc-badge--active">Đã kích hoạt</span>
            : <span className="pc-badge pc-badge--plus">Cao cấp nhất</span>}
        </header>

        <div className="pc-price">
          <span className="pc-amount">{formatVnd(PRO_SKUS.pro_plus_monthly.amount)}đ</span>
          <span className="pc-per">/ tháng</span>
        </div>

        <ul className="pc-feats">
          {PRO_PLUS_FEATURE_LINES.map((f) => (
            <li key={f}><Check size={14} /> {f}</li>
          ))}
        </ul>

        {card.active === 'pro_plus' ? (
          <p className="pc-note pc-note--ok">Quản gia Phú Vương đang phục vụ · còn {card.daysRemaining} ngày.</p>
        ) : (
          <button
            type="button"
            className="pc-cta pc-cta--plus"
            onClick={() => handleCheckout('pro_plus_monthly', 'pro_plus')}
            disabled={loading !== null}
          >
            {loading === 'pro_plus' ? <Loader2 size={16} className="pc-spin" /> : <Crown size={16} />}
            {loading === 'pro_plus' ? 'Đang xử lý...' : 'Lên Phú Vương'}
          </button>
        )}
      </article>

      {/* ─── Dùng thử ─── */}
      <article className={`pc-card pc-trial ${card.active === 'trial' ? 'pc-card--active' : ''}`}>
        <header className="pc-head">
          <span className="pc-name"><Gift size={15} /> Dùng thử Pro</span>
          {card.active === 'trial' && <span className="pc-badge pc-badge--active">Đang dùng thử</span>}
        </header>
        <div className="pc-price"><span className="pc-amount">0đ</span><span className="pc-per">· 30 ngày</span></div>
        <p className="pc-note">Trải nghiệm toàn bộ Pro 1 tháng. Mỗi người chỉ 1 lần.</p>

        {card.active === 'trial' ? (
          <p className="pc-note pc-note--ok">Đang dùng thử · còn {card.daysRemaining} ngày.</p>
        ) : card.trialUsed ? (
          <button type="button" className="pc-cta pc-cta--locked" disabled>Đã dùng thử</button>
        ) : card.active === 'pro' ? (
          <p className="pc-note">Bạn đang là Pro rồi.</p>
        ) : (
          <button type="button" className="pc-cta pc-cta--trial" onClick={handleTrial} disabled={loading !== null}>
            {loading === 'trial' ? <Loader2 size={16} className="pc-spin" /> : <Gift size={16} />}
            {loading === 'trial' ? 'Đang kích hoạt...' : 'Dùng thử miễn phí'}
          </button>
        )}
      </article>

      {message && <p className={`pc-msg pc-msg--${message.kind}`}>{message.text}</p>}
    </div>
  );
}
