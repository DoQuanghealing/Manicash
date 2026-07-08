/* ═══ Mời nâng cấp Phú Vương 🐉 — luồng "bước dẫn" (foot-in-the-door) ═══
 * Bước 0 khen + tò mò → Bước 1 La bàn năng lực (khảo sát) → Bước 2 nhóm nghề (KHÔNG số thu nhập)
 * → Bước 3 lời mời + 6 ý → done. Câu chữ KHOÁ theo docs/BUTLER_PHU_VUONG_SCRIPT.md — không tự chế lời.
 *
 * "Đồng ý" = setButlerTier('sovereign') + consent scope 'sovereign' (server).
 * Từ chối = cooldown 14 ngày, không nài lại sớm. Tự mở khi: tier=wise & streak≥14 & chưa sovereign.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSovereignInviteStore } from '@/stores/useSovereignInviteStore';
import { useButlerWizardStore } from '@/stores/useButlerWizardStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCapacitySurveyStore } from '@/stores/useCapacitySurveyStore';
import { archetypeFromSkills, type SovereignArchetype } from '@/lib/butler/sovereignArchetype';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';
import CapacitySurveyCard from '@/app/(app)/chat/_components/CapacitySurveyCard';
import '@/components/butler/butler-onboarding.css';
import './sovereign-invite.css';

type Step = 'intro' | 'survey' | 'result' | 'invite';

const COOLDOWN_KEY = 'manicash-sovereign-invite-cooldown';
const STREAK_GATE = 14;
const COOLDOWN_DAYS = 14;

/** Ghi consent tầng Phú Vương (server-authoritative). Không chặn luồng nếu lỗi mạng. */
async function setSovereignConsent(granted: boolean) {
  try {
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    await fetch(apiUrl('/api/telemetry/consent'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ granted, scope: 'sovereign' }),
    });
  } catch {
    /* im lặng */
  }
}

function readCooldown(): number {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
function writeCooldown(untilMs: number) {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(untilMs));
  } catch {
    /* ignore */
  }
}

