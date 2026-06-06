/* ═══ Public Account Deletion Request — không cần đăng nhập ═══
 * Google Play yêu cầu có URL công khai để user request xóa dữ liệu
 * mà không cần phải login vào app.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import '../../legal/legal.css';

export const metadata: Metadata = {
  title: 'Yêu cầu xóa tài khoản — ManiCash',
  description: 'Hướng dẫn yêu cầu xóa tài khoản và dữ liệu cá nhân trên ManiCash.',
  robots: 'noindex',
};

export default function DeleteRequestPage() {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <Link href="/" className="legal-logo">💎 ManiCash</Link>
      </header>

      <main className="legal-content">
        <h1>Yêu cầu xóa tài khoản</h1>
        <p className="legal-meta">Có hiệu lực từ ngày 01/06/2026</p>

        <div className="legal-note">
          <strong>⏱ Quy trình 30 ngày:</strong> Sau khi gửi yêu cầu, tài khoản
          sẽ được lên lịch xóa sau <strong>30 ngày</strong>. Trong thời gian này,
          bạn vẫn có thể đăng nhập lại để huỷ yêu cầu và giữ lại dữ liệu.
        </div>

        <h2>Cách 1 — Xóa trực tiếp trong ứng dụng (khuyến nghị)</h2>
        <p>
          Đây là cách nhanh nhất và an toàn nhất. Bạn có thể tải xuống toàn bộ
          dữ liệu trước khi xóa.
        </p>
        <ol style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li style={{ color: '#A1A1AA', fontSize: '0.9375rem', lineHeight: '1.7', marginBottom: '6px' }}>
            Đăng nhập vào ManiCash tại{' '}
            <Link href="/login">manicash.app/login</Link>
          </li>
          <li style={{ color: '#A1A1AA', fontSize: '0.9375rem', lineHeight: '1.7', marginBottom: '6px' }}>
            Vào tab <strong>Hồ sơ</strong> (biểu tượng người dùng góc trên phải)
          </li>
          <li style={{ color: '#A1A1AA', fontSize: '0.9375rem', lineHeight: '1.7', marginBottom: '6px' }}>
            Kéo xuống dưới cùng, chọn <strong>“Yêu cầu xóa tài khoản”</strong>
          </li>
          <li style={{ color: '#A1A1AA', fontSize: '0.9375rem', lineHeight: '1.7', marginBottom: '6px' }}>
            Tải xuống dữ liệu nếu muốn, sau đó xác nhận yêu cầu
          </li>
        </ol>

        <h2>Cách 2 — Gửi yêu cầu qua email</h2>
        <p>
          Nếu bạn không thể đăng nhập, hãy gửi email đến{' '}
          <a href="mailto:support@manicash.app">support@manicash.app</a> với nội dung:
        </p>
        <ul>
          <li>Tiêu đề: <strong>Yêu cầu xóa tài khoản ManiCash</strong></li>
          <li>Địa chỉ email Google mà bạn đã dùng để đăng nhập</li>
          <li>Lý do (không bắt buộc)</li>
        </ul>
        <p>
          Chúng tôi sẽ xử lý trong vòng <strong>7 ngày làm việc</strong> và gửi
          email xác nhận khi hoàn tất.
        </p>

        <h2>Dữ liệu sẽ bị xóa</h2>
        <ul>
          <li>Hồ sơ người dùng (tên, email, ảnh đại diện)</li>
          <li>Tất cả giao dịch tài chính, ngân sách, số dư ví</li>
          <li>Mục tiêu tài chính và tiến độ</li>
          <li>Nhiệm vụ kiếm tiền và checklist</li>
          <li>Điểm XP, streak và thứ hạng</li>
          <li>Wishlist và lịch sử kiềm chế chi tiêu</li>
          <li>Token SMS Webhook (nếu có)</li>
        </ul>

        <h2>Dữ liệu không bị xóa ngay lập tức</h2>
        <p>
          Các bản sao lưu hệ thống và log kiểm toán ẩn danh có thể được giữ lại
          tối đa <strong>90 ngày</strong> theo yêu cầu bảo mật, sau đó sẽ bị xóa
          hoàn toàn.
        </p>

        <div className="legal-note" style={{ marginTop: '32px' }}>
          <strong>📧 Liên hệ hỗ trợ:</strong>{' '}
          <a href="mailto:support@manicash.app">support@manicash.app</a>
          <br />
          <Link href="/legal/privacy" style={{ marginTop: '8px', display: 'inline-block' }}>
            Xem Chính sách quyền riêng tư →
          </Link>
        </div>
      </main>

      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} ManiCash.</p>
        <nav>
          <Link href="/legal/privacy">Quyền riêng tư</Link>
          <Link href="/legal/terms">Điều khoản</Link>
        </nav>
      </footer>
    </div>
  );
}
