/* ═══ ButlerSettings — Rename Butler + Theme Toggle ═══ */
'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import './ButlerSettings.css';

interface ButlerSettingsProps {
  onBack: () => void;
}

export default function ButlerSettings({ onBack }: ButlerSettingsProps) {
  const { butlerName, setButlerName, theme, toggleTheme } = useSettingsStore();
  const [nameInput, setNameInput] = useState(butlerName);
  const [saved, setSaved] = useState(false);

  const isDirty = nameInput.trim() !== butlerName;

  const handleSave = () => {
    if (!isDirty) return;
    setButlerName(nameInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
  };

  return (
    <div className="bs-container">
      {/* Back Button */}
      <button className="bs-back-btn" onClick={onBack}>
        ← Quay lại
      </button>

      <h2 className="bs-title">⚙️ Cài đặt</h2>

      {/* ═══ Section 1: Rename Butler ═══ */}
      <div className="bs-section">
        <div className="bs-section-label">🎩 Tên quản gia</div>
        <div className="bs-name-row">
          <input
            className="bs-name-input"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tên mới cho quản gia..."
            maxLength={24}
          />
          <button
            className="bs-name-save"
            onClick={handleSave}
            disabled={!isDirty}
          >
            {saved ? '✓ Đã lưu' : 'Lưu'}
          </button>
        </div>
        <p className="bs-name-hint">
          Tên sẽ được hiển thị khắp nơi trong app.
        </p>
      </div>

      {/* ═══ Section 2: Theme Toggle ═══ */}
      <div className="bs-section">
        <div className="bs-section-label">🎨 Giao diện</div>
        <div className="bs-theme-row">
          <div className="bs-theme-info">
            <span className="bs-theme-icon">
              {theme === 'dark' ? '🌙' : '☀️'}
            </span>
            <div className="bs-theme-text">
              <span className="bs-theme-label">
                {theme === 'dark' ? 'Chế độ tối' : 'Chế độ sáng'}
              </span>
              <span className="bs-theme-desc">
                {theme === 'dark'
                  ? 'Dễ nhìn trong đêm, tiết kiệm pin'
                  : 'Sáng sủa, dễ đọc ban ngày'}
              </span>
            </div>
          </div>
          <button
            className={`bs-toggle ${theme === 'light' ? 'active' : ''}`}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span className="bs-toggle-thumb">
              {theme === 'dark' ? '🌙' : '☀️'}
            </span>
          </button>
        </div>
      </div>

      {/* ═══ Footer ═══ */}
      <div className="bs-footer">
        ManiCash v0.1.0 — Quản gia tài chính AI
      </div>
    </div>
  );
}
