/* ═══ Input Page — Tab 3: Nhập liệu ═══ */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import InputContent from './_components/InputContent';

export const metadata: Metadata = {
  title: 'Nhập liệu — ManiCash',
  description: 'Nhập thu chi và luân chuyển tiền',
};

export default function InputPage() {
  return (
    <Suspense fallback={null}>
      <InputContent />
    </Suspense>
  );
}
