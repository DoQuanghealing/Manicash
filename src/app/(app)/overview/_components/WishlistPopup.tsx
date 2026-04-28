/* ═══ WishlistPopup — Dashboard popup khi hết cooling period ═══ */
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ShoppingCart, XCircle } from 'lucide-react';
import { useWishlistStore, REJECT_PRAISE } from '@/stores/useWishlistStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConfetti } from '@/hooks/useConfetti';
import { useAudio } from '@/hooks/useAudio';
import { formatCurrency } from '@/utils/formatCurrency';
import './WishlistPopup.css';


export default function WishlistPopup() {
  const items = useWishlistStore((s) => s.items);
  const buyItem = useWishlistStore((s) => s.buyItem);
  const rejectItem = useWishlistStore((s) => s.rejectItem);
  const dismissFromDashboard = useWishlistStore((s) => s.dismissFromDashboard);
  const { fireConfetti } = useConfetti();
  const { play } = useAudio();
  const router = useRouter();

  // Re-render every minute to detect cooling period expiry
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Compute popup items from raw data (avoid getSnapshot infinite loop)
  const popupItems = useMemo(() => {
    const now = Date.now();
    return items.filter(
      (i) =>
        i.status === 'cooling' &&
        new Date(i.expiresAt).getTime() <= now &&
        !i.dismissedFromDashboard
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, Math.floor(Date.now() / 60_000)]);

  const [showResult, setShowResult] = useState<{
    type: 'bought' | 'rejected';
    itemName: string;
    itemPrice: number;
    praise: string;
  } | null>(null);

  // Show only the first pending popup item
  const currentItem = popupItems[0] || null;

  const handleBuy = useCallback(() => {
    if (!currentItem) return;
    buyItem(currentItem.id);
    setShowResult({
      type: 'bought',
      itemName: currentItem.name,
      itemPrice: currentItem.price,
      praise: 'Cảm ơn bạn đã suy nghĩ kỹ trước khi ra quyết định. Mong rằng nó sẽ giúp bạn nhiều hơn bạn nghĩ. 🎯',
    });
    try { play('missionComplete'); } catch {}
  }, [currentItem, buyItem, play]);

  const handleReject = useCallback(() => {
    if (!currentItem) return;
    rejectItem(currentItem.id);
    // Grant XP cho hành vi resist — savedAmount = giá món để scale bonus theo formula RESIST_SPENDING.
    // Dùng getState() thay vì subscribe để callback không phụ thuộc identity của awardXP.
    useAuthStore.getState().awardXP({
      type: 'RESIST_SPENDING',
      savedAmount: currentItem.price,
    });
    const praise = REJECT_PRAISE[Math.floor(Math.random() * REJECT_PRAISE.length)];
    setShowResult({
      type: 'rejected',
      itemName: currentItem.name,
      itemPrice: currentItem.price,
      praise,
    });
    fireConfetti('rankUp');
    try { play('levelUp'); } catch {}
  }, [currentItem, rejectItem, fireConfetti, play]);

  const handleCloseResult = useCallback(() => {
    if (showResult?.type === 'bought') {
      // Navigate to Input page for expense recording
      setShowResult(null);
      router.push('/input');
    } else {
      setShowResult(null);
    }
  }, [showResult, router]);

  // Don't render anything if no popup items and no result showing
  if (!currentItem && !showResult) return null;

  return (
    <>
      {/* ═══ Cooling Expired Popup ═══ */}
      <AnimatePresence>
        {currentItem && !showResult && (
          <motion.div
            className="wlp-card"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="wlp-header">
              <span className="wlp-badge">🧊 Hết hạn làm mát</span>
              <button
                className="wlp-dismiss"
                onClick={() => dismissFromDashboard(currentItem.id)}
              >
                ✕
              </button>
            </div>

            <p className="wlp-item-name">{currentItem.name}</p>
            <p className="wlp-item-price">{formatCurrency(currentItem.price)}</p>

            {currentItem.reason && (
              <p className="wlp-reason">
                💬 Lý do ban đầu: <em>"{currentItem.reason}"</em>
              </p>
            )}

            <p className="wlp-question">Bạn vẫn muốn mua không?</p>

            <div className="wlp-actions">
              <button className="wlp-btn wlp-btn-buy" onClick={handleBuy}>
                <ShoppingCart size={16} />
                <span>Mua</span>
              </button>
              <button className="wlp-btn wlp-btn-reject" onClick={handleReject}>
                <XCircle size={16} />
                <span>Tôi không thực sự cần</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Result Popup (after choosing) ═══ */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            className="wlp-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseResult}
          >
            <motion.div
              className="wlp-result"
              initial={{ opacity: 0, y: 60, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="wlp-result-emoji">
                {showResult.type === 'rejected' ? '🏆' : '🛍️'}
              </span>

              <h3 className="wlp-result-title">
                {showResult.type === 'rejected' ? 'Chiến binh tài chính!' : 'Đã ghi nhận!'}
              </h3>

              <p className="wlp-result-praise">{showResult.praise}</p>

              {showResult.type === 'rejected' && (
                <div className="wlp-result-saved">
                  <span>Tiết kiệm được:</span>
                  <strong>{formatCurrency(showResult.itemPrice)}</strong>
                </div>
              )}

              <button className="wlp-result-close" onClick={handleCloseResult}>
                {showResult.type === 'bought' ? '💸 Ghi chi tiêu ngay' : '✨ Tuyệt vời!'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
