'use client';

/**
 * AuthGuard — bảo vệ route (app) ở phía client.
 *
 * Trên web, proxy.ts đã guard server-side (cookie). Nhưng bản static export
 * cho mobile KHÔNG có proxy → cần guard client-side dựa trên Firebase auth
 * state. Component này áp dụng cho cả 2 (web: gần như no-op vì proxy đã chặn;
 * mobile: là lớp guard chính).
 *
 * - isLoading: chờ Firebase onAuthStateChanged resolve → hiện splash.
 * - !isAuthenticated sau khi resolve → redirect /login.
 * - authenticated → render nội dung.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A12',
        }}
        aria-busy="true"
        aria-label="Đang tải"
      >
        <span
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '3px solid rgba(124,58,237,0.25)',
            borderTopColor: '#7C3AED',
            animation: 'manicash-auth-spin 0.7s linear infinite',
          }}
        />
        <style>{'@keyframes manicash-auth-spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  return <>{children}</>;
}
