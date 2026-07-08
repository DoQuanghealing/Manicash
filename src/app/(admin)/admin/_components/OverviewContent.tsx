/* ═══ Admin M0 — Tổng quan (KPI + hàng đợi việc cần làm) ═══ */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/lib/apiBase';
import { authHeaders } from '@/lib/adminClient';
import '../overview.css';

interface Kpis {
  revenueToday: number;
  revenue30d: number;
  paidCount30d: number;
  proActive: number;
  dau: number;
  totalUsers: number;
  usersCapped: boolean;
  queues: { deletionPending: number; paidNotGranted: number };
  generatedAt: string;
}

function vnd(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}

export default function OverviewContent() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Phiên đăng nhập hết hạn — đăng nhập lại.');
        return;
      }
      const res = await fetch(apiUrl('/api/admin/overview'), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKpis(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalQueue = kpis ? kpis.queues.deletionPending + kpis.queues.paidNotGranted : 0;

  return (
    <div className="adm-ov">
      <header className="adm-ov-head">
        <h1 className="adm-ov-title">Trung tâm quản trị</h1>
        <p className="adm-ov-sub">
          {kpis
            ? `Cập nhật ${new Date(kpis.generatedAt).toLocaleString('vi-VN')}`
            : 'Chỉ số toàn cục doanh thu và người dùng.'}
        </p>
      </header>

      {error && <div className="adm-ov-error">{error}</div>}

      {/* KPI */}
      <div className="adm-ov-kpis">
        <Kpi label="Doanh thu hôm nay" value={kpis ? vnd(kpis.revenueToday) : '—'} loading={loading} />
        <Kpi
          label="Doanh thu 30 ngày"
          value={kpis ? vnd(kpis.revenue30d) : '—'}
          sub={kpis ? `${kpis.paidCount30d} đơn` : undefined}
          loading={loading}
        />
        <Kpi label="Pro đang hoạt động" value={kpis ? String(kpis.proActive) : '—'} loading={loading} />
        <Kpi
          label="DAU (24h)"
          value={kpis ? String(kpis.dau) : '—'}
          sub={kpis ? `/ ${kpis.totalUsers}${kpis.usersCapped ? '+' : ''} user` : undefined}
          loading={loading}
        />
      </div>

      {/* Hàng đợi việc cần làm */}
      <section className="adm-ov-section">
        <h2 className="adm-ov-h2">
          Việc cần làm {totalQueue > 0 && <span className="adm-ov-alert">{totalQueue}</span>}
        </h2>
        <div className="adm-ov-queue">
          <Link href="/admin/money" className="adm-ov-queue-item">
            <span className="adm-ov-queue-num">{kpis?.queues.paidNotGranted ?? '—'}</span>
            <span className="adm-ov-queue-label">Đã trả · chưa cấp Pro</span>
          </Link>
          <Link href="/admin/users" className="adm-ov-queue-item">
            <span className="adm-ov-queue-num">{kpis?.queues.deletionPending ?? '—'}</span>
            <span className="adm-ov-queue-label">Yêu cầu xóa tài khoản</span>
          </Link>
        </div>
      </section>

      {/* Điểm vào module */}
      <section className="adm-ov-section">
        <h2 className="adm-ov-h2">Module</h2>
        <div className="adm-ov-grid">
          <Link href="/admin/money" className="adm-ov-card">
            <span className="adm-ov-emoji">💰</span>
            <span className="adm-ov-card-title">Tiền &amp; Doanh thu</span>
            <span className="adm-ov-card-desc">Đơn hàng, đối soát, biểu đồ doanh thu, cấp Pro.</span>
          </Link>
          <Link href="/admin/users" className="adm-ov-card">
            <span className="adm-ov-emoji">👥</span>
            <span className="adm-ov-card-title">Người dùng</span>
            <span className="adm-ov-card-desc">Danh bạ, Customer 360, cấp/thu Pro, yêu cầu xóa.</span>
          </Link>
          <Link href="/admin/audit" className="adm-ov-card">
            <span className="adm-ov-emoji">📜</span>
            <span className="adm-ov-card-title">Nhật ký</span>
            <span className="adm-ov-card-desc">Mọi hành động admin (ai · làm gì · lúc nào).</span>
          </Link>
          <Link href="/admin/security" className="adm-ov-card">
            <span className="adm-ov-emoji">🛡️</span>
            <span className="adm-ov-card-title">Bảo mật</span>
            <span className="adm-ov-card-desc">Chặn IP/UID, tài khoản test.</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className={`adm-ov-kpi${loading ? ' adm-ov-kpi-loading' : ''}`}>
      <span className="adm-ov-kpi-label">{label}</span>
      <span className="adm-ov-kpi-value">{value}</span>
      {sub && <span className="adm-ov-kpi-sub">{sub}</span>}
    </div>
  );
}
