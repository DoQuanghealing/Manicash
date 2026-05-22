/* ═══ ProfileEditModal — Edit identity fields + avatar ═══
 *
 * Fields:
 *   - displayName
 *   - email
 *   - yearOfBirth (1900..currentYear)
 *   - Avatar: upload photo (auto-compressed) OR pick animated emoji
 *
 * Stats (XP/rank/streak/resistCount) are NEVER editable here —
 * useAuthStore.updateUserProfile filters those out defensively.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, Save, Smile, X } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRewardStore } from '@/stores/useRewardStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { VIBE_LABELS, type VibeMode } from '@/lib/ageGroup';
import IOSDateField from './IOSDateField';
import IOSTimeField from './IOSTimeField';
import {
  AVATAR_EMOJIS,
  buildEmojiAvatar,
  getEmojiFromAvatar,
  isEmojiAvatar,
} from '@/data/avatarIcons';
import {
  compressImageToDataURL,
  estimateDataURLSize,
} from '@/lib/imageCompression';
import './ProfileEditModal.css';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR_OF_BIRTH = 1900;
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const MIN_DATE_ISO = `${MIN_YEAR_OF_BIRTH}-01-01`;

export default function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const user = useAuthStore((s) => s.user);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const unlockMenhChu = useRewardStore((s) => s.unlockMenhChu);
  const appVibe = useSettingsStore((s) => s.appVibe);
  const setAppVibe = useSettingsStore((s) => s.setAppVibe);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');  // YYYY-MM-DD
  const [birthTime, setBirthTime] = useState('');  // HH:mm
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoSizeKB, setPhotoSizeKB] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track last "open" transition để hydrate chỉ 1 lần per session
  const lastHydratedKeyRef = useRef<string>('');

  // Hydrate from store ONLY khi modal transitions false → true.
  // KHÔNG depend vào `user` — nếu user đổi giữa lúc modal mở (vd awardXP từ
  // quest, updateStreak…), không được reset state đang nhập của user.
  useEffect(() => {
    if (!isOpen) {
      lastHydratedKeyRef.current = '';
      return;
    }
    // Snapshot user 1 lần khi modal vừa mở
    const snapshot = useAuthStore.getState().user;
    const key = `${snapshot?.uid ?? 'anon'}:${isOpen ? '1' : '0'}`;
    if (lastHydratedKeyRef.current === key) return;
    lastHydratedKeyRef.current = key;

    setDisplayName(snapshot?.displayName ?? '');
    setEmail(snapshot?.email ?? '');
    // Ưu tiên birthDate có sẵn; fallback từ yearOfBirth → "YYYY-01-01"
    const initBirthDate = snapshot?.birthDate
      || (snapshot?.yearOfBirth ? `${snapshot.yearOfBirth}-01-01` : '');
    setBirthDate(initBirthDate);
    setBirthTime(snapshot?.birthTime ?? '');
    setPhotoURL(snapshot?.photoURL ?? null);
    setEmojiPickerOpen(false);
    setUploadError(null);
    setPhotoSizeKB(null);
  }, [isOpen]);

  const handlePickFile = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const compressed = await compressImageToDataURL(file, {
        maxSize: 256,
        quality: 0.85,
        mimeType: 'image/jpeg',
      });
      setPhotoURL(compressed);
      setPhotoSizeKB(estimateDataURLSize(compressed));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Không tải được ảnh');
    } finally {
      setUploading(false);
      // Reset so the same file can be re-picked
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePickEmoji = (emoji: string) => {
    setPhotoURL(buildEmojiAvatar(emoji));
    setEmojiPickerOpen(false);
    setPhotoSizeKB(null);
  };

  const handleClearAvatar = () => {
    setPhotoURL(null);
    setPhotoSizeKB(null);
  };

  const birthDateValid = (() => {
    const trimmed = birthDate.trim();
    if (trimmed === '') return true; // optional
    // Phải đúng format YYYY-MM-DD và parse được
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    return y >= MIN_YEAR_OF_BIRTH && y <= CURRENT_YEAR;
  })();

  const birthTimeValid = (() => {
    const trimmed = birthTime.trim();
    if (trimmed === '') return true; // optional
    return /^\d{2}:\d{2}$/.test(trimmed);
  })();

  const nameValid = displayName.trim().length > 0;
  // Trim trước khi validate — mobile keyboard hay thêm trailing space vào email
  const emailValid = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Diagnostic: liệt kê lý do disable nếu có
  const blockers: string[] = [];
  if (!user) blockers.push('user-null');
  if (!nameValid) blockers.push('name-empty');
  if (!emailValid) blockers.push('email-invalid');
  if (!birthDateValid) blockers.push('birthdate-invalid');
  if (!birthTimeValid) blockers.push('birthtime-invalid');
  if (uploading) blockers.push('uploading');
  if (saving) blockers.push('saving');

  // Block CHỈ khi đang upload/save, hoặc field bắt buộc rỗng/sai.
  // Không block vì user null (vì luôn có user trong demo) hoặc field optional.
  const isBlocking =
    !nameValid || !emailValid || !birthDateValid || !birthTimeValid || uploading || saving;
  const canSave = !isBlocking;

  const handleSave = () => {
    // Bỏ guard `!user` — updateUserProfile có guard riêng bên trong store.
    // Bỏ guard `!canSave` — đã reflect qua disabled, nhưng để defensive
    // nếu user click bằng cách nào đó (kbd), validate lại.
    if (!nameValid || !emailValid || !birthDateValid || !birthTimeValid) {
      // Log để debug nếu user thấy disabled không hợp lý
      console.warn('[ProfileEditModal] Save blocked:', { blockers });
      return;
    }
    if (uploading || saving) return;

    setSaving(true);
    try {
      const bd = birthDate.trim();
      const bt = birthTime.trim();
      // Derive yearOfBirth từ birthDate cho backward compat (bản mệnh, vibe)
      const yob = bd ? parseInt(bd.slice(0, 4), 10) : undefined;
      updateUserProfile({
        displayName: displayName.trim(),
        email: email.trim(),
        photoURL,
        birthDate: bd || undefined,
        birthTime: bt || undefined,
        yearOfBirth: yob,
      });
      // Auto-unlock con giáp theo bản mệnh khi user nhập năm sinh
      if (yob) {
        // Trì hoãn 1 tick để authStore update xong rồi mới đọc yearOfBirth
        setTimeout(() => unlockMenhChu(), 0);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const currentEmoji = getEmojiFromAvatar(photoURL);
  const isPhoto = !!photoURL && !isEmojiAvatar(photoURL);
  const initials = (displayName || user?.displayName || 'NH').substring(0, 2).toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="pem-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="pem-modal"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pem-header">
              <h2>Sửa hồ sơ</h2>
              <button
                type="button"
                onClick={onClose}
                className="pem-close"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </header>

            <div className="pem-body">
              {/* ═══ Avatar section ═══ */}
              <section className="pem-section pem-section--avatar">
                <label className="pem-label">Ảnh đại diện</label>
                <div className="pem-avatar-row">
                  <div className="pem-avatar-preview">
                    {isPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoURL!} alt="Avatar" />
                    ) : currentEmoji ? (
                      <span className="pem-avatar-emoji">{currentEmoji}</span>
                    ) : (
                      <span className="pem-avatar-fallback">{initials}</span>
                    )}
                  </div>
                  <div className="pem-avatar-actions">
                    <button
                      type="button"
                      className="pem-btn pem-btn--ghost"
                      onClick={handlePickFile}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 size={14} className="pem-spin" /> : <Camera size={14} />}
                      <span>Tải ảnh lên</span>
                    </button>
                    <button
                      type="button"
                      className="pem-btn pem-btn--ghost"
                      onClick={() => setEmojiPickerOpen((v) => !v)}
                    >
                      <Smile size={14} />
                      <span>Chọn icon</span>
                    </button>
                    {photoURL && (
                      <button
                        type="button"
                        className="pem-btn pem-btn--text"
                        onClick={handleClearAvatar}
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {photoSizeKB !== null && (
                  <p className="pem-hint">
                    Ảnh đã nén còn ~{photoSizeKB}KB (giữ nét, không phình bộ nhớ).
                  </p>
                )}
                {uploadError && <p className="pem-error">{uploadError}</p>}

                {emojiPickerOpen && (
                  <div className="pem-emoji-grid">
                    {AVATAR_EMOJIS.map((opt) => (
                      <button
                        key={opt.emoji}
                        type="button"
                        className={`pem-emoji-cell pem-emoji-cell--${opt.motion} ${currentEmoji === opt.emoji ? 'is-active' : ''}`}
                        onClick={() => handlePickEmoji(opt.emoji)}
                        aria-label={opt.label}
                        title={opt.label}
                      >
                        {opt.emoji}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* ═══ Display name ═══ */}
              <section className="pem-section">
                <label className="pem-label" htmlFor="pem-name">Tên hiển thị</label>
                <input
                  id="pem-name"
                  type="text"
                  className="pem-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tên của bạn"
                  maxLength={60}
                />
                {!nameValid && (
                  <p className="pem-error">Tên không được để trống.</p>
                )}
              </section>

              {/* ═══ Email ═══ */}
              <section className="pem-section">
                <label className="pem-label" htmlFor="pem-email">Email</label>
                <input
                  id="pem-email"
                  type="email"
                  className="pem-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  maxLength={120}
                />
                {!emailValid && (
                  <p className="pem-error">Email không đúng định dạng.</p>
                )}
              </section>

              {/* ═══ Ngày sinh (field gọn + sheet picker) ═══ */}
              <section className="pem-section">
                <label className="pem-label">Ngày sinh</label>
                <IOSDateField
                  value={birthDate}
                  onChange={setBirthDate}
                  minDate={MIN_DATE_ISO}
                  maxDate={TODAY_ISO}
                  placeholder="Chọn ngày sinh"
                  label="Ngày sinh"
                />
                {!birthDateValid && (
                  <p className="pem-error">
                    Ngày sinh phải từ {MIN_YEAR_OF_BIRTH} đến hôm nay.
                  </p>
                )}
              </section>

              {/* ═══ Giờ sinh (field gọn + sheet picker) — TÙY CHỌN ═══ */}
              <section className="pem-section">
                <label className="pem-label">
                  Giờ sinh <span className="pem-optional">(tùy chọn — phục vụ Bát Tự)</span>
                </label>
                <IOSTimeField
                  value={birthTime}
                  onChange={setBirthTime}
                  placeholder="Chưa khai báo giờ sinh"
                  label="Giờ sinh"
                />
                {!birthTimeValid && (
                  <p className="pem-error">Giờ sinh sai định dạng.</p>
                )}
                <p className="pem-hint">
                  Nếu nhớ chính xác giờ sinh, app sẽ tính được lá số Bát Tự đầy
                  đủ trong các tính năng phong thủy sau này.
                </p>
              </section>

              {/* ═══ App Vibe — phong cách text/giọng app ═══ */}
              <section className="pem-section">
                <label className="pem-label">Phong cách app</label>
                <div className="pem-vibe-grid">
                  {(['auto', 'young', 'pro', 'classic'] as VibeMode[]).map((v) => {
                    const meta = v === 'auto'
                      ? { label: 'Tự động', subtitle: 'Theo năm sinh', emoji: '✨' }
                      : VIBE_LABELS[v];
                    const isActive = appVibe === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        className={`pem-vibe-card ${isActive ? 'pem-vibe-card--active' : ''}`}
                        onClick={() => setAppVibe(v)}
                      >
                        <span className="pem-vibe-emoji">{meta.emoji}</span>
                        <span className="pem-vibe-label">{meta.label}</span>
                        <span className="pem-vibe-sub">{meta.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <footer className="pem-footer">
              {!canSave && blockers.length > 0 && (
                <p className="pem-block-reason">
                  ⚠️ {blockers.map((b) => {
                    switch (b) {
                      case 'name-empty': return 'tên chưa nhập';
                      case 'email-invalid': return 'email sai định dạng';
                      case 'birthdate-invalid': return 'ngày sinh sai';
                      case 'birthtime-invalid': return 'giờ sinh sai';
                      case 'uploading': return 'đang tải ảnh';
                      case 'saving': return 'đang lưu';
                      case 'user-null': return 'chưa đăng nhập';
                      default: return b;
                    }
                  }).join(' · ')}
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="pem-btn pem-btn--ghost"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="pem-btn pem-btn--primary"
                title={!canSave ? `Chưa thể lưu: ${blockers.join(', ')}` : 'Lưu thay đổi'}
              >
                {saving ? <Loader2 size={14} className="pem-spin" /> : <Save size={14} />}
                <span>Lưu thay đổi</span>
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
