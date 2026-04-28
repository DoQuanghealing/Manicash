/* ═══ App Layout — MobileShell + FloatingButler + XP Toast + RolloverGuard ═══ */
import type { ReactNode } from 'react';
import BottomNav from '@/components/layout/BottomNav';
import AppHeader from '@/components/layout/AppHeader';
import FloatingButler from '@/components/ui/FloatingButler';
import ButlerNotifBanner from '@/components/ui/ButlerNotifBanner';
import XPToastHost from '@/components/ui/XPToast';
import RolloverGuard from './RolloverGuard';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="desktop-wrapper">
      <div className="mobile-shell">
        {/* Header: absolute top inside shell */}
        <AppHeader />

        {/* Budget month rollover — runs once per app load */}
        <RolloverGuard />

        {/* Scrollable content area */}
        <main className="shell-content">
          {/* Butler notification: slides below header */}
          <ButlerNotifBanner />
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

