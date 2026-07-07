import type { Metadata } from 'next';
import { Playfair_Display, Be_Vietnam_Pro } from 'next/font/google';
import EmeraldCfoReport from './_components/EmeraldCfoReport';

/* Champagne Editorial: serif Playfair Display (tiêu đề kể chuyện luxury) + Be Vietnam Pro (thân, diacritic VN mạnh). */
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});
const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bvp',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Báo cáo CFO | ManiCash',
};

export default function ReportPage() {
  return (
    <div className={`${playfair.variable} ${beVietnam.variable}`}>
      <EmeraldCfoReport />
    </div>
  );
}