export default function SovereignInvite() {
  const mode = useSovereignInviteStore((s) => s.mode);
  const openInvite = useSovereignInviteStore((s) => s.open);
  const closeInvite = useSovereignInviteStore((s) => s.close);

  const honorific = useSettingsStore((s) => s.honorific);
  const butlerName = useSettingsStore((s) => s.butlerName);
  const tier = useSettingsStore((s) => s.butlerTier);
  const butlerOnboarded = useSettingsStore((s) => s.butlerOnboarded);
  const setButlerTier = useSettingsStore((s) => s.setButlerTier);

  const wizardMode = useButlerWizardStore((s) => s.mode);
  const user = useAuthStore((s) => s.user);
  const surveyAnswers = useCapacitySurveyStore((s) => s.answers);
  const saveSurvey = useCapacitySurveyStore((s) => s.save);

  const [step, setStep] = useState<Step>('intro');
  const [showMore, setShowMore] = useState(false);
  const [archetype, setArchetype] = useState<SovereignArchetype | null>(null);

  const addr = useMemo(() => honorific || 'chủ nhân', [honorific]);
  const streak = user?.streak ?? 0;

  // Tự kích hoạt: chỉ mời từ tier Thông thái, đã onboard, streak đủ, chưa Phú Vương,
  // không đè lên màn làm quen, và qua cooldown.
  useEffect(() => {
    if (mode !== 'closed') return;
    if (wizardMode !== 'closed') return;
    if (!user || !butlerOnboarded) return;
    if (tier !== 'wise') return;
    if (streak < STREAK_GATE) return;
    if (Date.now() < readCooldown()) return;
    openInvite();
  }, [mode, wizardMode, user, butlerOnboarded, tier, streak, openInvite]);

  // Đồng bộ bước khởi đầu mỗi lần mở.
  useEffect(() => {
    if (mode === 'open') {
      setStep('intro');
      setShowMore(false);
    }
  }, [mode]);

  if (mode === 'closed') return null;

  function snooze() {
    writeCooldown(Date.now() + COOLDOWN_DAYS * 86_400_000);
    closeInvite();
  }

  function handleSurveySaved(input: { skills: string[]; freeTimeHoursPerWeek: number }) {
    saveSurvey(input);
    setArchetype(archetypeFromSkills(input.skills));
    setStep('result');
  }

  function accept() {
    setButlerTier('sovereign');
    void setSovereignConsent(true);
    closeInvite();
  }

  return (
    <div className="bo-overlay" role="dialog" aria-modal="true" aria-label="Nâng cấp quản gia Phú Vương">
      <div className="bo-card sv-card">
        {/* ── Bước 0: khen + gợi tò mò ── */}
        {step === 'intro' && (
          <div className="bo-step">
            <div className="bo-emblem sv-emblem">🐉</div>
            <h2 className="bo-title">Thưa {addr}…</h2>
            <p className="bo-lead">
              {butlerName} để ý ngài giữ <strong>streak {streak} ngày</strong>, thuộc nhóm top. Ngài có
              <strong> 60 giây</strong> cho tôi thử một thứ vui không?
            </p>
            <button className="bo-btn bo-btn-primary" onClick={() => setStep('survey')}>
              Có, thử xem →
            </button>
            <button className="bo-btn bo-btn-ghost" onClick={snooze}>
              Để sau
            </button>
          </div>
        )}

        {/* ── Bước 1: La bàn năng lực (tái dùng khảo sát) ── */}
        {step === 'survey' && (
          <div className="bo-step">
            <div className="bo-emblem sv-emblem">🧭</div>
            <h2 className="bo-title">La bàn năng lực</h2>
            <p className="bo-sub">Chọn nhanh vài điều để tôi đọc được thế mạnh của {addr}.</p>
            <CapacitySurveyCard initial={surveyAnswers} onSave={handleSurveySaved} />
          </div>
        )}

        {/* ── Bước 2: kết quả nhóm nghề (KHÔNG số thu nhập) ── */}
        {step === 'result' && archetype && (
          <div className="bo-step bo-center">
            <div className="bo-burst">✨</div>
            <h2 className="bo-title">
              Ngài nghiêng về nhóm <span className="sv-group">{archetype.label}</span>
            </h2>
            <p className="bo-lead">Điểm mạnh nhất của ngài: {archetype.strength}.</p>
            <p className="bo-sub">Tôi thấy vài điều ngài đang bỏ lỡ… nhưng để chỉ đúng, tôi cần đi cùng ngài kỹ hơn.</p>
            <button className="bo-btn bo-btn-primary" onClick={() => setStep('invite')}>
              Xem tôi bỏ lỡ gì →
            </button>
          </div>
        )}

        {/* ── Bước 3: lời mời Phú Vương (copy đã khoá) ── */}
        {step === 'invite' && (
          <div className="bo-step">
            <div className="bo-emblem sv-emblem">🐉</div>
            <h2 className="bo-title">Xin nâng tôi lên Phú Vương</h2>
            <p className="bo-lead">
              Tiềm năng của {addr} là <strong>vô hạn</strong>. Tôi sẽ cùng ngài biến những tài sản nhỏ
              thành những tài sản lớn. Tôi tin vào <strong>năng lực chạm tay hoá vàng</strong> của ngài.
            </p>
            <p className="bo-sub">
              Nhưng tôi — ở cấp độ hiện tại — <strong>không theo kịp</strong> ngài nữa. Xin ngài hãy nâng
              tôi lên cấp quản gia <strong>Phú Vương</strong>.
            </p>

            <button className="sv-more" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
              {showMore ? '▾ Thu gọn' : '▸ Tìm hiểu thêm trước khi nâng cấp'}
            </button>
            {showMore && (
              <ol className="sv-points">
                <li><strong>Đồng bộ dữ liệu</strong> để tôi theo ngài khi ngài đăng nhập thiết bị khác — vẫn đầy đủ dữ liệu để tiếp tục phò tá.</li>
                <li>Có những <strong>đề xuất thông minh</strong> phù hợp với năng lực, tầm nhìn của ngài.</li>
                <li>Nếu cần, tôi cũng <strong>đề xuất các công việc</strong> giúp ngài gia tăng thu nhập.</li>
                <li>Tôi cần <strong>dữ liệu trong app được đồng bộ</strong>.</li>
                <li>Ngài có thể <strong>xoá toàn bộ bất cứ lúc nào</strong> nếu không muốn tiếp tục.</li>
                <li><strong>Không đụng chạm đời tư</strong> — mọi việc tôi muốn làm đều phải <strong>xin phép</strong> {addr}.</li>
              </ol>
            )}

            <button className="bo-btn bo-btn-primary sv-btn-gold" onClick={accept}>
              Đồng ý — nâng Phú Vương
            </button>
            <button className="bo-btn bo-btn-ghost" onClick={snooze}>
              Giữ Thông thái
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
