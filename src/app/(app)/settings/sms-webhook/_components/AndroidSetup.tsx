/* ═══ AndroidSetup — MacroDroid text instructions ═══
 * Phase 1: text only, không có macro file import. Screenshots placeholder.
 */
'use client';

interface SetupStep {
  num: number;
  icon: string;
  title: string;
  body: string;
}

const STEPS: SetupStep[] = [
  {
    num: 1,
    icon: '📲',
    title: 'Cài MacroDroid',
    body: 'Tải app MacroDroid từ Google Play Store. Free version đủ dùng (giới hạn 5 macro).',
  },
  {
    num: 2,
    icon: '➕',
    title: 'Tạo macro mới',
    body: 'Mở MacroDroid → Add Macro → đặt tên (vd "ManiCash SMS Forward").',
  },
  {
    num: 3,
    icon: '🎯',
    title: 'Trigger: SMS Received',
    body: 'Add Trigger → Device Events → SMS Received → chọn "Any number" (hoặc filter sender bank cụ thể).',
  },
  {
    num: 4,
    icon: '🌐',
    title: 'Action: HTTP Request',
    body:
      'Add Action → Connectivity → HTTP Request. Method POST. URL: dán URL ở phần trên. ' +
      'Content Type: application/json.',
  },
  {
    num: 5,
    icon: '📝',
    title: 'Body JSON',
    body:
      'Body: dùng template MacroDroid với magic text:\n' +
      '{"token":"<paste token>","sender":"[sms_sender]","body":"[sms_message]","receivedAt":"[date]"}\n' +
      'Lưu ý: thay <paste token> bằng token thật, KHÔNG để dấu < >.',
  },
  {
    num: 6,
    icon: '🚫',
    title: 'Constraints (optional)',
    body:
      'Add Constraint → SMS Received → sender chứa tên bank (vd "VCB", "TCB"). Để chỉ forward SMS bank, ' +
      'tránh forward SMS cá nhân.',
  },
  {
    num: 7,
    icon: '✅',
    title: 'Save + Test',
    body:
      'Save macro. Gửi 1 SMS test (hoặc đợi giao dịch thật). Kiểm tra Overview tab xem có pending tx hiện ' +
      'lên không. Nếu không → vào MacroDroid → Action Block → Test để debug.',
  },
];

export default function AndroidSetup() {
  return (
    <div className="sw-guide">
      <p className="sw-guide-intro">
        MacroDroid là app automation miễn phí trên Android. Setup ~5 phút.
      </p>

      <ol className="sw-steps">
        {STEPS.map((step) => (
          <li key={step.num} className="sw-step">
            <div className="sw-step-num">{step.num}</div>
            <div className="sw-step-content">
              <p className="sw-step-title">
                <span className="sw-step-icon">{step.icon}</span>
                {step.title}
              </p>
              <p className="sw-step-body">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="sw-tip">
        💡 <strong>Tip:</strong> MacroDroid có thể chạy ở background liên tục. Allow
        battery optimization exception cho MacroDroid để tránh Android kill app.
      </div>
    </div>
  );
}
