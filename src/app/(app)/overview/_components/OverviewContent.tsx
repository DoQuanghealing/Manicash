/* ═══ Overview Content — Financial Intelligence Dashboard v3 (1-2-3 Layout) ═══ */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { resolveVibe } from '@/lib/ageGroup';
import { getCopy } from '@/data/vibedCopy';
import SafeToSpendCard from './SafeToSpendCard';
import BudgetWarningBanner from './BudgetWarningBanner';
import PendingTransactionBanner from './PendingTransactionBanner';
import MissionChecklist from './MissionChecklist';
import OnboardingQuestPanel from './OnboardingQuestPanel';
import DailyQuestCard from './DailyQuestCard';
import WeeklyChallengeCard from './WeeklyChallengeCard';
import SeasonalEventBanner from './SeasonalEventBanner';
import UpcomingHolidayHint from './UpcomingHolidayHint';
import IdleMoneyBanner from './IdleMoneyBanner';
import WishlistPopup from './WishlistPopup';
import MonthlyReportModal from './MonthlyReportModal';
import BankSyncReminder from '@/components/ui/BankSyncReminder';
import { isSmsWebhookEnabled } from '@/lib/featureFlags';

// Nạp 3 khối vừa tạo (1-2-3)
import IncomeBlock from './IncomeBlock';
import ExpenseBillBlock from './ExpenseBillBlock';
import FundsBlock from './FundsBlock';

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

        {/* ═══ BLOCK 1: Safe-to-Spend Balance & Warning ═══ */}
        <SafeToSpendCard />
        <PendingTransactionBanner />
        <BudgetWarningBanner />
        {isSmsWebhookEnabled() && <BankSyncReminder />}

        {/* ═══ BLOCK 1b: Cảnh báo tiền nhàn rỗi → CTA chia vào mục tiêu ═══ */}
        <IdleMoneyBanner />

        {/* ═══ NEW: GIAO DIỆN 1-2-3 ═══ */}
        {/* Khối 1: Thu nhập (Full-width) */}
        <IncomeBlock />
        
        {/* Khối 2: Chi tiêu & Hóa đơn (Chia 2) */}
        <ExpenseBillBlock />
        
        {/* Khối 3: Các Quỹ (Chia 3) */}
        <FundsBlock />

        {/* ═══ BLOCK 4: Fixed Bills Summary ═══ */}
        {/* ═══ BLOCK 5: Wishlist Popup (auto khi hết cooling) ═══ */}
        <WishlistPopup />

        {/* ═══ BLOCK 6a: Lộ trình tân thủ 7 bước (tự ẩn khi xong) ═══ */}
        <OnboardingQuestPanel />

        {/* ═══ BLOCK 6b: 3 nhiệm vụ hàng ngày ═══ */}
        <DailyQuestCard />

        {/* ═══ BLOCK 6c: Thử thách tuần (xoay vòng 4 theme) ═══ */}
        <WeeklyChallengeCard />

        {/* ═══ BLOCK 6d: Gói nhiệm vụ tối ưu tài chính (legacy 3-bước) ═══ */}
        <MissionChecklist />

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
