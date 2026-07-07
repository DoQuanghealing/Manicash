/* ═══ AlertsInbox — Gộp cảnh báo Overview thành 1 thanh thu gọn ═══
 *
 * Chỉ là LỚP TRÌNH BÀY ngoài cùng — mỗi banner con (BudgetWarningBanner,
 * PendingTransactionBanner, IdleMoneyBanner) vẫn giữ NGUYÊN 100% logic điều
 * kiện hiển thị + hành động bên trong. Component này chỉ tính lại (read-only)
 * cùng điều kiện để hiện số đếm "N điều cần chú ý" ở thanh thu gọn, và render
 * các banner con thật bên trong phần mở rộng khi bấm.
 */
'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { useBudgetAlert } from '@/hooks/useBudgetAlert';
import { usePendingTransactions } from '@/hooks/usePendingTransactions';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import BudgetWarningBanner from './BudgetWarningBanner';
import PendingTransactionBanner from './PendingTransactionBanner';
import IdleMoneyBanner from './IdleMoneyBanner';
import './AlertsInbox.css';

const IDLE_THRESHOLD = 100_000_000;

export default function AlertsInbox() {
  const [expanded, setExpanded] = useState(false);

  const { count: budgetCount } = useBudgetAlert();
  const { pending, isLoading, error } = usePendingTransactions();
  const pendingCount = isLoading || error ? 0 : pending.length;

  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const goals = useGoalsStore((s) => s.goals);
  const idleActive = useMemo(() => {
    if (mainBalance <= IDLE_THRESHOLD) return false;
    return goals.some((g) => g.currentAmount < g.targetAmount);
  }, [mainBalance, goals]);
  // Không tái tạo trạng thái "đã dismiss 24h" ở đây — IdleMoneyBanner tự quyết
  // định ẩn/hiện thật khi render; đếm ở đây chỉ là ước tính cho số hiển thị.

  const totalCount = budgetCount + pendingCount + (idleActive ? 1 : 0);

  if (totalCount === 0) {
    // Không có gì đáng chú ý — vẫn phải mount PendingTransactionBanner/IdleMoneyBanner
    // ẩn để giữ side-effect (không có, chúng tự return null) — an toàn bỏ qua.
    return null;
  }

  const previewParts: string[] = [];
  if (budgetCount > 0) previewParts.push(`${budgetCount} danh mục vượt ngưỡng`);
  if (pendingCount > 0) previewParts.push(`${pendingCount} giao dịch chờ xác nhận`);
  if (idleActive) previewParts.push('tiền nhàn rỗi');

  return (
    <div className="ai-inbox">
      <button type="button" className="ai-inbox-bar" onClick={() => setExpanded((v) => !v)}>
        <span className="ai-inbox-icon-wrap">
          <Bell size={19} />
          <span className="ai-inbox-dot" />
        </span>
        <div className="ai-inbox-text">
          <span className="ai-inbox-title">{totalCount} điều cần chú ý</span>
          <span className="ai-inbox-sub">{previewParts.join(' · ')}</span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="ai-inbox-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <BudgetWarningBanner />
            <PendingTransactionBanner />
            <IdleMoneyBanner />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
