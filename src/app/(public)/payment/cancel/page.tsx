import Link from 'next/link';
import { HeartHandshake } from 'lucide-react';
import '../payment.css';

/** Trang an ủi khi user huỷ thanh toán — giữ kết nối, không trách móc. */
export default function PaymentCancelPage() {
  return (
    <div className="pay-card">
      <div className="pay-icon pay-icon-soft"><HeartHandshake size={38} /></div>
      <h1>Ổn thôi, mình vẫn ở đây 💛</h1>
      <p>
        Không sao cả — mình vẫn đồng hành cùng bạn. Cho mình 30 ngày tới để giúp bạn
        kiểm soát dòng tiền nhé. Khi nào sẵn sàng, gói Pro vẫn chờ bạn.
      </p>
      <Link href="/money" className="pay-btn">Quay lại app</Link>
    </div>
  );
}
