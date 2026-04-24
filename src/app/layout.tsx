/* ═══ Root Layout — ManiCash ═══ */
import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ManiCash — Quản Gia Tài Chính Thông Minh',
    template: '%s | ManiCash',
  },
  description:
    'Ứng dụng quản lý tài chính cá nhân với AI quản gia — kiếm nhiều hơn, chi ít hơn, sống tốt hơn. Hệ thống gamification với 7 cấp rank, nhiệm vụ kiếm tiền, và bài tập kỷ luật tài chính.',
  keywords: ['quản lý tài chính', 'tiết kiệm', 'kiếm tiền', 'AI', 'gamification'],
  authors: [{ name: 'ManiCash Team' }],
  openGraph: {
    title: 'ManiCash — Quản Gia Tài Chính Thông Minh',
    description: 'Kiếm nhiều hơn. Chi ít hơn. Sống tốt hơn.',
    type: 'website',
    locale: 'vi_VN',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0A12',
  colorScheme: 'dark light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable} ${outfit.variable}`} data-theme="dark" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
