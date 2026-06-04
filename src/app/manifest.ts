import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ManiCash — Quản Gia Tài Chính',
    short_name: 'ManiCash',
    description: 'Quản lý tài chính cá nhân với AI quản gia — kiếm nhiều hơn, chi ít hơn, sống tốt hơn.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0A0A12',
    theme_color: '#7C3AED',
    lang: 'vi',
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
