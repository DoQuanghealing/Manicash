import type { ReactNode } from 'react';

/** Layout tối giản cho trang công khai (thanh toán) — không AuthGuard, không bottom-nav. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="pay-shell">{children}</div>;
}
