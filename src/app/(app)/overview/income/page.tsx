/* ═══ /overview/income — Chi tiết Thu nhập (mở từ ô Thu nhập ở Tổng quan) ═══ */
import type { Metadata } from 'next';
import DetailPageHeader from '../_components/DetailPageHeader';
import IncomeBlock from '../_components/IncomeBlock';
import IncomeDetailPanel from '../_components/IncomeDetailPanel';

export const metadata: Metadata = {
  title: 'Thu nhập — ManiCash',
};

export default function IncomeDetailPage() {
  return (
    <div className="stack stack-md">
      <DetailPageHeader title="Tổng quan" />
      <IncomeBlock />
      <IncomeDetailPanel />
    </div>
  );
}
