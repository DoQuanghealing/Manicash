/* ═══ App Layout — MobileShell + FloatingButler + XP Toast + RolloverGuard ═══ */
import type { ReactNode } from 'react';
import BottomNav from '@/components/layout/BottomNav';
import AppHeader from '@/components/layout/AppHeader';
import FloatingButler from '@/components/ui/FloatingButler';
import ButlerNotifBanner from '@/components/ui/ButlerNotifBanner';
import XPToastHost from '@/components/ui/XPToast';
import RolloverGuard from './RolloverGuard';
import BanMenhThemeApplier from '@/components/providers/BanMenhThemeApplier';
import StreakShieldToast from '@/components/ui/StreakShieldToast';
import QuestCompletionPopup from '@/components/ui/QuestCompletionPopup';
import QuestHintBar from '@/components/ui/QuestHintBar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="desktop-wrapper">
      <div className="mobile-shell">
        {/* Header: absolute top inside shell */}
        <AppHeader />

        {/* Budget month rollover — runs once per app load */}
        <RolloverGuard />

        {/* Apply theme accent theo bản mệnh (activeTheme=banmenh) hoặc theme tĩnh */}
        <BanMenhThemeApplier />

        {/* Scrollable content area */}
        <main className="shell-content">
          {children}
        </main>

        {/* Butler notification: absolute overlay inside shell, route-aware */}
        <ButlerNotifBanner />

        {/* Nav: absolute bottom inside shell */}
        <BottomNav />

        {/* Floating Butler: draggable AssistiveTouch */}
        <FloatingButler />

        {/* XP toast host — subscribe xpEvents, render stack top-right */}
        <XPToastHost />

        {/* Streak Shield used banner — detect shieldsUsedAt[] tăng */}
        <StreakShieldToast />

        {/* Quest Hint Bar — hiện khi user đang làm 1 quest (setActiveContext) */}
        <QuestHintBar />

        {/* Quest Completion Popup — khi quest từ in-progress → completed */}
        <QuestCompletionPopup />
      </div>
    </div>
  );
}
