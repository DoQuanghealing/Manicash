/* ═══ PendingTransactionBanner — Overview entry point cho pending tx ═══
 *
 * Hiển thị khi user có ≥1 pending từ webhook. Tap → expand list inline.
 * Silent khi loading/error/demo mode (no Firestore) — không clutter UI.
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { usePendingTransactions } from '@/hooks/usePendingTransactions';
import PendingTransactionItem from './PendingTransactionItem';
import './PendingTransactions.css';

export default function PendingTransactionBanner() {
  const { pending, isLoading, error, confirm, reject } = usePendingTransactions();
  const [expanded, setExpanded] = useState(false);

  // Silent: loading state hoặc error (demo mode) → không render banner.
  if (isLoading) return null;
  if (error) return null;
  if (pending.length === 0) return null;

  return (
    <div className="ptx-banner">
      <button className="ptx-banner-header" onClick={() => setExpanded((v) => !v)} type="button">
        <Bell size={18} className="ptx-banner-icon" />
        <span className="ptx-banner-title">
          🔔 {pending.length} giao dịch chờ xác nhận
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="ptx-banner-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {pending.map((p) => (
              <PendingTransactionItem
                key={p.id}
                pending={p}
                onConfirm={confirm}
                onReject={reject}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
