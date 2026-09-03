/* ═══ HeaderShell — Greeting + Streak + Rank (Butler moved to floating) ═══ */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getRankByXP } from '@/data/rankDefinitions';
import { useRouter, usePathname } from 'next/navigation';
import { resolveVibe } from '@/lib/ageGroup';
import { getCopy } from '@/data/vibedCopy';
import { isCollectionEnabled } from '@/lib/featureFlags';
import { isAdminEmail } from '@/lib/adminEmails';
import ZodiacRunner from './ZodiacRunner';
import './AppHeader.css';

export default function AppHeader() {
  const { user, firebaseUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const displayName =
    user?.displayName || firebaseUser?.displayName || 'Chiến binh';
  const photoURL = user?.photoURL || firebaseUser?.photoURL;
  const initials = displayName.substring(0, 2).toUpperCase();

  const rank = getRankByXP(user?.xp || 0);
  const streak = user?.streak || 0;
  const shields = user?.streakShields || 0;

  let firstName = displayName.split(' ').pop() || displayName;
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // Time-based greeting verb — vibed theo app vibe + yearOfBirth
  const appVibe = useSettingsStore((s) => s.appVibe);
  const vibe = resolveVibe(appVibe, user?.yearOfBirth);
  const hour = new Date().getHours();
  let greetKey = 'greeting.morning';
  if (hour >= 12 && hour < 18) greetKey = 'greeting.afternoon';
  else if (hour >= 18) greetKey = 'greeting.evening';
  const greetVerb = getCopy(greetKey, vibe);

  /* /chat có thanh tiêu đề riêng (pill "Quản gia tài chính") — chồng thêm thanh
   * chào + rank ở trên chỉ ăn mất chiều cao khung chat. Ẩn hẳn ở route này để
   * luồng tin nhắn dài hơn; các tab khác giữ nguyên. */
  if (pathname?.startsWith('/chat')) return null;

  return (
    <header className="app-header" id="app-header">
      {/* Left: Avatar + Greeting */}
      <div className="header-left">
        {/* Avatar + huy hiệu admin.
         * Huy hiệu phải là ANH EM của nút avatar, không nằm trong nó: lồng
         * <button> trong <button> là HTML không hợp lệ — trình duyệt tự tháo
         * lồng và nút con mất tác dụng.
         * Chỉ hiện với email trong allowlist. Đây chỉ là ẨN/HIỆN cho gọn mắt;
         * chặn thật nằm ở server (Custom Claim + verify), nên người khác gõ
         * thẳng /admin vẫn không vào được. */}
        <div className="header-avatar-wrap">
          <button
            className="header-user-avatar"
            onClick={() => router.push('/profile')}
            aria-label="Xem hồ sơ"
          >
            {photoURL ? (
              <img src={photoURL} alt="Avatar" />
            ) : (
              <span>{initials}</span>
            )}
          </button>

          {isAdminEmail(user?.email ?? firebaseUser?.email) && (
            <button
              type="button"
              className="header-admin-badge"
              onClick={() => router.push('/admin')}
              aria-label="Vào trang quản trị"
              title="Trang quản trị"
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 3 5 6v5.5c0 4.2 2.9 8.1 7 9.3 4.1-1.2 7-5.1 7-9.3V6l-7-3Z" />
              </svg>
            </button>
          )}
        </div>

        <div className="header-greeting-block">
          <p className="header-greeting-text">
            {/* Entry "Bộ sưu tầm" (linh vật) — ẩn khi kho chưa hoàn thiện (WIP). */}
            {isCollectionEnabled() && <ZodiacRunner />}
            {greetVerb},{' '}
            <span className="header-greeting-name">{firstName}</span>
          </p>
        </div>
      </div>

      {/* Right: Unified Streak + Shield + Rank block */}
      <div className="header-right">
        <div className="header-badge-group">
          {streak > 0 && (
            <div className="header-streak" title={`Streak ${streak} ngày`}>
              <span className="header-streak-icon">🔥</span>
              <span className="header-streak-count">{streak}</span>
            </div>
          )}
          {shields > 0 && (
            <div className="header-shield" title={`${shields} shield bảo vệ streak`}>
              <span className="header-shield-icon">🛡️</span>
              <span className="header-shield-count">{shields}</span>
            </div>
          )}
          <div className="header-rank-mini">
            <span className="header-rank-icon">{rank.icon}</span>
            <span
              className="header-rank-name"
              style={{
                background: `linear-gradient(135deg, ${rank.gradientFrom}, ${rank.gradientTo})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {rank.name}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
