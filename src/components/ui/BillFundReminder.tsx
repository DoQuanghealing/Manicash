/* ═══ BillFundReminder — Galaxy-style popup after income ═══ */
'use client';

import { useState, useEffect } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { replaceButlerName } from '@/utils/butlerNameUtils';
import './BillFundReminder.css';

const REMINDER_MESSAGES = [
  'Cậu chủ ơi, hãy trích một phần sang quỹ bill cố định nhé! Đừng để cuối tháng phải chạy đôn chạy đáo! 🏦',
  'Lord Diamond nhắc nhở: Trả bill đúng hạn = bình yên đầu óc + thêm XP kỷ luật! 🎯',
  'Tiền vừa về mà chưa trích quỹ bill? Lord Diamond hơi lo lắng đấy... 😰',
  'Mỗi đồng vào quỹ bill = mỗi đêm ngủ ngon. Cậu chủ chọn cái nào? 🌙',
  'Gợi ý: Trích 30% thu nhập cho bill cố định. Đây là luật vàng của chiến binh tài chính! ⚔️',
  'Nhà cửa, điện nước, trả góp... chúng không chờ đợi đâu. Trích quỹ ngay nhé! ⏰',
  'Lord Diamond đã tính: Cậu còn thiếu cho quỹ bill. Trích ngay khi còn "nóng" nhé! 🔥',
  'Người giàu trả bill trước, tiêu sau. Cậu chủ muốn giàu không? Trích quỹ thôi! 💎',
  'Một khoản trích nhỏ hôm nay = không áp lực trả bill cuối tháng. Đơn giản vậy thôi! ✨',
  'Quỹ bill đang chờ được nạp thêm. Cậu chủ hào phóng với nó một chút được không? 🙏',
];

interface BillFundReminderProps {
  isOpen: boolean;
  onClose: () => void;
  incomeAmount: number;
}

export default function BillFundReminder({ isOpen, onClose, incomeAmount }: BillFundReminderProps) {
  const butlerName = useSettingsStore((s) => s.butlerName);
  const [message] = useState(() => {
    const raw = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
    return replaceButlerName(raw, butlerName);
  });
  const [customAmount, setCustomAmount] = useState('');
  const addToBillFund = useFinanceStore((s) => s.addToBillFund);
  const getTotalBills = useFinanceStore((s) => s.getTotalBills);
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);

  const suggestedAmount = Math.round(incomeAmount * 0.3);
  const totalBills = getTotalBills();
  const shortage = Math.max(0, totalBills - billFundBalance);

  const handleQuickTransfer = (amount: number) => {
    addToBillFund(amount);
    onClose();
  };

  const handleCustomTransfer = () => {
    const amt = parseInt(customAmount.replace(/\D/g, ''), 10);
    if (amt > 0) {
      addToBillFund(amt);
      onClose();
    }
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
        <h3 className="bfr-title">Quỹ Bill Cố Định</h3>

        {/* Message */}
        <p className="bfr-message">{message}</p>

        {/* Stats */}
        <div className="bfr-stats">
          <div className="bfr-stat">
            <span className="bfr-stat-label">Còn thiếu</span>
            <span className="bfr-stat-value shortage">{shortage.toLocaleString('vi-VN')}đ</span>
          </div>
          <div className="bfr-stat">
            <span className="bfr-stat-label">Đã có</span>
            <span className="bfr-stat-value fund">{billFundBalance.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        {/* Quick amounts */}
        <div className="bfr-quick-btns">
          <button className="bfr-quick-btn" onClick={() => handleQuickTransfer(suggestedAmount)}>
            30% ({(suggestedAmount / 1000000).toFixed(1)}tr)
          </button>
          <button className="bfr-quick-btn" onClick={() => handleQuickTransfer(Math.round(incomeAmount * 0.2))}>
            20% ({(Math.round(incomeAmount * 0.2) / 1000000).toFixed(1)}tr)
          </button>
          <button className="bfr-quick-btn" onClick={() => handleQuickTransfer(Math.round(incomeAmount * 0.1))}>
            10% ({(Math.round(incomeAmount * 0.1) / 1000000).toFixed(1)}tr)
          </button>
        </div>

        {/* Custom amount */}
        <div className="bfr-custom">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Hoặc nhập số tiền..."
            value={customAmount}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              setCustomAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
            }}
            className="bfr-custom-input"
          />
          <button className="bfr-custom-btn" onClick={handleCustomTransfer} disabled={!customAmount}>
            Trích
          </button>
        </div>

        {/* Skip */}
        <button className="bfr-skip" onClick={onClose}>
          Để sau — Tôi sẽ trích sau 😅
        </button>
      </div>
    </div>
  );
}
