/* ═══ MoneyReactionHost — Popup chúc mừng (thu) / cằn nhằn (chi) toàn app ═══
 * Subscribe moneyEvents (emit từ chat confirm + AI action). Thu → popup + pháo
 * hoa. Chi → toast cằn nhằn nhanh, icon động + 1 dòng mỉa mai (tông Lord Diamond
 * hiện có qua createMoneyReaction). Mount 1 lần trong (app) layout.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeMoneyRecorded, type MoneyRecordedDetail } from '@/lib/moneyEvents';
import { createMoneyReaction, type MoneyReactionSeverity } from '@/lib/aiMoneyChat/moneyReaction';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useConfetti } from '@/hooks/useConfetti';
import { formatCurrency } from '@/utils/formatCurrency';
import './MoneyReactionHost.css';

type IncomeState = { id: string; amount: number; text: string } | null;
type NagState = {
  id: string;
  amount: number;
  text: string;
  severity: MoneyReactionSeverity;
} | null;

const NAG_ICON: Record<MoneyReactionSeverity, string> = {
  warning: '😤',
  watch: '😒',
  neutral: '🙄',
  positive: '😏',
};

const INCOME_MS = 3200;
const NAG_MS = 2800;

export default function MoneyReactionHost() {
  const [income, setIncome] = useState<IncomeState>(null);
  const [nag, setNag] = useState<NagState>(null);
  const { fireConfetti } = useConfetti();
  const incomeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nagTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return subscribeMoneyRecorded((d: MoneyRecordedDetail) => {
      const goals = useGoalsStore.getState().goals.map((g) => ({
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
      }));
      const reaction = createMoneyReaction({
        type: d.type,
        amount: d.amount,
        categoryId: d.categoryId,
        goals,
      });

      if (d.type === 'income') {
        setIncome({ id: d.transactionId, amount: d.amount, text: reaction.text });
        fireConfetti('streak');
        clearTimeout(incomeTimer.current);
        incomeTimer.current = setTimeout(() => setIncome(null), INCOME_MS);
      } else {
        setNag({
          id: d.transactionId,
          amount: d.amount,
          text: reaction.text,
          severity: reaction.severity,
        });
        clearTimeout(nagTimer.current);
        nagTimer.current = setTimeout(() => setNag(null), NAG_MS);
      }
    });
  }, [fireConfetti]);

  useEffect(
    () => () => {
      clearTimeout(incomeTimer.current);
      clearTimeout(nagTimer.current);
    },
    [],
  );

  return (
    <>
      {/* ── Thu nhập: popup chúc mừng + pháo hoa ── */}
      <AnimatePresence>
        {income && (
          <motion.div
            key={income.id}
            className="mrx-income-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIncome(null)}
          >
            <motion.div
              className="mrx-income-card"
              initial={{ scale: 0.7, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mrx-income-emoji" aria-hidden>💰</div>
              <p className="mrx-income-label">Tiền về!</p>
              <p className="mrx-income-amount">+{formatCurrency(income.amount)}</p>
              <p className="mrx-income-text">{income.text}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chi tiêu: toast cằn nhằn nhanh, icon động + 1 dòng mỉa mai ── */}
      <AnimatePresence>
        {nag && (
          <motion.div
            key={nag.id}
            className={`mrx-nag mrx-nag--${nag.severity}`}
            initial={{ opacity: 0, y: -28, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            onClick={() => setNag(null)}
            role="status"
          >
            <span className="mrx-nag-icon" aria-hidden>{NAG_ICON[nag.severity]}</span>
            <span className="mrx-nag-text">{nag.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
