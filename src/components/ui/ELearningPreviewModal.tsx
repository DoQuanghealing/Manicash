/* ═══ ELearningPreviewModal — Preview content trong app eLearning tương lai ═══
 *
 * Khi user click item type='elearning' trong Tủ Sưu Tầm → modal hiện preview
 * + "Coming soon" + waitlist email signup. Email lưu vào localStorage cho V1
 * (chưa có backend), khi launch eLearning app sẽ migrate.
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Check, Lock, Play, Sparkles, X } from 'lucide-react';
import type { RewardItem } from '@/data/rewardCatalog';
import './ELearningPreviewModal.css';

interface Props {
  item: RewardItem | null;
  unlocked: boolean;
  onClose: () => void;
}

const WAITLIST_KEY = 'manicash_elearning_waitlist_email';

function readStoredEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(WAITLIST_KEY) || '';
  } catch {
    return '';
  }
}

export default function ELearningPreviewModal({ item, unlocked, onClose }: Props) {
  // Lazy init từ localStorage — tránh setState trong useEffect
  const [email, setEmail] = useState(readStoredEmail);
  const [saved, setSaved] = useState(() => !!readStoredEmail());

  if (!item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    localStorage.setItem(WAITLIST_KEY, trimmed);
    setSaved(true);
  };

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="elm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="elm-panel"
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="elm-close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>

            {/* Hero preview */}
            <div className="elm-hero">
              <div className="elm-hero-poster">
                <span className="elm-hero-icon">{item.icon}</span>
                {unlocked ? (
                  <div className="elm-play-overlay">
                    <Play size={28} />
                  </div>
                ) : (
                  <div className="elm-lock-overlay">
                    <Lock size={24} />
                  </div>
                )}
              </div>
              <div className="elm-hero-badge">eLearning</div>
            </div>

            <div className="elm-body">
              <h2 className="elm-title">{item.name}</h2>
              <p className="elm-desc">{item.description}</p>

              {unlocked ? (
                <div className="elm-status elm-status--unlocked">
                  <Sparkles size={14} />
                  <span>Bạn đã mở khóa nội dung này</span>
                </div>
              ) : (
                <div className="elm-status elm-status--locked">
                  <Lock size={14} />
                  <span>Mở khóa qua: {item.source}</span>
                </div>
              )}

              {/* Coming soon block */}
              <div className="elm-coming">
                <p className="elm-coming-label">🚧 App eLearning đang phát triển</p>
                <p className="elm-coming-body">
                  Nội dung &ldquo;{item.name}&rdquo; sẽ được phát hành trong app{' '}
                  <strong>&ldquo;Biến mọi thứ thành tiền&rdquo;</strong> — chuyên về
                  tâm thức thịnh vượng, phong thủy tài lộc &amp; triết lý Á Đông.
                  Đăng ký để được thông báo khi ra mắt.
                </p>

                {saved ? (
                  <div className="elm-saved">
                    <Check size={16} />
                    <span>Đã đăng ký: <strong>{email}</strong></span>
                    <button
                      type="button"
                      className="elm-change-btn"
                      onClick={() => setSaved(false)}
                    >
                      Đổi email
                    </button>
                  </div>
                ) : (
                  <form className="elm-form" onSubmit={handleSubmit}>
                    <input
                      type="email"
                      className="elm-input"
                      placeholder="email@cua.ban"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <button type="submit" className="elm-submit">
                      <BellRing size={14} />
                      Đăng ký
                    </button>
                  </form>
                )}

                <p className="elm-disclaimer">
                  Email chỉ dùng để thông báo phát hành. Không spam, không bán cho bên thứ ba.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
