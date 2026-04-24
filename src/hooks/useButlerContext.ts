/* ═══ useButlerContext — Proactive message selection ═══ */
'use client';

import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useBudgetAlert } from '@/hooks/useBudgetAlert';
import { getButlerMessage } from '@/data/butlerMessages';

export interface ButlerProactiveMsg {
  text: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
}

export function useButlerContext(): ButlerProactiveMsg {
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const butlerName = useSettingsStore((s) => s.butlerName);
  const { hasDanger, hasWarning, alerts } = useBudgetAlert();

  return useMemo(() => {
    const today = new Date().getDate();

    // Priority 1: Bill due today or overdue
    const dueBill = fixedBills.find((b) => !b.isPaid && b.dueDay <= today);
    if (dueBill) {
      return {
        text: `⏰ Bill "${dueBill.name}" đã đến hạn! Thanh toán ngay kẻo quên nhé!`,
        priority: 'high' as const,
        icon: '🔴',
      };
    }

    // Priority 2: Bill coming in 3 days
    const soonBill = fixedBills.find((b) => !b.isPaid && b.dueDay > today && b.dueDay <= today + 3);
    if (soonBill) {
      return {
        text: `📋 Còn ${soonBill.dueDay - today} ngày nữa là đến hạn "${soonBill.name}"!`,
        priority: 'high' as const,
        icon: '🟡',
      };
    }

    // Priority 3: Budget danger
    if (hasDanger && alerts.length > 0) {
      return {
        text: `🚨 "${alerts[0].categoryName}" đã vượt ngân sách! Cẩn thận chi tiêu nhé.`,
        priority: 'high' as const,
        icon: '🔴',
      };
    }

    // Priority 4: Budget warning
    if (hasWarning && alerts.length > 0) {
      return {
        text: `⚠️ "${alerts[0].categoryName}" đã dùng ${alerts[0].percent}% ngân sách tháng.`,
        priority: 'medium' as const,
        icon: '🟡',
      };
    }

    // Default: motivational
    const msg = getButlerMessage('daily_greeting', butlerName);
    return {
      text: msg.text,
      priority: 'low' as const,
      icon: '💬',
    };
  }, [fixedBills, hasDanger, hasWarning, alerts, butlerName]);
}
