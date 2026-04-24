/* ═══ Money Page — Tab 5: Nhiệm vụ kiếm tiền & AI CFO ═══ */
import type { Metadata } from 'next';
import MoneyContent from './_components/MoneyContent';

export const metadata: Metadata = {
  title: 'Money — ManiCash',
  description: 'Nhiệm vụ kiếm tiền và AI phân tích tài chính',
};

export default function MoneyPage() {
  return <MoneyContent />;
}
