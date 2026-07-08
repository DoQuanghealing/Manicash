/* ═══ Profile — Thẻ quản gia: tên + cấp độ + đổi cấp độ ═══
 * "Thông thái" = hỗ trợ sâu + cá nhân hoá (đã bật analyticsConsent). Nút mở lại
 * bước chọn cấp độ trong màn làm quen (useButlerWizardStore mode 'tier').
 */
'use client';

import { Sparkles } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useButlerWizardStore } from '@/stores/useButlerWizardStore';
import './butler-card.css';

export default function ButlerSettingsCard() {
  const butlerName = useSettingsStore((s) => s.butlerName);
  const honorific = useSettingsStore((s) => s.honorific);
  const tier = useSettingsStore((s) => s.butlerTier);
  const openWizard = useButlerWizardStore((s) => s.open);

  const isWise = tier === 'wise';

  return (
    <section className="butler-card">
      <h2 className="profile-section-title">Quản gia</h2>
      <div className="butler-card-head">
        <div className="butler-card-avatar">◈</div>
        <div className="butler-card-info">
          <div className="butler-card-name">{butlerName}</div>
          <div className="butler-card-meta">
            {honorific ? `Gọi bạn là "${honorific}"` : 'Chưa đặt danh xưng'} ·{' '}
            <span className={isWise ? 'butler-tier-wise' : 'butler-tier-basic'}>
              {isWise ? '👑 Thông thái' : '🪶 Bình dân'}
            </span>
          </div>
        </div>
      </div>

      {isWise ? (
        <button className="butler-card-btn butler-card-btn-ghost" onClick={() => openWizard('tier')}>
          Đổi cấp độ quản gia
        </button>
      ) : (
        <button className="butler-card-btn butler-card-btn-gold" onClick={() => openWizard('tier')}>
          <Sparkles size={16} /> Tôi nghĩ rồi — quản gia cần thông thái hơn
        </button>
      )}
    </section>
  );
}
