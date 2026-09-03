/* ═══ Admin — Quản lý app ═══ */
import type { Metadata } from 'next';
import HealthContent from './_components/HealthContent';

export const metadata: Metadata = {
  title: 'Quản lý app — ManiCash Admin',
  description: 'Lỗi app, sự kiện lạm dụng, danh sách chặn',
};

export default function AdminHealthPage() {
  return <HealthContent />;
}
