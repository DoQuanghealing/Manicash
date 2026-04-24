/* ═══ Ledger Page — Tab 2: Sổ sách ═══ */
import type { Metadata } from 'next';
import LedgerContent from './_components/LedgerContent';

export const metadata: Metadata = {
  title: 'Sổ sách — ManiCash',
  description: 'Quản lý chi tiêu hàng ngày và bill cố định',
};

export default function LedgerPage() {
  return <LedgerContent />;
}
