/* ═══ Admin — Tiền & Doanh thu (M1) ═══ */
import type { Metadata } from 'next';
import MoneyAdminContent from './_components/MoneyAdminContent';

export const metadata: Metadata = {
  title: 'Tiền & Doanh thu — ManiCash Admin',
  description: 'Bảng đơn hàng, đối soát đã trả chưa cấp Pro, cấp Pro thủ công',
};

export default function AdminMoneyPage() {
  return <MoneyAdminContent />;
}
