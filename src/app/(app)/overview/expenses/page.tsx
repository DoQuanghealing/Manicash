/* ═══ /overview/expenses — Chi tiết Chi tiêu & Hóa đơn (mở từ ô Chi tiêu/Hóa đơn ở Tổng quan) ═══
 * Gộp 2 màn thiết kế (15 Chi tiêu&Bill / 18 Hóa đơn) thành 1 route vì logic + modal
 * đã dùng chung 1 component nguồn (ExpenseBillBlock) — tránh tách đôi rủi ro vỡ state.
 */
import type { Metadata } from 'next';
import DetailPageHeader from '../_components/DetailPageHeader';
import ExpenseBillBlock from '../_components/ExpenseBillBlock';

export const metadata: Metadata = {
  title: 'Chi tiêu & Hóa đơn — ManiCash',
};

export default function ExpensesDetailPage() {
  return (
    <div className="stack stack-md">
      <DetailPageHeader title="Tổng quan" />
      <ExpenseBillBlock />
    </div>
  );
}
