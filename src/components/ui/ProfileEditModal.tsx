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

export default function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const user = useAuthStore((s) => s.user);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoSizeKB, setPhotoSizeKB] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate from store when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(user?.displayName ?? '');
    setEmail(user?.email ?? '');
    setYearOfBirth(user?.yearOfBirth ? String(user.yearOfBirth) : '');
    setPhotoURL(user?.photoURL ?? null);
    setEmojiPickerOpen(false);
    setUploadError(null);
    setPhotoSizeKB(null);
  }, [isOpen, user]);

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

  const yearValid = (() => {
    if (yearOfBirth === '') return true; // optional
    const n = Number(yearOfBirth);
    return Number.isInteger(n) && n >= MIN_YEAR_OF_BIRTH && n <= CURRENT_YEAR;
  })();

  const nameValid = displayName.trim().length > 0;
  const emailValid = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSave = !!user && nameValid && emailValid && yearValid && !uploading && !saving;

  const handleSave = () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      updateUserProfile({
        displayName: displayName.trim(),
        email: email.trim(),
        photoURL,
        yearOfBirth: yearOfBirth === '' ? undefined : Number(yearOfBirth),
      });
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

              {/* ═══ Year of birth ═══ */}
              <section className="pem-section">
                <label className="pem-label" htmlFor="pem-yob">Năm sinh</label>
                <input
                  id="pem-yob"
                  type="number"
                  inputMode="numeric"
                  className="pem-input"
                  value={yearOfBirth}
                  onChange={(e) => setYearOfBirth(e.target.value)}
                  placeholder="vd 1995"
                  min={MIN_YEAR_OF_BIRTH}
                  max={CURRENT_YEAR}
                />
                {!yearValid && (
                  <p className="pem-error">
                    Năm phải trong {MIN_YEAR_OF_BIRTH}–{CURRENT_YEAR}.
                  </p>
                )}
              </section>
            </div>

            <footer className="pem-footer">
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
