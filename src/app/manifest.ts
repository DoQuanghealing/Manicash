import type { MetadataRoute } from 'next';

// Static export cần manifest là static (không đọc Request). Vô hại cho web build.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ManiCash — Butler tài chính cá nhân',
    short_name: 'ManiCash',
    description: 'Quản lý tài chính cá nhân với AI CFO — kiếm nhiều hơn, chi ít hơn, sống tốt hơn.',
    start_url: '/overview',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0A0A12',
    theme_color: '#7C3AED',
    lang: 'vi',
    dir: 'ltr',
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    related_applications: [
      {
        platform: 'play',
        url: 'https://play.google.com/store/apps/details?id=app.manicash',
        id: 'app.manicash',
      },
    ],
    prefer_related_applications: false,
  };
}
