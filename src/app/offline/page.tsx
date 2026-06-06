/* Offline fallback page — hiển thị khi mất kết nối và tài nguyên chưa được cache */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mất kết nối — ManiCash',
};

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: '#0A0A12',
        color: '#f4f4f5',
        fontFamily: 'var(--font-inter, sans-serif)',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem' }}>📡</div>
      <h1
        style={{
          margin: 0,
          fontSize: '1.375rem',
          fontWeight: 700,
          color: '#f4f4f5',
        }}
      >
        Mất kết nối
      </h1>
      <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9375rem', maxWidth: '320px' }}>
        ManiCash cần internet để hoạt động. Kiểm tra kết nối và thử lại nhé.
      </p>
      <a
        href="/"
        style={{
          marginTop: '8px',
          padding: '10px 24px',
          borderRadius: '12px',
          border: '1px solid rgba(124,58,237,0.5)',
          background: 'rgba(124,58,237,0.15)',
          color: '#a78bfa',
          fontSize: '0.9375rem',
          fontWeight: 600,
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Thử lại
      </a>
    </div>
  );
}
