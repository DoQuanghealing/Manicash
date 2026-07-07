/* ═══ /overview/funds — Chi tiết 3 Quỹ tiết kiệm (mở từ ô Quỹ ở Tổng quan) ═══ */
import type { Metadata } from 'next';
import DetailPageHeader from '../_components/DetailPageHeader';
import FundsBlock from '../_components/FundsBlock';

export const metadata: Metadata = {
  title: 'Quỹ tiết kiệm — ManiCash',
};

export default function FundsDetailPage() {
  return (
    <div className="stack stack-md">
      <DetailPageHeader title="Tổng quan" />
      <FundsBlock />
    </div>
  );
}
