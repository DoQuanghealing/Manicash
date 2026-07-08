/* ═══ Làm quen quản gia — onboarding nhập vai ═══
 * Bước: intro (đọc thử chat) → hello (xuyên không) → danh xưng → đặt tên →
 * cấp độ (bình dân | thông thái+xác nhận) → hướng dẫn. Chế độ 'tier' chỉ mở lại
 * bước cấp độ (nút "quản gia cần thông thái hơn" ở Hồ sơ).
 *
 * "Thông thái" = bật hỗ trợ sâu + cá nhân hoá → set analyticsConsent=true (server).
 * KHÔNG dùng ngôn ngữ "theo dõi/gửi dữ liệu" — chỉ nói giúp quản gia hiểu chủ nhân.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useButlerWizardStore } from '@/stores/useButlerWizardStore';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';
import './butler-onboarding.css';

type Step = 'intro' | 'hello' | 'honorific' | 'name' | 'tier' | 'guide';

const HONORIFICS = ['cô', 'cậu', 'tổng tài'];
const NAME_SUGGESTIONS = ['Vượng Tài', 'Thần Tài', 'Pic Cà Pu', 'Lord Diamond'];

/** Ghi consent R&D (server-authoritative). Không chặn luồng nếu lỗi mạng. */
async function setConsent(granted: boolean) {
  try {
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    await fetch(apiUrl('/api/telemetry/consent'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ granted }),
    });
  } catch {
    /* im lặng */
  }
}

