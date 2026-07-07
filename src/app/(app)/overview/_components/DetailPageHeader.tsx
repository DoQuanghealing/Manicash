/* ═══ DetailPageHeader — Header dùng chung cho các trang chi tiết mở từ Tổng quan ═══ */
'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import './DetailPageHeader.css';

export default function DetailPageHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <button type="button" className="dph-back" onClick={() => router.push('/overview')}>
      <ChevronLeft size={18} />
      <span>{title}</span>
    </button>
  );
}
