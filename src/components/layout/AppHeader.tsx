/* ═══ HeaderShell — Greeting + Streak + Rank (Butler moved to floating) ═══ */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { getRankByXP } from '@/data/rankDefinitions';
import './AppHeader.css';

export default function AppHeader() {
  const { user, firebaseUser } = useAuthStore();

  const displayName =
    user?.displayName || firebaseUser?.displayName || 'Chiến binh';
  const rank = getRankByXP(user?.xp || 0);
  const streak = user?.streak || 0;

  const firstName = displayName.split(' ').pop() || displayName;

  // Time-based greeting verb
  const hour = new Date().getHours();
  let greetVerb = 'Chào buổi sáng';
  if (hour >= 12 && hour < 18) greetVerb = 'Chào buổi chiều';
  else if (hour >= 18) greetVerb = 'Chào buổi tối';

  return (
    <header className="app-header" id="app-header">
      {/* Left: Greeting */}
      <div className="header-left">
        <div className="header-greeting-block">
          <p className="header-greeting-text">
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
