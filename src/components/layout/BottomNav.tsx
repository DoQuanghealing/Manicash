/* ═══ BottomNav — 5 Tab Navigation ═══ */
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  Plus,
  Target,
  Coins,
} from 'lucide-react';
import './BottomNav.css';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isCenter?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/overview', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/ledger', label: 'Sổ sách', icon: BookOpen },
  { href: '/input', label: 'Nhập', icon: Plus, isCenter: true },
  { href: '/goals', label: 'Mục tiêu', icon: Target },
  { href: '/money', label: 'Money', icon: Coins },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        if (item.isCenter) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item nav-item-center ${isActive ? 'active' : ''}`}
              id={`nav-${item.label.toLowerCase()}`}
            >
              <div className="nav-icon-bg">
                <Icon className="nav-icon" size={20} strokeWidth={2.5} />
              </div>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
            id={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <Icon className="nav-icon" size={22} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