export default function ButlerOnboarding() {
  const mode = useButlerWizardStore((s) => s.mode);
  const openWizard = useButlerWizardStore((s) => s.open);
  const closeWizard = useButlerWizardStore((s) => s.close);

  const butlerOnboarded = useSettingsStore((s) => s.butlerOnboarded);
  const butlerName = useSettingsStore((s) => s.butlerName);
  const honorific = useSettingsStore((s) => s.honorific);
  const setButlerName = useSettingsStore((s) => s.setButlerName);
  const setHonorific = useSettingsStore((s) => s.setHonorific);
  const setButlerTier = useSettingsStore((s) => s.setButlerTier);
  const setButlerOnboarded = useSettingsStore((s) => s.setButlerOnboarded);

  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [confirmWise, setConfirmWise] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [honorInput, setHonorInput] = useState('');

  // Tự mở onboarding lần đầu khi vào app.
  useEffect(() => {
    if (!butlerOnboarded && mode === 'closed') openWizard('full');
  }, [butlerOnboarded, mode, openWizard]);

  // Đồng bộ bước khởi đầu theo chế độ mở.
  useEffect(() => {
    if (mode === 'tier') setStep('tier');
    if (mode === 'full') setStep('intro');
  }, [mode]);

  const addr = useMemo(() => honorific || 'chủ nhân', [honorific]);

  if (mode === 'closed') return null;

  function finish() {
    setButlerOnboarded(true);
    closeWizard();
    setStep('intro');
    setConfirmWise(false);
  }

  function pickBasic() {
    setButlerTier('basic');
    void setConsent(false);
    if (mode === 'tier') finish();
    else setStep('guide');
  }
  function pickWiseConfirmed() {
    setButlerTier('wise');
    void setConsent(true);
    setConfirmWise(false);
    if (mode === 'tier') finish();
    else setStep('guide');
  }

  return (
    <div className="bo-overlay" role="dialog" aria-modal="true" aria-label="Làm quen quản gia">
      <div className="bo-card">
        {/* ── Bước 1: đọc thử đoạn chat ── */}
        {step === 'intro' && (
          <div className="bo-step">
            <div className="bo-emblem">◈</div>
            <h2 className="bo-title">Quản gia tài chính của bạn</h2>
            <div className="bo-chat-preview">
              <div className="bo-bubble bo-bubble-in">Chào chủ nhân 👋 Hôm nay tiêu gì để tôi ghi sổ giúp?</div>
              <div className="bo-bubble bo-bubble-out">50k cà phê</div>
              <div className="bo-bubble bo-bubble-in">Đã ghi ✍️ Cà phê 50.000₫. Tháng này chủ nhân dùng 320k cho khoản này rồi nhé.</div>
            </div>
            <button className="bo-btn bo-btn-primary" onClick={() => setStep('hello')}>
              Nhận quản gia →
            </button>
          </div>
        )}

        {/* ── Bước 2: xuyên không ── */}
        {step === 'hello' && (
          <div className="bo-step bo-center">
            <div className="bo-burst">✨</div>
            <h2 className="bo-title">Chúc mừng ký chủ!</h2>
            <p className="bo-lead">
              Ngài vừa sở hữu <strong>Hệ Thống Quản Gia Tài Chính Siêu Cấp Vô Địch</strong> 🏆
            </p>
            <p className="bo-sub">Trước khi khởi động, cho tôi hỏi ký chủ vài điều nhé.</p>
            <button className="bo-btn bo-btn-primary" onClick={() => setStep('honorific')}>Bắt đầu</button>
          </div>
        )}

        {/* ── Bước 3: danh xưng ── */}
        {step === 'honorific' && (
          <div className="bo-step">
            <h2 className="bo-title">Ký chủ muốn tôi gọi ngài bằng gì?</h2>
            <div className="bo-options">
              {HONORIFICS.map((h) => (
                <button
                  key={h}
                  className={`bo-chip ${honorific === h ? 'is-on' : ''}`}
                  onClick={() => { setHonorific(h); setHonorInput(''); }}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="bo-custom">
              <input
                className="bo-input"
                placeholder="Tự đặt danh xưng…"
                value={honorInput}
                maxLength={20}
                onChange={(e) => setHonorInput(e.target.value)}
                onBlur={() => honorInput.trim() && setHonorific(honorInput.trim())}
              />
            </div>
            <button
              className="bo-btn bo-btn-primary"
              disabled={!honorific}
              onClick={() => setStep('name')}
            >
              Tiếp →
            </button>
          </div>
        )}

        {/* ── Bước 4: đặt tên quản gia ── */}
        {step === 'name' && (
          <div className="bo-step">
            <h2 className="bo-title">Hãy đặt tên cho tôi</h2>
            <p className="bo-sub">Tôi cũng muốn có một cái tên để {addr} gọi 😌</p>
            <div className="bo-options">
              {NAME_SUGGESTIONS.map((n) => (
                <button
                  key={n}
                  className={`bo-chip ${butlerName === n ? 'is-on' : ''}`}
                  onClick={() => { setButlerName(n); setNameInput(''); }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="bo-custom">
              <input
                className="bo-input"
                placeholder="Tự đặt tên quản gia…"
                value={nameInput}
                maxLength={24}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => nameInput.trim() && setButlerName(nameInput.trim())}
              />
            </div>
            <button className="bo-btn bo-btn-primary" onClick={() => setStep('tier')}>
              Tiếp →
            </button>
          </div>
        )}

        {/* ── Bước 5: cấp độ quản gia ── */}
        {step === 'tier' && !confirmWise && (
          <div className="bo-step">
            <h2 className="bo-title">Chọn cấp độ quản gia</h2>
            <p className="bo-sub">Tôi thông minh tới đâu là do {addr} chọn.</p>

            <button className="bo-tier bo-tier-basic" onClick={pickBasic}>
              <div className="bo-tier-name">🪶 Bình dân</div>
              <div className="bo-tier-desc">Trò chuyện cho vui, ghi sổ cơ bản. Thành thật là tôi chưa giúp {addr} bứt phá được nhiều.</div>
            </button>

            <button className="bo-tier bo-tier-wise" onClick={() => setConfirmWise(true)}>
              <div className="bo-tier-badge">Khuyên dùng</div>
              <div className="bo-tier-name">👑 Thông thái</div>
              <div className="bo-tier-desc">Giúp {addr} phá điểm mù tài chính, đưa gợi ý riêng để đột phá <strong>cấp Đại Phú Hào</strong>.</div>
            </button>
          </div>
        )}

        {/* ── Bước 5b: xác nhận cấp Thông thái (= consent) ── */}
        {step === 'tier' && confirmWise && (
          <div className="bo-step">
            <div className="bo-emblem">👑</div>
            <h2 className="bo-title">Để tôi phục vụ {addr} sâu hơn</h2>
            <p className="bo-lead">
              Tôi cần {addr} cho phép tôi <strong>hiểu thói quen tài chính trong app</strong> — thu, chi, ngân sách,
              mục tiêu — để đưa gợi ý riêng cho {addr}.
            </p>
            <ul className="bo-assure">
              <li>✅ Chỉ dùng số liệu {addr} ghi trong app</li>
              <li>✅ Không vị trí, không dữ liệu riêng tư, không đụng gì sâu trong máy</li>
              <li>✅ Tắt lại bất cứ lúc nào trong Hồ sơ</li>
            </ul>
            <button className="bo-btn bo-btn-primary" onClick={pickWiseConfirmed}>
              Đồng ý — nâng quản gia lên Thông thái
            </button>
            <button className="bo-btn bo-btn-ghost" onClick={() => setConfirmWise(false)}>
              Để tôi chọn lại
            </button>
          </div>
        )}

        {/* ── Bước 6: hướng dẫn sử dụng ── */}
        {step === 'guide' && (
          <div className="bo-step">
            <div className="bo-emblem">📖</div>
            <h2 className="bo-title">Xong rồi, thưa {addr}!</h2>
            <p className="bo-sub">Vài cách dùng nhanh với {butlerName}:</p>
            <ul className="bo-guide">
              <li><strong>Ghi thu / chi:</strong> gõ tự nhiên như <em>“50k cà phê”</em>, <em>“nhận lương 15tr”</em> — hoặc bấm nút <strong>+</strong>.</li>
              <li><strong>Hỏi gì cũng được:</strong> <em>“tháng này tôi tiêu nhiều không?”</em>, <em>“còn bao nhiêu để xài?”</em></li>
              <li><strong>Lệnh nhanh (gõ “/”):</strong> <code>/sodu</code> số dư · <code>/antoan</code> an toàn chi tiêu · <code>/suckhoe</code> điểm sức khỏe · <code>/baocao</code> báo cáo nhanh.</li>
              <li><strong><code>/cfo</code>:</strong> mở màn Báo cáo CFO đầy đủ (lệnh vẫn lưu trong chat).</li>
            </ul>
            <button className="bo-btn bo-btn-primary" onClick={() => { finish(); router.push('/chat'); }}>
              Vào chat với {butlerName}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
