/* ═══ Overview Content — Financial Intelligence Dashboard v3 (1-2-3 Layout) ═══ */
'use client';

import { useEffect } from 'react';
import { useBudgetStore } from '@/stores/useBudgetStore';
import SafeToSpendCard from './SafeToSpendCard';
import BudgetWarningBanner from './BudgetWarningBanner';
import PendingTransactionBanner from './PendingTransactionBanner';
import FixedBillsSummary from './FixedBillsSummary';
import MissionChecklist from './MissionChecklist';
import WishlistPopup from './WishlistPopup';
import MonthlyReportModal from './MonthlyReportModal';

// Nạp 3 khối vừa tạo (1-2-3)
import IncomeBlock from './IncomeBlock';
import ExpenseBillBlock from './ExpenseBillBlock';
import FundsBlock from './FundsBlock';

export default function OverviewContent() {
  // Trigger rollover check 1 lần khi mount Overview. Idempotent — nếu cùng tháng
  // thì là no-op; nếu tháng mới → grant BUDGET_ON_TRACK XP + generate butler report.
  const checkAndRollover = useBudgetStore((s) => s.checkAndRollover);
  useEffect(() => {
    checkAndRollover();
  }, [checkAndRollover]);

  return (
    <>
      <div className="stack stack-md">
        {/* ═══ BLOCK 1: Safe-to-Spend Balance & Warning ═══ */}
        <SafeToSpendCard />
        <PendingTransactionBanner />
        <BudgetWarningBanner />

        {/* ═══ NEW: GIAO DIỆN 1-2-3 ═══ */}
        {/* Khối 1: Thu nhập (Full-width) */}
        <IncomeBlock />
        
        {/* Khối 2: Chi tiêu & Hóa đơn (Chia 2) */}
        <ExpenseBillBlock />
        
        {/* Khối 3: Các Quỹ (Chia 3) */}
        <FundsBlock />

        {/* ═══ BLOCK 4: Fixed Bills Summary ═══ */}
        <FixedBillsSummary />

        {/* ═══ BLOCK 5: Wishlist Popup (auto khi hết cooling) ═══ */}
        <WishlistPopup />

        {/* ═══ BLOCK 6: Gợi ý nhiệm vụ tối ưu tài chính ═══ */}
        <MissionChecklist />

        {/* ═══ BLOCK 6: Wellness & Chữa lành ═══ */}
        <WellnessCard />
      </div>

      {/* Monthly butler report modal — auto show khi unviewedReportMonth có giá trị */}
      <MonthlyReportModal />
    </>
  );
}

/* ═══ Wellness Card — Preserved from original ═══ */
function WellnessCard() {
  const hour = new Date().getHours();

  let icon = '🌅';
  let text = 'Chào ngày mới! Hít thở sâu 3 phút trước khi bắt đầu nhé.';

  if (hour >= 12 && hour < 15) {
    icon = '🚶';
    text = 'Chiều rồi! Đi bộ 15 phút để giảm stress và tái tạo năng lượng.';
  } else if (hour >= 15 && hour < 18) {
    icon = '🏊';
    text = 'Đi bơi hoặc tập thể dục buổi chiều để có năng lượng cho buổi tối!';
  } else if (hour >= 18 && hour < 21) {
    icon = '🍽️';
    text = 'Buổi tối thư giãn. Ăn nhẹ và nghỉ ngơi cho ngày mai hiệu quả hơn.';
  } else if (hour >= 21 || hour < 6) {
    icon = '🌙';
    text = 'Ngủ trước 11h để cơ thể phục hồi tốt nhất. Ngày mai sẽ tốt hơn!';
  }

  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
      <span style={{ fontSize: '1.5rem', marginTop: 2 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--c-green)', marginBottom: 2 }}>
          Chữa lành & Tái tạo
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
          {text}
        </p>
      </div>
    </div>
  );
}
