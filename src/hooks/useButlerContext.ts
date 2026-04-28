/* ═══ useButlerContext — Notification + Micro-bubble message system ═══
 * Returns 2 types of messages:
 * 1. notification: iPhone-style banner (bill reminders, savings nudges, wellness)
 * 2. microPhrase: tiny bubble on the butler button (15 rotating action phrases)
 */
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useBudgetAlert } from '@/hooks/useBudgetAlert';
import {
  BUTLER_MICRO_PHRASES,
  WELLNESS_SLOTS,
  SAVINGS_NUDGES,
} from '@/data/butlerMessages';
import { formatCurrency } from '@/utils/formatCurrency';

export interface ButlerNotification {
  text: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ButlerContextResult {
  /** iPhone-style notification banner content */
  notification: ButlerNotification;
  /** Tiny phrase for the button micro-bubble */
  microPhrase: string;
  /** Force next notification */
  nextNotification: () => void;
}

/* ── Anti-repeat helper ── */
let lastMicroIdx = -1;
function pickRandom<T>(arr: T[], lastIdx: number): { item: T; idx: number } {
  if (arr.length === 0) return { item: arr[0], idx: 0 };
  let idx: number;
  do { idx = Math.floor(Math.random() * arr.length); } while (idx === lastIdx && arr.length > 1);
  return { item: arr[idx], idx };
}

/* ── Build notifications pool from current state ── */
function buildNotificationPool(
  fixedBills: { name: string; amount: number; dueDay: number; isPaid: boolean }[],
  hasDanger: boolean,
  hasWarning: boolean,
  alerts: { categoryName: string; percent: number }[],
): ButlerNotification[] {
  const pool: ButlerNotification[] = [];
  const today = new Date().getDate();
  const hour = new Date().getHours();

  // 1. Bill reminders (high priority)
  fixedBills.forEach((bill) => {
    if (bill.isPaid) return;
    const daysLeft = bill.dueDay - today;
    if (daysLeft < 0) {
      pool.push({
        text: `Bill "${bill.name}" (${formatCurrency(bill.amount)}) đã QUÁ HẠN rồi! Thanh toán ngay nhé! 🚨`,
        priority: 'high',
      });
    } else if (daysLeft === 0) {
      pool.push({
        text: `Hôm nay là hạn chót bill "${bill.name}" (${formatCurrency(bill.amount)})! Trả ngay kẻo quên! ⏰`,
        priority: 'high',
      });
    } else if (daysLeft <= 3) {
      pool.push({
        text: `Bill "${bill.name}" còn ${daysLeft} ngày nữa là đến hạn. Trả sớm khỏi lo! 📋`,
        priority: 'high',
      });
    }
  });

  // 2. Budget warnings
  if (hasDanger && alerts.length > 0) {
    pool.push({
      text: `"${alerts[0].categoryName}" đã vượt ngân sách! Cẩn thận chi tiêu nhé cậu chủ 🚨`,
      priority: 'high',
    });
  }
  if (hasWarning && alerts.length > 0) {
    pool.push({
      text: `"${alerts[0].categoryName}" đã dùng ${alerts[0].percent}% ngân sách tháng rồi đó ⚠️`,
      priority: 'medium',
    });
  }

  // 3. Savings nudges (medium priority)
  const nudge = SAVINGS_NUDGES[Math.floor(Math.random() * SAVINGS_NUDGES.length)];
  pool.push({ text: nudge, priority: 'medium' });

  // 4. Wellness messages (low priority, time-aware)
  const slot = WELLNESS_SLOTS.find((s) => hour >= s.hourStart && hour < s.hourEnd);
  if (slot) {
    const msg = slot.messages[Math.floor(Math.random() * slot.messages.length)];
    pool.push({ text: msg, priority: 'low' });
  }

  return pool;
}

export function useButlerContext(): ButlerContextResult {
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const butlerName = useSettingsStore((s) => s.butlerName);
  const { hasDanger, hasWarning, alerts } = useBudgetAlert();
  const [notifIdx, setNotifIdx] = useState(0);

  // Build notification pool
  const notifPool = useMemo(
    () => buildNotificationPool(fixedBills, hasDanger, hasWarning, alerts),
    [fixedBills, hasDanger, hasWarning, alerts],
  );

  // Current notification — cycle through pool
  const notification = useMemo(() => {
    const idx = notifIdx % notifPool.length;
    const notif = notifPool[idx];
    // Replace butler name if customized
    if (butlerName && butlerName !== 'Lord Diamond') {
      return { ...notif, text: notif.text.replaceAll('Lord Diamond', butlerName) };
    }
    return notif;
  }, [notifPool, notifIdx, butlerName]);

  const nextNotification = useCallback(() => {
    setNotifIdx((prev) => prev + 1);
  }, []);

  // Micro-phrase — stable per render cycle
  const microPhrase = useMemo(() => {
    const { item, idx } = pickRandom(BUTLER_MICRO_PHRASES, lastMicroIdx);
    lastMicroIdx = idx;
    return item;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifIdx]); // changes when notification cycles

  return { notification, microPhrase, nextNotification };
}
