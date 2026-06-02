import type { Metadata } from 'next';
import CfoReportContent from './_components/CfoReportContent';

export const metadata: Metadata = {
  title: 'Báo cáo tài chính | ManiCash',
};

export default function ReportPage() {
  return <CfoReportContent />;
}
