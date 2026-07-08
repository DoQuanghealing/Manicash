/* ═══ Profile — Thẻ quản gia: tên + cấp độ + đổi cấp độ ═══
 * 'wise' = hỗ trợ sâu (analyticsConsent). 'sovereign' = Phú Vương (đồng hành sâu + chủ động).
 * Nút nâng Phú Vương mở luồng mời riêng (useSovereignInviteStore). Hạ cấp = rút sovereignConsent.
 */
'use client';

import { Sparkles, Crown } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useButlerWizardStore } from '@/stores/useButlerWizardStore';
import { useSovereignInviteStore } from '@/stores/useSovereignInviteStore';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';
import './butler-card.css';

/** Rút consent tầng Phú Vương khi hạ cấp (server-authoritative, không chặn UI nếu lỗi). */
async function revokeSovereignConsent() {
  try {
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    await fetch(apiUrl('/api/telemetry/consent'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ granted: false, scope: 'sovereign' }),
    });
  } catch {
    /* im lặng */
  }
}

export default function ButlerSettingsCard() {
  const butlerName = useSettingsStore((s) => s.butlerName);
  const honorific = useSettingsStore((s) => s.honorific);
  const tier = useSettingsStore((s) => s.butlerTier);
  const setButlerTier = useSettingsStore((s) => s.setButlerTier);
  const openWizard = useButlerWizardStore((s) => s.open);
  const openInvite = useSovereignInviteStore((s) => s.open);

  const isSovereign = tier === 'sovereign';
  const isWise = tier === 'wise';

  const tierLabel = isSovereign ? '🐉 Phú Vương' : isWise ? '👑 Thông thái' : '🪶 Bình dân';
  const tierClass = isSovereign ? 'butler-tier-sovereign' : isWise ? 'butler-tier-wise' : 'butler-tier-basic';

  function downgradeFromSovereign() {
    setButlerTier('wise');
    void revokeSovereignConsent();
  }

  return (
    <section className="butler-card">
      <h2 className="profile-section-title">Quản gia</h2>
      <div className="butler-card-head">
        <div className="butler-card-avatar">{isSovereign ? '🐉' : '◈'}</div>
        <div className="butler-card-info">
          <div className="butler-card-name">{butlerName}</div>
          <div className="butler-card-meta">
            {honorific ? `Gọi bạn là "${honorific}"` : 'Chưa đặt danh xưng'} ·{' '}
            <span className={tierClass}>{tierLabel}</span>
          </div>
        </div>
      </div>

      {isSovereign ? (
        <button className="butler-card-btn butler-card-btn-ghost" onClick={downgradeFromSovereign}>
          Hạ về Thông thái
        </button>
      ) : isWise ? (
        <button className="butler-card-btn butler-card-btn-gold" onClick={openInvite}>
          <Crown size={16} /> Nâng lên Phú Vương
        </button>
      ) : (
        <button className="butler-card-btn butler-card-btn-gold" onClick={() => openWizard('tier')}>
          <Sparkles size={16} /> Tôi nghĩ rồi — quản gia cần thông thái hơn
        </button>
      )}
    </section>
  );
}
