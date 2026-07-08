/* ═══ AdminShell — khung chung cho route group (admin) ═══
 * Gác cả nhóm bằng useAdminGate (Custom Claim + allowlist email). Chỉ render
 * children khi là admin; các trang con vì thế luôn chạy trong ngữ cảnh admin.
 * Sidebar 9 module — module chưa build hiển thị "sắp có" (không link).
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Users,
  MessageSquare,
  FlaskConical,
  Link2,
  HeartPulse,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { useAdminGate } from '@/lib/adminClient';
import './admin-shell.css';

interface NavItem {
  href: string;
  label: string;
  code: string;
  icon: typeof LayoutDashboard;
  ready: boolean;
}

/** 9 module theo blueprint. `ready=false` → hiển thị mờ, không điều hướng. */
const NAV: NavItem[] = [
  { href: '/admin', label: 'Tổng quan', code: 'M0', icon: LayoutDashboard, ready: true },
  { href: '/admin/money', label: 'Tiền & Doanh thu', code: 'M1', icon: Wallet, ready: true },
  { href: '/admin/users', label: 'Người dùng', code: 'M2', icon: Users, ready: true },
  { href: '/admin/support', label: 'Chat & Hỗ trợ', code: 'M3', icon: MessageSquare, ready: false },
  { href: '/admin/research', label: 'R&D người tốt lên', code: 'M4', icon: FlaskConical, ready: false },
  { href: '/admin/crm', label: 'Cổng CRM', code: 'M5', icon: Link2, ready: false },
  { href: '/admin/wellbeing', label: 'Chữa lành', code: 'M6', icon: HeartPulse, ready: false },
  { href: '/admin/audit', label: 'Nhật ký', code: 'M8', icon: ScrollText, ready: true },
  { href: '/admin/security', label: 'Bảo mật', code: 'S', icon: ShieldCheck, ready: true },
];

function GateScreen({ icon, title, subtitle, cta }: { icon: string; title: string; subtitle: string; cta?: React.ReactNode }) {
  return (
    <div className="adm-gate">
      <div className="adm-gate-card">
        <div className="adm-gate-icon">{icon}</div>
        <h1 className="adm-gate-title">{title}</h1>
        <p className="adm-gate-sub">{subtitle}</p>
        {cta}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const state = useAdminGate();
  const pathname = usePathname();

  if (state === 'checking') {
    return <GateScreen icon="🛡️" title="Trung tâm quản trị" subtitle="Đang kiểm tra quyền truy cập…" />;
  }
  if (state === 'anon') {
    return (
      <GateScreen
        icon="🔐"
        title="Cần đăng nhập"
        subtitle="Đăng nhập ManiCash bằng tài khoản admin, rồi mở lại trang này."
        cta={
          <a className="adm-btn adm-btn-primary" href="/login">
            Tới trang đăng nhập
          </a>
        }
      />
    );
  }
  if (state === 'forbidden') {
    return (
      <GateScreen
        icon="⛔"
        title="Không có quyền"
        subtitle="Tài khoản này không có quyền admin. Nếu vừa được cấp quyền, hãy đăng xuất rồi đăng nhập lại để làm mới token."
      />
    );
  }

  const activeHref = NAV.filter((n) => n.ready)
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
    // href dài nhất khớp = mục đang mở (tránh '/admin' luôn khớp).
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="adm-root">
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <span className="adm-brand-mark">◈</span>
          <div>
            <div className="adm-brand-name">ManiCash</div>
            <div className="adm-brand-sub">Trung tâm quản trị</div>
          </div>
        </div>
        <nav className="adm-nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            if (!item.ready) {
              return (
                <span key={item.href} className="adm-nav-item adm-nav-soon" title="Sắp có">
                  <Icon size={18} />
                  <span className="adm-nav-label">{item.label}</span>
                  <span className="adm-nav-badge">soon</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`adm-nav-item${active ? ' adm-nav-active' : ''}`}
              >
                <Icon size={18} />
                <span className="adm-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <a className="adm-back" href="/overview">
          ← Về ứng dụng
        </a>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
