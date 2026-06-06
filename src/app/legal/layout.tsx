import type { Metadata } from 'next';
import Link from 'next/link';
import './legal.css';

export const metadata: Metadata = {
  robots: 'index, follow',
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <Link href="/" className="legal-logo">💎 ManiCash</Link>
      </header>
      <main className="legal-content">{children}</main>
      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} ManiCash. Tất cả quyền được bảo lưu.</p>
        <nav>
          <Link href="/legal/privacy">Quyền riêng tư</Link>
          <Link href="/legal/terms">Điều khoản</Link>
        </nav>
      </footer>
    </div>
  );
}
