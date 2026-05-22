/* ═══ GoalDetailModal — Chi tiết mục tiêu + lịch sử nạp + bank link ═══
 *
 * 3 phần:
 *   1. Header: icon, name, progress, countdown đến deadline
 *   2. Bank link section: hiển thị info nếu có, hoặc nút "Liên kết tài khoản"
 *      (gợi ý nổi bật khi targetAmount > 100M)
 *   3. Lịch sử nạp — list deposits với source icon + amount + note + time
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Landmark, Plus, Trash2, Calendar, Wallet, ShieldCheck, Target, Coins,
  ArrowDownToLine, Camera, Quote, Flame, Share2,
} from 'lucide-react';
import type { Goal, GoalDepositSource } from '@/types/budget';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import { calcDepositStreakWeeks, calcUrgency } from '@/lib/goalStats';
import { pickQuoteForGoal } from '@/data/goalQuotes';
import { compressImageToDataURL } from '@/lib/imageCompression';
import BankLinkModal from './BankLinkModal';
import GoalCalendar from './GoalCalendar';
import GoalPet from './GoalPet';
import GoalShareCard from './GoalShareCard';
import './GoalDetailModal.css';

interface Props {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDeposit: () => void;
}

const SOURCE_META: Record<GoalDepositSource, { label: string; icon: React.ReactNode; color: string }> = {
  main:          { label: 'TK chính',       icon: <Wallet size={14} />,        color: '#22C55E' },
  reserve:       { label: 'Dự phòng',       icon: <ShieldCheck size={14} />,   color: '#0EA5E9' },
  'goals-fund':  { label: 'Quỹ chung',      icon: <Target size={14} />,        color: '#A78BFA' },
  bank:          { label: 'Ngân hàng',      icon: <Landmark size={14} />,      color: '#EAB308' },
  manual:        { label: 'Tiền mặt',       icon: <Coins size={14} />,         color: '#F97316' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${String(d.getFullYear()).slice(-2)}`;
}

function daysUntil(deadline: string): number {
  const target = new Date(deadline).getTime();
  if (!target) return 0;
  const diff = target - Date.now();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function GoalDetailModal({ goal, isOpen, onClose, onOpenDeposit }: Props) {
  const getDeposits = useGoalsStore((s) => s.getDeposits);
  const unlinkBank = useGoalsStore((s) => s.unlinkBankAccount);
  const setPhoto = useGoalsStore((s) => s.setPhoto);
  const setWhyNote = useGoalsStore((s) => s.setWhyNote);
  const [bankLinkOpen, setBankLinkOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingWhy, setEditingWhy] = useState(false);
  const [whyDraft, setWhyDraft] = useState('');

  if (!goal) return null;

  const deposits = getDeposits(goal.id);
  const progress = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const days = daysUntil(goal.deadline);
  const monthlyNeeded = days > 0 ? (remaining / (days / 30)) : 0;

  // Gợi ý liên kết bank khi target > 100M và chưa liên kết
  const shouldSuggestBank = goal.targetAmount > 100_000_000 && !goal.bankInfo;

  // Streak + quote + urgency
  const streakWeeks = calcDepositStreakWeeks(deposits);
  const quote = pickQuoteForGoal(goal.id);
  const urgency = calcUrgency(goal);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataURL(file, {
        maxSize: 1280,
        quality: 0.82,
        mimeType: 'image/jpeg',
      });
      setPhoto(goal.id, dataUrl);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSaveWhy = () => {
    setWhyNote(goal.id, whyDraft.trim());
    setEditingWhy(false);
  };

  const startEditWhy = () => {
    setWhyDraft(goal.whyNote || '');
    setEditingWhy(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="gdt-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="gdt-panel"
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{ '--gdt-color': goal.color } as React.CSSProperties}
          >
            <button className="gdt-close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>

            {/* Photo backdrop nếu có */}
            {goal.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="gdt-photo-bg" src={goal.photoUrl} alt="" />
            )}

            {/* Hero */}
            <header className="gdt-hero">
              <div className="gdt-hero-icon" style={{ background: goal.color }}>
                <span>{goal.icon}</span>
              </div>
              <h2 className="gdt-title">{goal.name}</h2>
              <p className="gdt-deadline">
                <Calendar size={11} /> Đến {goal.deadline.slice(0, 10)} · còn {days} ngày
              </p>
              {/* Pet + Streak badges */}
              <div className="gdt-meta-row">
                <span className="gdt-meta-chip">
                  <GoalPet progress={progress} size={18} />
                  <span className="gdt-meta-chip-label">Linh vật</span>
                </span>
                {streakWeeks > 0 && (
                  <span className="gdt-meta-chip gdt-meta-chip--streak">
                    <Flame size={13} />
                    <span>{streakWeeks} tuần liên tiếp</span>
                  </span>
                )}
                {urgency !== 'ok' && (
                  <span className={`gdt-meta-chip gdt-meta-chip--urgency-${urgency}`}>
                    ⚠️ {urgency === 'critical' ? 'Sắp hết hạn!' : 'Cần đẩy nhanh'}
                  </span>
                )}
              </div>
            </header>

            {/* Progress */}
            <div className="gdt-progress-block">
              <div className="gdt-progress-row">
                <span className="gdt-amount-current">{formatCurrency(goal.currentAmount)}</span>
                <span className="gdt-amount-target">/ {formatCurrencyShort(goal.targetAmount)}</span>
              </div>
              <div className="gdt-progress-bar">
                <div className="gdt-progress-fill" style={{ width: `${progress}%`, background: goal.color }} />
              </div>
              <div className="gdt-progress-meta">
                <span>{progress}% hoàn thành</span>
                {monthlyNeeded > 0 && (
                  <span>~{formatCurrencyShort(monthlyNeeded)}/tháng để đạt</span>
                )}
              </div>
            </div>

            {/* Quick actions: Deposit + Share */}
            <div className="gdt-quick-actions">
              <button
                className="gdt-deposit-btn"
                onClick={() => { onClose(); onOpenDeposit(); }}
              >
                <ArrowDownToLine size={16} />
                <span>Nạp tiền</span>
              </button>
              <button
                className="gdt-share-btn"
                onClick={() => setShareOpen(true)}
                aria-label="Chia sẻ tiến độ"
                title="Chia sẻ tiến độ"
              >
                <Share2 size={15} />
              </button>
            </div>

            {/* Inspirational quote */}
            <div className="gdt-quote">
              <Quote size={14} className="gdt-quote-mark" />
              <div className="gdt-quote-body">
                <p className="gdt-quote-text">{quote.text}</p>
                {quote.author && <p className="gdt-quote-author">— {quote.author}</p>}
              </div>
            </div>

            {/* Why note + Photo upload */}
            <section className="gdt-personal">
              {editingWhy ? (
                <div className="gdt-why-edit">
                  <textarea
                    className="gdt-why-textarea"
                    placeholder="Vì sao bạn muốn đạt mục tiêu này?"
                    value={whyDraft}
                    onChange={(e) => setWhyDraft(e.target.value)}
                    rows={3}
                    maxLength={240}
                    autoFocus
                  />
                  <div className="gdt-why-actions">
                    <button className="gdt-why-cancel" onClick={() => setEditingWhy(false)}>
                      Hủy
                    </button>
                    <button className="gdt-why-save" onClick={handleSaveWhy}>
                      Lưu
                    </button>
                  </div>
                </div>
              ) : (
                <button className="gdt-why-display" onClick={startEditWhy}>
                  <p className="gdt-why-label">📝 Lý do tôi muốn</p>
                  <p className="gdt-why-text">
                    {goal.whyNote || 'Bấm để thêm lý do — đọc lại khi cám dỗ.'}
                  </p>
                </button>
              )}

              <label className="gdt-photo-upload">
                <Camera size={14} />
                <span>{goal.photoUrl ? 'Đổi ảnh' : 'Thêm ảnh'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  style={{ display: 'none' }}
                />
              </label>
            </section>

            {/* Bank link */}
            {goal.bankInfo ? (
              <section className="gdt-bank-card">
                <div className="gdt-bank-header">
                  <Landmark size={16} />
                  <span className="gdt-bank-title">Tài khoản liên kết</span>
                  <button
                    className="gdt-bank-unlink"
                    onClick={() => unlinkBank(goal.id)}
                    aria-label="Bỏ liên kết"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="gdt-bank-name">{goal.bankInfo.bankName}</p>
                <p className="gdt-bank-number">
                  •••• •••• {goal.bankInfo.accountNumber.slice(-4)}
                  {goal.bankInfo.accountHolder && (
                    <span className="gdt-bank-holder"> · {goal.bankInfo.accountHolder}</span>
                  )}
                </p>
                <p className="gdt-bank-balance">
                  Khai báo: {formatCurrency(goal.bankInfo.declaredBalance)}
                </p>
              </section>
            ) : (
              <button
                className={`gdt-link-bank ${shouldSuggestBank ? 'gdt-link-bank--suggest' : ''}`}
                onClick={() => setBankLinkOpen(true)}
              >
                <Landmark size={15} />
                <div className="gdt-link-bank-body">
                  <span className="gdt-link-bank-title">
                    {shouldSuggestBank ? '💡 Gợi ý: tạo tài khoản riêng' : 'Liên kết tài khoản ngân hàng'}
                  </span>
                  <span className="gdt-link-bank-sub">
                    {shouldSuggestBank
                      ? `Mục tiêu ${formatCurrencyShort(goal.targetAmount)} nên có TK riêng — tránh tiêu nhầm`
                      : 'Đồng bộ với tài khoản tiết kiệm riêng cho mục tiêu này'}
                  </span>
                </div>
                <Plus size={14} />
              </button>
            )}

            {/* Calendar heatmap */}
            {deposits.length > 0 && (
              <section className="gdt-calendar-section">
                <p className="gdt-section-label">Hoạt động 90 ngày qua</p>
                <GoalCalendar deposits={deposits} color={goal.color} />
              </section>
            )}

            {/* History */}
            <section className="gdt-history">
              <div className="gdt-history-header">
                <span className="gdt-history-label">Lịch sử nạp</span>
                <span className="gdt-history-count">{deposits.length} lần</span>
              </div>

              {deposits.length === 0 ? (
                <div className="gdt-history-empty">
                  <Coins size={20} />
                  <p>Chưa có khoản nạp nào.</p>
                  <p className="gdt-history-empty-hint">Bấm &ldquo;Nạp tiền&rdquo; để bắt đầu.</p>
                </div>
              ) : (
                <div className="gdt-history-list">
                  {deposits.map((dep) => {
                    const meta = SOURCE_META[dep.source];
                    return (
                      <div key={dep.id} className="gdt-history-item">
                        <div
                          className="gdt-history-icon"
                          style={{ color: meta.color, background: `${meta.color}1F` }}
                        >
                          {meta.icon}
                        </div>
                        <div className="gdt-history-body">
                          <div className="gdt-history-row">
                            <span className="gdt-history-amount">
                              +{formatCurrency(dep.amount)}
                            </span>
                            <span className="gdt-history-date">{formatTime(dep.createdAt)}</span>
                          </div>
                          <p className="gdt-history-sub">
                            <span className="gdt-history-source">{meta.label}</span>
                            {dep.note && <span className="gdt-history-note"> · {dep.note}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </motion.div>
        </motion.div>
      )}

      <BankLinkModal
        goal={goal}
        isOpen={bankLinkOpen}
        onClose={() => setBankLinkOpen(false)}
      />

      <GoalShareCard
        goal={goal}
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </AnimatePresence>
  );
}
