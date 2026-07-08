/* ═══ Admin — Nhật ký (M8) ═══ */
import type { Metadata } from 'next';
import AuditContent from './_components/AuditContent';

export const metadata: Metadata = {
  title: 'Nhật ký — ManiCash Admin',
  description: 'Mọi hành động admin: ai · làm gì · lúc nào',
};

export default function AdminAuditPage() {
  return <AuditContent />;
}
