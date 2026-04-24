/* ═══ Auth Layout — No bottom nav ═══ */
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="desktop-wrapper">
      <div className="mobile-shell">
        {children}
      </div>
    </div>
  );
}
