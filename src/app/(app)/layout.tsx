/* ═══ App Layout — MobileShell + FloatingButler + XP Toast ═══ */
import type { ReactNode } from 'react';
import BottomNav from '@/components/layout/BottomNav';
import AppHeader from '@/components/layout/AppHeader';
import FloatingButler from '@/components/ui/FloatingButler';
import XPToastHost from '@/components/ui/XPToast';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="desktop-wrapper">
      <div className="mobile-shell">
        {/* Header: absolute top inside shell */}
        <AppHeader />

        {/* Scrollable content area */}
        <main className="shell-content">
          {children}
        </main>

        {/* Nav: absolute bottom inside shell */}
        <BottomNav />

        {/* Floating Butler: draggable AssistiveTouch */}
        <FloatingButler />

        {/* XP toast host — subscribe xpEvents, render stack top-right */}
        <XPToastHost />
      </div>
    </div>
  );
}
