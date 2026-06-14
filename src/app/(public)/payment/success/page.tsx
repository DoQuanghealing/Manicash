import { Suspense } from 'react';
import SuccessClient from './SuccessClient';
import '../payment.css';

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="pay-card"><h1>Đang tải…</h1></div>}>
      <SuccessClient />
    </Suspense>
  );
}
