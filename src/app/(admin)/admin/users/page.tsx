/* ═══ Admin — Người dùng (M2) ═══ */
import type { Metadata } from 'next';
import UsersContent from './_components/UsersContent';

export const metadata: Metadata = {
  title: 'Người dùng — ManiCash Admin',
  description: 'Danh bạ, Customer 360, cấp/thu Pro, yêu cầu xóa tài khoản',
};

export default function AdminUsersPage() {
  return <UsersContent />;
}
