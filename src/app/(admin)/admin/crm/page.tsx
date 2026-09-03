/* ═══ Admin — CRM hành vi (M5) ═══ */
import type { Metadata } from 'next';
import CrmContent from './_components/CrmContent';

export const metadata: Metadata = {
  title: 'CRM hành vi — ManiCash Admin',
  description: 'Hồ sơ thói quen dùng app để quản gia tư vấn đúng lúc',
};

export default function AdminCrmPage() {
  return <CrmContent />;
}
