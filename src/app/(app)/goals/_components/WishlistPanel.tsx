/* ═══ WishlistPanel — Danh sách mong muốn + Trophy Wall ═══ */
'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trophy, Clock, ShoppingBag, X, Check, Trash2 } from 'lucide-react';
import { useWishlistStore, type CoolingHours, type WishlistItem } from '@/stores/useWishlistStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './WishlistPanel.css';

const COOLING_OPTIONS: { label: string; value: CoolingHours }[] = [
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
  { label: '72h', value: 72 },
  { label: '4 ngày', value: 96 },
  { label: '1 tuần', value: 168 },
];

export default function WishlistPanel() {
  const items = useWishlistStore((s) => s.items);
  const addItem = useWishlistStore((s) => s.addItem);
  const removeItem = useWishlistStore((s) => s.removeItem);
  const getCoolingItems = useWishlistStore((s) => s.getCoolingItems);
  const getReadyItems = useWishlistStore((s) => s.getReadyItems);
  const getRejectedItems = useWishlistStore((s) => s.getRejectedItems);
  const getBoughtItems = useWishlistStore((s) => s.getBoughtItems);
  const totalSaved = useWishlistStore((s) => s.getTotalSaved());

  const [showAddForm, setShowAddForm] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [, setTick] = useState(0);

  // Re-render every minute to update countdown timers
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formCooling, setFormCooling] = useState<CoolingHours>(48);

  const coolingItems = getCoolingItems();
  const readyItems = getReadyItems();
  const rejectedItems = getRejectedItems();
  const boughtItems = getBoughtItems();

  const handleAdd = () => {
    const price = parseInt(formPrice.replace(/\D/g, ''), 10) || 0;
    if (!formName.trim() || price <= 0) return;
    addItem({ name: formName.trim(), price, reason: formReason.trim(), coolingHours: formCooling });
    setFormName('');
    setFormPrice('');
    setFormReason('');
    setFormCooling(48);
    setShowAddForm(false);
  };

  const handlePriceChange = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw.length <= 12) {
      setFormPrice(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
    }
  };

  return (
    <div className="wl-panel">
      {/* ── Guide Box ── */}
      <div className="wl-guide">
        <div className="wl-guide-icon">🧊</div>
        <div>
          <p className="wl-guide-title">Quy tắc làm mát não</p>
          <p className="wl-guide-text">
            Nếu bạn muốn mua gì đó giá trên <strong>1 triệu</strong>, hãy thêm nó vào wishlist.
            Thiết lập thời gian tối thiểu <strong>48h</strong> — trong thời gian đó hãy quên nó đi và làm việc khác.
            Sau khi hết hạn, nó sẽ tự hiện trên <strong>Tổng quan</strong> để bạn quyết định.
          </p>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="wl-actions">
        <button className="wl-add-btn" onClick={() => setShowAddForm(true)}>
          <Plus size={16} />
          <span>Thêm vật phẩm</span>
        </button>
        <button className="wl-trophy-btn" onClick={() => setShowTrophy(true)}>
          <Trophy size={16} />
          <span>Bia chiến công</span>
          {rejectedItems.length > 0 && (
            <span className="wl-trophy-badge">{rejectedItems.length}</span>
          )}
        </button>
      </div>

      {/* ── Cooling Items ── */}
      {coolingItems.length > 0 && (
        <div className="wl-section">
          <p className="wl-section-title">🧊 Đang làm mát ({coolingItems.length})</p>
          <div className="wl-item-list">
            {coolingItems.map((item) => (
              <WishlistCard key={item.id} item={item} onRemove={removeItem} />
            ))}
          </div>
        </div>
      )}

      {/* ── Ready Items ── */}
      {readyItems.length > 0 && (
        <div className="wl-section">
          <p className="wl-section-title">✅ Sẵn sàng quyết định ({readyItems.length})</p>
          <div className="wl-item-list">
            {readyItems.map((item) => (
              <WishlistCard key={item.id} item={item} onRemove={removeItem} />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {items.length === 0 && (
        <div className="wl-empty">
          <span className="wl-empty-icon">🎯</span>
          <p className="wl-empty-title">Chưa có vật phẩm nào</p>
          <p className="wl-empty-desc">
            Thêm những thứ bạn muốn mua vào đây để kiểm tra xem bạn có thực sự cần không.
          </p>
        </div>
      )}

      {/* ═══ Add Item Modal ═══ */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            className="wl-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              className="wl-modal"
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="wl-modal-close" onClick={() => setShowAddForm(false)}>
                <X size={18} />
              </button>

              <h3 className="wl-modal-title">🛒 Thêm vật phẩm mong muốn</h3>

              <div className="wl-form-group">
                <label className="wl-form-label">Tên vật phẩm</label>
                <input
                  className="wl-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: MacBook Air M4..."
                  autoFocus
                />
              </div>

              <div className="wl-form-group">
                <label className="wl-form-label">Giá trị</label>
                <div className="wl-form-price-wrap">
                  <input
                    className="wl-form-input wl-form-price"
                    type="text"
                    inputMode="numeric"
                    value={formPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="0"
                  />
                  <span className="wl-form-currency">đ</span>
                </div>
              </div>

              <div className="wl-form-group">
                <label className="wl-form-label">Vì sao bạn muốn mua?</label>
                <textarea
                  className="wl-form-textarea"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Ghi lý do để bạn nhìn lại sau 48h..."
                  rows={2}
                />
              </div>

              <div className="wl-form-group">
                <label className="wl-form-label">⏳ Thời gian làm mát não</label>
                <div className="wl-cooling-grid">
                  {COOLING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`wl-cooling-chip ${formCooling === opt.value ? 'active' : ''}`}
                      onClick={() => setFormCooling(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="wl-form-submit"
                onClick={handleAdd}
                disabled={!formName.trim() || !formPrice}
              >
                🧊 Thêm & Bắt đầu làm mát
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Trophy Wall Modal ═══ */}
      <AnimatePresence>
        {showTrophy && (
          <motion.div
            className="wl-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTrophy(false)}
          >
            <motion.div
              className="wl-modal"
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="wl-modal-close" onClick={() => setShowTrophy(false)}>
                <X size={18} />
              </button>

              <h3 className="wl-modal-title">🏆 Bia chiến công</h3>
              <p className="wl-trophy-subtitle">
                Những thứ bạn đã quyết định <strong>KHÔNG MUA</strong>
              </p>

              {/* Total Saved */}
              <div className="wl-trophy-total">
                <span className="wl-trophy-total-label">Tổng tiền tiết kiệm được</span>
                <span className="wl-trophy-total-value">{formatCurrency(totalSaved)}</span>
              </div>

              {/* Rejected items list */}
              {rejectedItems.length === 0 ? (
                <div className="wl-empty" style={{ marginTop: 'var(--space-md)' }}>
                  <span className="wl-empty-icon">🏅</span>
                  <p className="wl-empty-title">Chưa có chiến công nào</p>
                  <p className="wl-empty-desc">Khi bạn từ chối mua vật phẩm, nó sẽ xuất hiện ở đây.</p>
                </div>
              ) : (
                <div className="wl-trophy-list">
                  {rejectedItems.map((item) => (
                    <div key={item.id} className="wl-trophy-item">
                      <div className="wl-trophy-item-badge">🏅</div>
                      <div className="wl-trophy-item-info">
                        <p className="wl-trophy-item-name">{item.name}</p>
                        <p className="wl-trophy-item-date">
                          {new Date(item.resolvedAt || '').toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <span className="wl-trophy-item-price">
                        +{formatCurrencyShort(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Bought items */}
              {boughtItems.length > 0 && (
                <>
                  <p className="wl-section-title" style={{ marginTop: 'var(--space-lg)' }}>
                    🛍️ Đã mua ({boughtItems.length})
                  </p>
                  <div className="wl-trophy-list">
                    {boughtItems.map((item) => (
                      <div key={item.id} className="wl-trophy-item wl-trophy-item--bought">
                        <div className="wl-trophy-item-badge">🛍️</div>
                        <div className="wl-trophy-item-info">
                          <p className="wl-trophy-item-name">{item.name}</p>
                          <p className="wl-trophy-item-date">
                            {new Date(item.resolvedAt || '').toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <span className="wl-trophy-item-price" style={{ color: 'var(--c-orange)' }}>
                          -{formatCurrencyShort(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ Wishlist Item Card ═══ */
function WishlistCard({ item, onRemove }: { item: WishlistItem; onRemove: (id: string) => void }) {
  const now = Date.now();
  const expiresAt = new Date(item.expiresAt).getTime();
  const isCooling = item.status === 'cooling' && expiresAt > now;
  const isReady = !isCooling && (item.status === 'cooling' || item.status === 'ready');

  // Countdown
  const remaining = Math.max(0, expiresAt - now);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const progress = isCooling
    ? Math.round(((item.coolingHours * 3600000 - remaining) / (item.coolingHours * 3600000)) * 100)
    : 100;

  return (
    <motion.div
      className={`wl-card ${isCooling ? 'wl-card--cooling' : ''} ${isReady ? 'wl-card--ready' : ''}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="wl-card-top">
        <div>
          <p className="wl-card-name">{item.name}</p>
          <p className="wl-card-price">{formatCurrency(item.price)}</p>
        </div>
        <button className="wl-card-delete" onClick={() => onRemove(item.id)}>
          <Trash2 size={14} />
        </button>
      </div>

      {item.reason && (
        <p className="wl-card-reason">💬 {item.reason}</p>
      )}

      {/* Progress bar + status */}
      <div className="wl-card-status-row">
        {isCooling ? (
          <>
            <Clock size={12} className="wl-card-clock" />
            <div className="wl-card-progress-track">
              <div className="wl-card-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="wl-card-time">{hours}h {minutes}m</span>
          </>
        ) : isReady ? (
          <div className="wl-card-ready-badge">
            <Check size={12} />
            <span>Đã hết hạn — kiểm tra Tổng quan</span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
