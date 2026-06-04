import type { Metadata } from 'next';
import UpgradeContent from './_components/UpgradeContent';

export const metadata: Metadata = {
  title: 'Nâng cấp Pro | ManiCash',
  description: 'Mở khoá AI Money Chat, CFO Lord Diamond và ghi giao dịch tự động với ManiCash Pro.',
};

export default function UpgradePage() {
  return <UpgradeContent />;
}
