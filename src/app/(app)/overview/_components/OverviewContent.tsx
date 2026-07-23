/* ═══ Overview Content — Financial Intelligence Dashboard v3 (1-2-3 Layout) ═══ */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { resolveVibe } from '@/lib/ageGroup';
import { getCopy } from '@/data/vibedCopy';
import SafeToSpendCard from './SafeToSpendCard';
import CoachSuggestionCard from './CoachSuggestionCard';
import CareCard from '@/components/butler/CareCard';
import SovereignMigrationBanner from '@/components/butler/SovereignMigrationBanner';
import AlertsInbox from './AlertsInbox';
import MissionChecklist from './MissionChecklist';
import OnboardingQuestPanel from './OnboardingQuestPanel';
import DailyQuestCard from './DailyQuestCard';
import WeeklyChallengeCard from './WeeklyChallengeCard';
import SeasonalEventBanner from './SeasonalEventBanner';
import UpcomingHolidayHint from './UpcomingHolidayHint';
import WishlistPopup from './WishlistPopup';
import MonthlyReportModal from './MonthlyReportModal';
import BankSyncReminder from '@/components/ui/BankSyncReminder';
import { isSmsWebhookEnabled } from '@/lib/featureFlags';

import MoneyGrid from './MoneyGrid';
import './overview-tasks.css';

export default function OverviewContent() {
  // NOTE: checkAndRollover đã được gọi ở RolloverGuard (app layout),
  // không cần gọi lại ở đây.

  return (
    <>
      <div className="stack stack-md">
        {/* ═══ BLOCK 0: Sự kiện theo mùa (tự ẩn khi không có event active) ═══ */}
        <SeasonalEventBanner />

        {/* ═══ BLOCK 0b: Holiday lunar sắp đến (tự ẩn nếu trùng với event đang active) ═══ */}
        <UpcomingHolidayHint />

        {/* ═══ BLOCK 1: Safe-to-Spend Balance ═══ */}
        {/* ═══ PV-5: báo trước migration Free-sovereign (14 ngày + 7 ngày trial) ═══ */}
        <SovereignMigrationBanner />

        <SafeToSpendCard />

        {/* ═══ BLOCK 1c: Đề xuất chủ động của quản gia (chỉ tier Phú Vương) ═══ */}
        <CoachSuggestionCard />

        {/* ═══ BLOCK 1c2: Nhịp chăm sóc Care Companion (chỉ tier Phú Vương · 0đ) ═══ */}
        <CareCard />

        {/* ═══ BLOCK 1b: Alerts inbox — gộp budget/pending-txn/idle-money thành 1 thanh ═══ */}
        <AlertsInbox />
        {isSmsWebhookEnabled() && <BankSyncReminder />}

        {/* ═══ BLOCK 2: Lưới "Tiền tháng này" 2×2 (entry-tile → mở route chi tiết) ═══ */}
        <MoneyGrid />

        {/* ═══ BLOCK 5: Wishlist Popup (auto khi hết cooling) ═══ */}
        <WishlistPopup />

        {/* ═══ BLOCK 6: Khu "Nhiệm vụ" — gom 4 loại quest rời vào 1 khay có tiêu đề ═══ */}
        <section className="ov-tasks">
          <div className="ov-tasks-head">
            <span className="ov-tasks-icon" aria-hidden="true">🎯</span>
            <h2 className="ov-tasks-title">Nhiệm vụ của bạn</h2>
          </div>
          {/* 6a: Lộ trình tân thủ 7 bước (tự ẩn khi xong) */}
          <OnboardingQuestPanel />
          {/* 6b: 3 nhiệm vụ hàng ngày */}
          <DailyQuestCard />
          {/* 6c: Thử thách tuần */}
          <WeeklyChallengeCard />
          {/* 6d: Gói nhiệm vụ tối ưu tài chính (legacy 3-bước) */}
          <MissionChecklist />
        </section>

        {/* ═══ BLOCK 7: Wellness & Chữa lành ═══ */}
        <WellnessCard />
      </div>

      {/* Monthly butler report modal — auto show khi unviewedReportMonth có giá trị */}
      <MonthlyReportModal />
    </>
  );
}

/* ═══ Wellness Card — Text vibed theo nhóm tuổi ═══ */
function WellnessCard() {
  const yearOfBirth = useAuthStore((s) => s.user?.yearOfBirth);
  const appVibe = useSettingsStore((s) => s.appVibe);
  const vibe = resolveVibe(appVibe, yearOfBirth);

  const hour = new Date().getHours();
  let key = 'wellness.morning';
  if (hour >= 12 && hour < 15) key = 'wellness.afternoon';
  else if (hour >= 15 && hour < 18) key = 'wellness.late_afternoon';
  else if (hour >= 18 && hour < 21) key = 'wellness.evening';
  else if (hour >= 21 || hour < 6) key = 'wellness.night';

  const text = getCopy(key, vibe);
  const icon = text.split(' ')[0]; // emoji prefix
  const body = text.substring(icon.length).trim();

  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
      <span style={{ fontSize: '1.5rem', marginTop: 2 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--c-green)', marginBottom: 2 }}>
          Chữa lành &amp; Tái tạo
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
    </div>
  );
}
