/* ═══ Admin — Chế độ giả lập ═══ */
import type { Metadata } from 'next';
import SimulateContent from './_components/SimulateContent';

export const metadata: Metadata = {
  title: 'Chế độ giả lập — ManiCash Admin',
  description: 'Nạp số liệu ảo để chụp ảnh demo, không đụng dữ liệu thật',
};

export default function AdminSimulatePage() {
  return <SimulateContent />;
}
