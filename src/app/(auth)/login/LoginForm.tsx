/* Login Form - Google Sign-in Client Component */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAudio } from '@/hooks/useAudio';

function getLoginErrorMessage(error: unknown): string | null {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
  const message = error instanceof Error ? error.message : String(error);

  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
    return null;
  }

  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
    return 'Domain deploy chưa được thêm vào Firebase Authentication. Vào Firebase Console > Authentication > Settings > Authorized domains để thêm domain Vercel.';
  }

  if (code === 'auth/popup-blocked' || message.includes('popup-blocked')) {
    return 'Trình duyệt đang chặn popup đăng nhập Google. Hãy cho phép popup rồi thử lại.';
  }

  if (message.includes('permission-denied')) {
    return 'Firebase chưa cho phép tạo/cập nhật hồ sơ người dùng. Kiểm tra Firestore Rules cho collection users.';
  }

  return 'Không thể đăng nhập. Vui lòng thử lại.';
}

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { play } = useAudio();

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setError(null);

    try {
      const user = await signInWithGoogle();

      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          uid: user.uid,
          rank: 'iron',
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error(`SESSION_FAILED_${sessionResponse.status}`);
      }

      play('levelUp');
      await new Promise((r) => setTimeout(r, 600));
      router.push('/overview');
    } catch (err) {
      console.error('[login] Google sign-in failed:', err);
      setError(getLoginErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        className="login-google-btn"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
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

      {error && <div className="login-error">{error}</div>}

      <div className="login-divider">
        <span className="login-divider-line" />
        <span className="login-divider-text">Đã bao gồm</span>
        <span className="login-divider-line" />
      </div>

      <div className="login-features">
        <div className="login-feature">
          <span className="login-feature-icon">🛡️</span>
          <span>Quản gia AI riêng, nhắc đúng lúc và không phán xét</span>
        </div>
        <div className="login-feature">
          <span className="login-feature-icon">🎮</span>
          <span>Rank & XP biến quản lý tiền thành thói quen hằng ngày</span>
        </div>
        <div className="login-feature">
          <span className="login-feature-icon">📊</span>
          <span>Số dư an toàn giúp biết còn bao nhiêu tiền được phép tiêu</span>
        </div>
        <div className="login-feature">
          <span className="login-feature-icon">🧘</span>
          <span>Hít thở 30s trước chi lớn để giảm mua theo cảm xúc</span>
        </div>
      </div>
    </>
  );
}
