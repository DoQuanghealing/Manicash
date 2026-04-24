/* ═══ Login Form — Google Sign-in Client Component ═══ */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAudio } from '@/hooks/useAudio';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { play } = useAudio();
  const { setFirebaseUser, setUserProfile, setLoading, setDemoMode } = useAuthStore();

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setError(null);

    try {
      const user = await signInWithGoogle();

      // Set session cookie via API route (Proxy needs this)
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          uid: user.uid,
          rank: 'iron',
        }),
      });

      play('levelUp');
      await new Promise((r) => setTimeout(r, 600));
      router.push('/overview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Đã có lỗi xảy ra';
      if (message.includes('popup-closed-by-user')) {
        setError(null);
      } else {
        setError('Không thể đăng nhập. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDemoBypass() {
    setIsDemoLoading(true);

    try {
      // IMPORTANT: Set demo mode FIRST so AuthProvider doesn't overwrite
      setDemoMode(true);

      // Set session cookie for Proxy
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          uid: 'demo-user-001',
          rank: 'silver',
        }),
      });

      if (!res.ok) {
        console.error('Session API failed:', res.status);
      }

      // Set demo user in Zustand store
      setFirebaseUser({
        uid: 'demo-user-001',
        email: 'demo@manicash.vn',
        displayName: 'Chiến Binh Demo',
        photoURL: null,
      });

      setUserProfile({
        uid: 'demo-user-001',
        email: 'demo@manicash.vn',
        displayName: 'Chiến Binh Demo',
        photoURL: null,
        rank: 'silver',
        xp: 2500,
        streak: 7,
        lastActiveDate: new Date().toISOString(),
        resistCount: 12,
        totalResistSaved: 3500000,
        isPremium: false,
        plan: 'free',
        premiumExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setLoading(false);

      // Audio is non-blocking — don't let it prevent redirect
      try { play('levelUp'); } catch {}

      // Navigate immediately
      router.push('/overview');
    } catch (err) {
      console.error('Demo bypass error:', err);
      setDemoMode(false);
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
      setIsDemoLoading(false);
    }
  }

  return (
    <>
      <button
        className="login-google-btn"
        onClick={handleGoogleSignIn}
        disabled={isLoading || isDemoLoading}
        id="google-sign-in-btn"
        type="button"
      >
        {isLoading ? (
          <span className="login-spinner" />
        ) : (
          <svg className="login-google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        <span className="login-google-text">
          {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
        </span>
      </button>

      {/* ═══ Demo Bypass Button ═══ */}
      <button
        className="login-demo-btn"
        onClick={handleDemoBypass}
        disabled={isLoading || isDemoLoading}
        id="demo-bypass-btn"
        type="button"
      >
        {isDemoLoading ? (
          <span className="login-spinner" />
        ) : (
          <span>🚀</span>
        )}
        <span className="login-google-text">
          {isDemoLoading ? 'Đang tải...' : 'Trải nghiệm Demo (không cần đăng nhập)'}
        </span>
      </button>

      {error && <div className="login-error">{error}</div>}

      <div className="login-divider">
        <span className="login-divider-line" />
        <span className="login-divider-text">Đã bao gồm</span>
        <span className="login-divider-line" />
      </div>

      <div className="login-features">
        <div className="login-feature">
          <span className="login-feature-icon">🛡️</span>
          <span>Quản gia AI riêng — xắt xéo nhưng yêu bạn</span>
        </div>
        <div className="login-feature">
          <span className="login-feature-icon">🎮</span>
          <span>Hệ thống Rank & XP — kiếm tiền như chơi game</span>
        </div>
        <div className="login-feature">
          <span className="login-feature-icon">📊</span>
          <span>Số dư ảo — che đi sự giàu có để tiết kiệm</span>
        </div>
        <div className="login-feature">
          <span className="login-feature-icon">🧘</span>
          <span>Hít thở 30s trước chi lớn — kỷ luật tài chính</span>
        </div>
      </div>
    </>
  );
}
