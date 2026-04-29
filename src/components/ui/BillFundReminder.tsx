/* ═══ BillFundReminder — Galaxy-style popup after income ═══
 * Now uses SplitFundsPanel for full fund allocation (Bill + Savings)
 * instead of only Bill Fund quick buttons.
 */
'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { replaceButlerName } from '@/utils/butlerNameUtils';
import type { SplitResult } from '@/stores/useDashboardStore';
import SplitFundsPanel from './SplitFundsPanel';
import './BillFundReminder.css';

const REMINDER_MESSAGES = [
  'Cậu chủ ơi, thu nhập vừa về! Hãy chia ra các quỹ để bảo vệ tài chính nhé! 💰',
  'Lord Diamond nhắc nhở: Chia tiền ngay khi nhận = kỷ luật tài chính + XP bonus! 🎯',
  'Tiền vừa về mà chưa chia? Lord Diamond hơi lo lắng đấy... 😰',
  'Chia tiền trước, tiêu sau. Đây là luật vàng của chiến binh tài chính! ⚔️',
  'Người giàu chia tiền ngay khi nhận. Cậu chủ muốn giàu không? Chia ngay thôi! 💎',
  'Mỗi lần chia tiền đúng cách = thêm 1 bước tới tự do tài chính! ✨',
];

interface BillFundReminderProps {
  isOpen: boolean;
  onClose: () => void;
  incomeAmount: number;
  onSplitComplete?: (result: SplitResult) => void;
}

export default function BillFundReminder({ isOpen, onClose, incomeAmount, onSplitComplete }: BillFundReminderProps) {
  const butlerName = useSettingsStore((s) => s.butlerName);
  const [message] = useState(() => {
    const raw = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
    return replaceButlerName(raw, butlerName);
  });

  const handleSplitConfirm = (result: SplitResult) => {
    onSplitComplete?.(result);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bfr-overlay" onClick={onClose}>
      <div className="bfr-modal" onClick={(e) => e.stopPropagation()}>
        {/* Galaxy decoration */}
        <div className="bfr-stars" />
        <div className="bfr-glow" />

        {/* Butler */}
        <div className="bfr-butler">🎩</div>
        <h3 className="bfr-title">Phân bổ thu nhập</h3>

        {/* Message */}
        <p className="bfr-message">{message}</p>

        {/* SplitFundsPanel — shared component */}
        <SplitFundsPanel
          totalAmount={incomeAmount}
          onConfirm={handleSplitConfirm}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
