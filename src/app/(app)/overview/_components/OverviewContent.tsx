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
import TasksHub from './TasksHub';
import WishlistPopup from './WishlistPopup';
import MonthlyReportModal from './MonthlyReportModal';
import BankSyncReminder from '@/components/ui/BankSyncReminder';
import { isSmsWebhookEnabled } from '@/lib/featureFlags';

import MoneyBlocks from './MoneyBlocks';

export default function OverviewContent() {
  // NOTE: checkAndRollover đã được gọi ở RolloverGuard (app layout),
  // không cần gọi lại ở đây.

  return (
    <>
      <div className="stack stack-md">
        {/* ═══ Sự kiện theo mùa + teaser holiday: đã gộp vào TasksHub (tab "Sự kiện") ═══ */}

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
        <MoneyBlocks />

        {/* ═══ BLOCK 5: Wishlist Popup (auto khi hết cooling) ═══ */}
        <WishlistPopup />

        {/* ═══ BLOCK 6: Khu "Nhiệm vụ" — 1 cửa sổ, chia giai đoạn (tab), làm từng bộ ═══ */}
        <TasksHub />

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
