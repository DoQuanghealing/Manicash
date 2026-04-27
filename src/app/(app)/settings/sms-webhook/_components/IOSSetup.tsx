/* ═══ IOSSetup — iOS Shortcut text instructions ═══
 * Phase 1: text only. iOS limitation: cần tap Confirm mỗi SMS automation.
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
    icon: '📱',
    title: 'Mở Shortcuts app',
    body: 'Shortcuts có sẵn trên iOS 14+ (icon 2 hình chữ nhật xếp chồng).',
  },
  {
    num: 2,
    icon: '🎯',
    title: 'Tạo Automation mới',
    body: 'Tab "Automation" → "+" → "Create Personal Automation" → "Message" → chọn sender bank (vd "VCB").',
  },
  {
    num: 3,
    icon: '➕',
    title: 'Add Action: Get Contents of URL',
    body:
      '"+" → search "Get Contents of URL" → URL: dán URL webhook ở trên. ' +
      'Method: POST. Headers: Content-Type = application/json.',
  },
  {
    num: 4,
    icon: '📝',
    title: 'Request Body (JSON)',
    body:
      'Tap "Request Body" → JSON. Add fields:\n' +
      '• "token" (Text): dán token\n' +
      '• "sender" (Text): tap variable "Sender"\n' +
      '• "body" (Text): tap variable "Message"\n' +
      '• "receivedAt" (Text): tap variable "Current Date" → Format ISO 8601',
  },
  {
    num: 5,
    icon: '🚫',
    title: 'Tắt "Ask Before Running"',
    body:
      'Trang Automation Settings → tắt "Ask Before Running" → tắt "Notify When Run" để chạy silent ' +
      '(ngay cả vậy iOS vẫn có giới hạn — xem warning bên dưới).',
  },
  {
    num: 6,
    icon: '✅',
    title: 'Lặp cho từng bank',
    body:
      'Một automation = 1 sender. Tạo lại cho từng bank bạn dùng (VCB, TCB, MB...). Hoặc dùng "Any" sender ' +
      'và filter trong shortcut bằng Match Text.',
  },
];

export default function IOSSetup() {
  return (
    <div className="sw-guide">
      <p className="sw-guide-intro">
        iOS Shortcuts cho phép automation theo SMS. Setup ~3 phút mỗi bank.
      </p>

      <div className="sw-warning">
        ⚠️ <strong>Hạn chế của iOS:</strong> Apple yêu cầu user tap notification để
        confirm chạy automation. Không thể chạy hoàn toàn silent như Android. Mỗi SMS
        bank đến → có notification &quot;Automation triggered&quot; → tap để forward.
        <br />
        <br />
        Nếu cần fully automatic, dùng Android (MacroDroid).
      </div>

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
    </div>
  );
}
