/* ═══ Admin Dashboard — Ban Management ═══ */
import type { Metadata } from 'next';
import AdminDashboardContent from './_components/AdminDashboardContent';

export const metadata: Metadata = {
  title: 'Admin Dashboard — ManiCash',
  description: 'Quản lý bảo mật và danh sách chặn',
};

export default function AdminPage() {
  return <AdminDashboardContent />;
}
