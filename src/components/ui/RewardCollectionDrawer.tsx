/* ═══ RewardCollectionDrawer — Tủ Sưu Tầm ═══
 *
 * Hiển thị toàn bộ catalog với trạng thái unlocked/locked.
 * Group theo type. User có thể chọn active zodiac/theme/title từ đây.
 *
 * Trigger: click vào ZodiacRunner trên header.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Check, Sparkles, ArrowLeft } from 'lucide-react';
import {
  REWARD_CATALOG,
  RARITY_META,
  type RewardItem,
  type RewardType,
} from '@/data/rewardCatalog';
import { useRewardStore } from '@/stores/useRewardStore';
import ELearningPreviewModal from './ELearningPreviewModal';
import './RewardCollectionDrawer.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<RewardType, string> = {
  zodiac:        '🐉 Linh vật (Con giáp)',
  theme:         '🎨 Giao diện',
  avatar_emoji:  '😎 Avatar đặc biệt',
  butler_outfit: '🤵 Trang phục Quản gia',
  sound_pack:    '🔔 Âm thanh',
  effect_input:  '✨ Hiệu ứng nhập',
  frame:         '🖼️ Khung viền',
  title:         '👑 Danh hiệu',
  elearning:     '🎓 Khóa học eLearning',
};

const TYPE_ORDER: RewardType[] = [
  'zodiac',
  'theme',
  'effect_input',
  'sound_pack',
  'title',
  'frame',
  'butler_outfit',
  'avatar_emoji',
  'elearning',
];

export default function RewardCollectionDrawer({ isOpen, onClose }: Props) {
  const isUnlocked = useRewardStore((s) => s.isUnlocked);
  const setActiveZodiac = useRewardStore((s) => s.setActiveZodiac);
  const setActiveTheme = useRewardStore((s) => s.setActiveTheme);
  const setActiveTitle = useRewardStore((s) => s.setActiveTitle);
  const activeZodiac = useRewardStore((s) => s.activeZodiac);
  const activeTheme = useRewardStore((s) => s.activeTheme);
  const activeTitle = useRewardStore((s) => s.activeTitle);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [previewItem, setPreviewItem] = useState<RewardItem | null>(null);

  const grouped = useMemo(() => {
    const out: Record<string, RewardItem[]> = {};
    for (const item of REWARD_CATALOG) {
      if (!out[item.type]) out[item.type] = [];
      out[item.type].push(item);
    }
    return out;
  }, []);

  const stats = useMemo(() => {
    const total = REWARD_CATALOG.length;
    const owned = REWARD_CATALOG.filter((r) => isUnlocked(r.id)).length;
    return { total, owned, percent: Math.round((owned / total) * 100) };
  }, [isUnlocked]);

  const handleSelect = (item: RewardItem) => {
    // eLearning luôn mở preview, kể cả khi chưa unlock (cho user xem nội dung sắp có)
    if (item.type === 'elearning') {
      setPreviewItem(item);
      return;
    }
    if (!isUnlocked(item.id)) return;
    if (item.type === 'zodiac') setActiveZodiac(item.id === activeZodiac ? null : item.id);
    else if (item.type === 'theme') setActiveTheme(item.id);
    else if (item.type === 'title') setActiveTitle(item.id === activeTitle ? null : item.id);
  };

  const isActive = (item: RewardItem): boolean => {
    if (item.type === 'zodiac') return item.id === activeZodiac;
    if (item.type === 'theme') return item.id === activeTheme;
    if (item.type === 'title') return item.id === activeTitle;
    return false;
  };

  // Portal target: .mobile-shell — drawer phải render ở root shell,
  // không phải bên trong AppHeader (z-index/positioning context).
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.querySelector('.mobile-shell') as HTMLElement | null;
    // Defer ra ngoài effect body — subscribe pattern hợp lệ
    queueMicrotask(() => setPortalEl(el || document.body));
  }, []);

  // ESC key đóng drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const filterItem = (item: RewardItem): boolean => {
    if (filter === 'all') return true;
    const unlocked = isUnlocked(item.id);
    return filter === 'unlocked' ? unlocked : !unlocked;
  };

  if (!portalEl) {
    return (
      <ELearningPreviewModal
        item={previewItem}
        unlocked={previewItem ? isUnlocked(previewItem.id) : false}
        onClose={() => setPreviewItem(null)}
      />
    );
  }

  const drawerNode = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="rcd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="rcd-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
            }}
          >
            {/* Drag handle — kéo xuống để đóng */}
            <div className="rcd-handle" aria-hidden="true" />

            <header className="rcd-header">
              {/* Back button góc trái — nổi bật để user dễ thoát */}
              <button className="rcd-back" onClick={onClose} aria-label="Quay lại">
                <ArrowLeft size={16} />
                <span>Quay lại</span>
              </button>
              <button className="rcd-close" onClick={onClose} aria-label="Đóng">
                <X size={18} />
              </button>
              <div className="rcd-header-content">
                <p className="rcd-header-label">Tủ Sưu Tầm</p>
                <h2 className="rcd-header-title">
                  {stats.owned}/{stats.total} đã mở khóa · {stats.percent}%
                </h2>
                <div className="rcd-header-progress">
                  <div
                    className="rcd-header-progress-fill"
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
              </div>
            </header>

            <div className="rcd-filter">
              {(['all', 'unlocked', 'locked'] as const).map((f) => (
                <button
                  key={f}
                  className={`rcd-filter-btn ${filter === f ? 'rcd-filter-btn--active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Tất cả' : f === 'unlocked' ? 'Đã có' : 'Chưa mở'}
                </button>
              ))}
            </div>

            <div className="rcd-body">
              {TYPE_ORDER.map((type) => {
                const items = (grouped[type] || []).filter(filterItem);
                if (items.length === 0) return null;
                return (
                  <section key={type} className="rcd-section">
                    <h3 className="rcd-section-title">{TYPE_LABELS[type]}</h3>
                    <div className="rcd-grid">
                      {items.map((item) => {
                        const unlocked = isUnlocked(item.id);
                        const active = isActive(item);
                        const rarity = RARITY_META[item.rarity];
                        // eLearning luôn click được (preview); các loại khác cần unlocked + selectable type
                        const canSelect =
                          item.type === 'elearning' ||
                          (unlocked &&
                            (item.type === 'zodiac' ||
                              item.type === 'theme' ||
                              item.type === 'title'));
                        return (
                          <button
                            key={item.id}
                            className={`rcd-card ${unlocked ? 'rcd-card--unlocked' : 'rcd-card--locked'} ${active ? 'rcd-card--active' : ''}`}
                            style={
                              {
                                '--rcd-rarity-color': rarity.color,
                                '--rcd-rarity-glow': rarity.glow,
                              } as React.CSSProperties
                            }
                            onClick={() => canSelect && handleSelect(item)}
                            disabled={!canSelect}
                          >
                            <div className="rcd-card-icon-wrap">
                              {unlocked ? (
                                <span className="rcd-card-icon">{item.icon}</span>
                              ) : (
                                <Lock size={20} className="rcd-card-lock" />
                              )}
                              {active && (
                                <span className="rcd-card-active-badge">
                                  <Check size={10} />
                                </span>
                              )}
                            </div>
                            <p className="rcd-card-name">{item.name}</p>
                            <p className="rcd-card-rarity" style={{ color: rarity.color }}>
                              {rarity.label}
                            </p>
                            {!unlocked && (
                              <p className="rcd-card-source" title={item.source}>
                                {item.source}
                              </p>
                            )}
                            {unlocked && canSelect && (
                              <p className="rcd-card-action">
                                {active ? 'Đang dùng' : 'Chọn'}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <div className="rcd-footer-note">
                <Sparkles size={14} />
                <span>
                  Mở khóa thêm bằng cách hoàn thành nhiệm vụ, đạt streak, lên rank, hoặc tham gia sự kiện theo mùa.
                </span>
              </div>

              {/* Bottom close button — fallback luôn visible khi scroll xuống */}
              <button className="rcd-bottom-close" onClick={onClose}>
                Đóng tủ sưu tầm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(
    <>
      {drawerNode}
      <ELearningPreviewModal
        item={previewItem}
        unlocked={previewItem ? isUnlocked(previewItem.id) : false}
        onClose={() => setPreviewItem(null)}
      />
    </>,
    portalEl
  );
}
