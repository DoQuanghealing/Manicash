/* ═══ Login Page — Server Component ═══ */
import type { Metadata } from 'next';
import LoginForm from './LoginForm';
import './login.css';

export const metadata: Metadata = {
  title: 'Đăng nhập — ManiCash',
  description: 'Đăng nhập vào ManiCash — ứng dụng quản lý tài chính cá nhân với AI quản gia thông minh',
};

export default function LoginPage() {
  return (
    <div className="login-page">
      {/* Ambient glow background */}
      <div className="login-bg-glow" />

      {/* Main login card */}
      <div className="login-card">
        <div className="login-crown">👑</div>
        <h1 className="login-title">ManiCash</h1>
        <p className="login-subtitle">
          Quản gia tài chính thông minh<br />
          Kiếm nhiều hơn. Chi ít hơn. Sống tốt hơn.
        </p>

        <LoginForm />
      </div>

      {/* Butler welcome */}
      <div className="login-butler">
        <div className="login-butler-bubble">
          <span className="login-butler-avatar">🎩</span>
          <p className="login-butler-text">
            <span className="login-butler-name">Lord Diamond</span> — Quản gia
            của bạn đã sẵn sàng. Đăng nhập để bắt đầu hành trình tài chính!
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <p>Bảo mật bằng Google Authentication</p>
      </div>
    </div>
  );
}
