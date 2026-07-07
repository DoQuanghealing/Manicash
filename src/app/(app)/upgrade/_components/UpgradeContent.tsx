'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, ChevronDown, AlertTriangle, Sparkles, Check } from 'lucide-react';
import { useProStatus } from '@/hooks/useIsPro';
import { isMonetizationEnabled } from '@/lib/monetization/entitlement';
import { trackEvent } from '@/lib/analytics/events';
import PricingCards from '@/components/pricing/PricingCards';
import './upgrade.css';

const REASONS = [
  {
    icon: <AlertTriangle size={20} />,
    tint: 'reason--orange',
    title: '"Tiền đi đâu hết rồi?"',
    body: 'Pro tự ghi giao dịch từ SMS ngân hàng — không còn quên, không còn đoán mò.',
  },
  {
    icon: <Sparkles size={20} />,
    tint: 'reason--purple',
    title: 'Không biết bắt đầu từ đâu',
    body: 'Báo cáo CFO viết riêng cho bạn mỗi tuần — gợi ý cụ thể nên làm gì tiếp theo.',
  },
  {
    icon: <Check size={20} />,
    tint: 'reason--green',
    title: 'Mục tiêu mãi dang dở',
    body: 'Không giới hạn mục tiêu, wishlist & nhiệm vụ — mọi kế hoạch đều có chỗ.',
  },
];

const FAQS = [
  {
    q: 'Hủy được không?',
    a: 'Được. Gói Pro không tự động gia hạn — hết hạn app tự về gói Base, bạn chủ động mua lại khi cần. Không có ràng buộc dài hạn.',
  },
  {
    q: 'Dùng thử có mất tiền không?',
    a: 'Hoàn toàn miễn phí trong 30 ngày, không cần nhập thẻ trước. Hết hạn app tự về gói Base, không tự trừ tiền.',
  },
  {
    q: 'Thanh toán qua đâu, có an toàn không?',
    a: 'Qua PayOS — cổng thanh toán được cấp phép tại Việt Nam. ManiCash không lưu thông tin thẻ của bạn.',
  },
  {
    q: 'Không dùng hết lượt AI thì sao?',
    a: 'Lượt AI reset mỗi ngày. Không dùng hết trong ngày thì không cộng dồn — nhưng gói Pro cho quota rộng rãi để bạn thoải mái dùng.',
  },
];

export default function UpgradeContent() {
  const status = useProStatus();
  const [openFaq, setOpenFaq] = useState<number | null>(1);

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

      {/* ─── HERO cảm xúc ─── */}
      <section className="upgrade-hero">
        <span className="upgrade-badge">
          <span className="upgrade-badge-gem">💎</span>
          <span className="upgrade-badge-text">MANICASH PRO</span>
        </span>
        <h1 className="upgrade-headline">
          Từ hoảng loạn cuối tháng<br />
          đến <span className="upgrade-headline-accent">làm chủ dòng tiền</span>
        </h1>
        <p className="upgrade-lead">
          Lord Diamond đồng hành mỗi ngày — nhắc bạn đúng lúc, chia tiền hộ bạn, và không bao giờ phán xét.
        </p>
        <div className="upgrade-rankup" aria-hidden="true">
          <span className="upgrade-hex upgrade-hex--iron" />
          <ArrowLeft size={18} className="upgrade-rankup-arrow" />
          <span className="upgrade-hex upgrade-hex--gold">👑</span>
          <ArrowLeft size={18} className="upgrade-rankup-arrow" />
          <span className="upgrade-hex upgrade-hex--diamond">💎</span>
        </div>
      </section>

      {/* ─── 3 lý do ─── */}
      <section className="upgrade-reasons">
        {REASONS.map((r) => (
          <div key={r.title} className="upgrade-reason">
            <span className={`upgrade-reason-icon ${r.tint}`}>{r.icon}</span>
            <div>
              <div className="upgrade-reason-title">{r.title}</div>
              <div className="upgrade-reason-body">{r.body}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ─── Bảng giá (giữ nguyên logic) ─── */}
      <section className="upgrade-pricing-section">
        <h2 className="upgrade-section-title">Chọn gói của bạn</h2>
        <PricingCards />
      </section>

      {/* ─── FAQ ─── */}
      <section className="upgrade-faq">
        <h2 className="upgrade-section-title">Câu hỏi thường gặp</h2>
        {FAQS.map((f, i) => {
          const open = openFaq === i;
          return (
            <button
              key={f.q}
              type="button"
              className={`upgrade-faq-item ${open ? 'upgrade-faq-item--open' : ''}`}
              onClick={() => setOpenFaq(open ? null : i)}
            >
              <div className="upgrade-faq-q">
                <span>{f.q}</span>
                <ChevronDown size={16} className={open ? 'upgrade-faq-chevron--open' : ''} />
              </div>
              {open && <p className="upgrade-faq-a">{f.a}</p>}
            </button>
          );
        })}
      </section>

      {/* ─── Trấn an ─── */}
      <div className="upgrade-reassure">
        <ShieldCheck size={15} />
        Thanh toán an toàn qua PayOS · hủy bất cứ lúc nào
        {!isMonetizationEnabled() && ' · (thanh toán chưa kích hoạt)'}
      </div>
      <p className="upgrade-social-placeholder">
        [ Cần dữ liệu người dùng thật từ PO để thêm phần đánh giá / số liệu ]
      </p>
    </div>
  );
}
