/* ═══ Admin — Bảo mật (ban IP/UID + tài khoản test) ═══ */
import type { Metadata } from 'next';
import AdminDashboardContent from '../_components/AdminDashboardContent';

export const metadata: Metadata = {
  title: 'Bảo mật — ManiCash Admin',
  description: 'Quản lý danh sách chặn và tài khoản test',
};

export default function AdminSecurityPage() {
  return <AdminDashboardContent />;
}
