/* ═══ HeaderShell — Greeting + Streak + Rank (Butler moved to floating) ═══ */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { getRankByXP } from '@/data/rankDefinitions';
import { useRouter } from 'next/navigation';
import ZodiacRunner from './ZodiacRunner';
import './AppHeader.css';

export default function AppHeader() {
  const { user, firebaseUser } = useAuthStore();
  const router = useRouter();

  const displayName =
    user?.displayName || firebaseUser?.displayName || 'Chiến binh';
  const photoURL = user?.photoURL || firebaseUser?.photoURL;
  const initials = displayName.substring(0, 2).toUpperCase();

  const rank = getRankByXP(user?.xp || 0);
  const streak = user?.streak || 0;

  let firstName = displayName.split(' ').pop() || displayName;
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // Time-based greeting verb
  const hour = new Date().getHours();
  let greetVerb = 'Chào buổi sáng';
  if (hour >= 12 && hour < 18) greetVerb = 'Chào buổi chiều';
  else if (hour >= 18) greetVerb = 'Chào buổi tối';

  return (
    <header className="app-header" id="app-header">
      {/* Left: Avatar + Greeting */}
      <div className="header-left">
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

        <div className="header-greeting-block">
          <p className="header-greeting-text">
            <ZodiacRunner />
            {greetVerb},{' '}
            <span className="header-greeting-name">{firstName}</span>
          </p>
        </div>
      </div>

      {/* Right: Unified Streak + Rank block */}
      <div className="header-right">
        <div className="header-badge-group">
          {streak > 0 && (
            <div className="header-streak">
              <span className="header-streak-icon">🔥</span>
              <span className="header-streak-count">{streak}</span>
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
