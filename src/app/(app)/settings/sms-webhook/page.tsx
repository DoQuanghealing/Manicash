/* ═══ SMS Webhook Settings Page ═══
 *
 * Path: /settings/sms-webhook
 * Hiển thị token + setup guide. Pro feature flag (currently always allowed).
 */
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { canUseSmsWebhook } from '@/utils/proGating';
import TokenDisplay from './_components/TokenDisplay';
import SetupGuide from './_components/SetupGuide';
import './_components/sms-webhook.css';
import './_components/sms-webhook-dialog.css';
import './_components/sms-webhook-guide.css';

export default function SmsWebhookSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // TODO Pro launch: canUseSmsWebhook sẽ enforce — hiện always true.
  const allowed = canUseSmsWebhook(user);

  // Quay về page trước (thường là Money). Nếu mở trực tiếp /settings/sms-webhook
  // (không có history), fallback về /money để user không bị kẹt.
  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/money');
  };

  // Sticky nav bar — luôn thấy nút back kể cả khi cuộn dài (setup guide).
  const navBar = (
    <div className="sw-navbar">
      <button
        type="button"
        className="sw-back-btn"
        onClick={handleBack}
        aria-label="Quay lại"
      >
        <ArrowLeft size={22} />
      </button>
      <h1 className="sw-navbar-title">SMS Webhook</h1>
    </div>
  );

  if (!allowed) {
    return (
      <div className="sw-page">
        {navBar}
        <div className="sw-locked">
          <p className="sw-locked-icon">🔒</p>
          <p className="sw-locked-title">Tính năng dành cho gói Pro</p>
          <p className="sw-locked-desc">
            Nâng cấp để dùng SMS Webhook — tự động nhập giao dịch từ SMS ngân hàng.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-page">
      {navBar}
      <header className="sw-header">
        <p className="sw-h1-desc">
          Tự động nhập giao dịch ngân hàng từ SMS — không cần API ngân hàng. Setup
          MacroDroid (Android) hoặc Shortcut (iOS) forward SMS tới webhook của app.
        </p>
      </header>

      <TokenDisplay />
      <SetupGuide />
    </div>
  );
}
