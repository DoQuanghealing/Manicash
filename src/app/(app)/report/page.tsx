import type { Metadata } from 'next';
import { Lora, Be_Vietnam_Pro } from 'next/font/google';
import EmeraldCfoReport from './_components/EmeraldCfoReport';

/* Emerald Editorial: serif Lora cho tiêu đề/số, Be Vietnam Pro cho thân (diacritic VN mạnh). */
const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700'],
  variable: '--font-lora',
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
    <div className={`${lora.variable} ${beVietnam.variable}`}>
      <EmeraldCfoReport />
    </div>
  );
}
