/* ═══ Admin — Tổng quan (M0) ═══ */
import type { Metadata } from 'next';
import OverviewContent from './_components/OverviewContent';

export const metadata: Metadata = {
  title: 'Tổng quan — ManiCash Admin',
};

export default function AdminOverviewPage() {
  return <OverviewContent />;
}
