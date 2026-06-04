import type { Metadata } from 'next';
import './legal.css';

export const metadata: Metadata = {
  robots: 'index, follow',
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <a href="/" className="legal-logo">💎 ManiCash</a>
      </header>
      <main className="legal-content">{children}</main>
      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} ManiCash. Tất cả quyền được bảo lưu.</p>
        <nav>
          <a href="/legal/privacy">Quyền riêng tư</a>
          <a href="/legal/terms">Điều khoản</a>
        </nav>
      </footer>
    </div>
  );
}
