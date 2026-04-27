/* ═══ SMS Webhook Settings Page ═══
 *
 * Path: /settings/sms-webhook
 * Hiển thị token + setup guide. Pro feature flag (currently always allowed).
 */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { canUseSmsWebhook } from '@/utils/proGating';
import TokenDisplay from './_components/TokenDisplay';
import SetupGuide from './_components/SetupGuide';
import './_components/sms-webhook.css';
import './_components/sms-webhook-dialog.css';
import './_components/sms-webhook-guide.css';

export default function SmsWebhookSettingsPage() {
  const user = useAuthStore((s) => s.user);
  // TODO Pro launch: canUseSmsWebhook sẽ enforce — hiện always true.
  const allowed = canUseSmsWebhook(user);

  if (!allowed) {
    return (
      <div className="sw-page">
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
      <header className="sw-header">
        <h1 className="sw-h1">SMS Webhook</h1>
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
