/* ═══ Overview Page — Tab 1: Tổng quan ═══ */
import type { Metadata } from 'next';
import OverviewContent from './_components/OverviewContent';

export const metadata: Metadata = {
  title: 'Tổng quan — ManiCash',
  description: 'Tổng quan tài chính cá nhân với số dư ảo và nhiệt độ tài chính',
};

export default function OverviewPage() {
  return <OverviewContent />;
}
