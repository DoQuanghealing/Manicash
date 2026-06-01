/* ═══ Goals Page — Tab 4: Mục tiêu ═══ */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import GoalsContent from './_components/GoalsContent';

export const metadata: Metadata = {
  title: 'Mục tiêu — ManiCash',
  description: 'Đặt và theo dõi mục tiêu tài chính lớn',
};

export default function GoalsPage() {
  return (
    <Suspense fallback={null}>
      <GoalsContent />
    </Suspense>
  );
}
