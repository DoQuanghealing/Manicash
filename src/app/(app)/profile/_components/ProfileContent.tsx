'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProStatus } from '@/hooks/useIsPro';
import { useTaskStore } from '@/stores/useTaskStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useBadgeStore } from '@/stores/useBadgeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getRankProgress, RANKS } from '@/data/rankDefinitions';
import BadgeImage from '@/components/ui/BadgeImage';
import HexagonLevelBadge from '@/components/ui/HexagonLevelBadge';
import ProfileEditModal from '@/components/ui/ProfileEditModal';
import BatTuCard from '@/components/ui/BatTuCard';
import WipeDataConfirm from '@/components/ui/WipeDataConfirm';
import AccountDeletionDialog from '@/components/ui/AccountDeletionDialog';
import ButlerSettingsCard from './ButlerSettingsCard';
import FinancialDnaPanel from '@/components/butler/FinancialDnaPanel';
import EcosystemSection from './EcosystemSection';
import { getEmojiFromAvatar, isEmojiAvatar } from '@/data/avatarIcons';
import { getBanMenh } from '@/lib/banMenh';
import { Flame, Pencil, Shield, Target, CheckSquare, Trash2, Mail, Calendar, Clock, Sparkles, LogOut, UserX, Crown, ChevronRight } from 'lucide-react';
import { useSignOut } from '@/hooks/useSignOut';
import { isAdminEmail } from '@/lib/adminEmails';
import './ProfileContent.css';

function formatBirthDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}

function calcAge(birthDate?: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

const CATEGORY_LABELS: Record<string, string> = {
  earner: 'Kiếm Tiền',
  discipline: 'Kỷ Luật',
  saver: 'Tiết Kiệm',
  investor: 'Đầu Tư',
  elite: 'Đẳng Cấp',
};

export default function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, firebaseUser } = useAuthStore();
  const proStatus = useProStatus();
  const { handleSignOut } = useSignOut();
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const [editOpen, setEditOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  // Deep-link từ onboarding quest: /profile?edit=1 → auto-open ProfileEditModal
  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setEditOpen(true);
    }
  }, [searchParams]);
  const tasks = useTaskStore((s) => s.tasks);
  const goals = useGoalsStore((s) => s.goals);
  const transactions = useFinanceStore((s) => s.transactions);
  const monthlySnapshots = useBudgetStore((s) => s.monthlySnapshots);
  const computeBadges = useBadgeStore((s) => s.computeBadges);

  // computeBadges() reads the listed stores internally; we re-run it
  // when those stores update by depending on the snapshots we subscribed
  // to above. The lint rule complains because the lambda doesn't
  // literally reference them — silence with a comment, intent is clear.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const badges = useMemo(() => computeBadges(), [user, tasks, goals, transactions, monthlySnapshots, computeBadges]);

  const displayName = user?.displayName || firebaseUser?.displayName || 'Chiến binh';
  const photoURL = user?.photoURL || firebaseUser?.photoURL;
  const avatarEmoji = getEmojiFromAvatar(photoURL);
  const isPhotoAvatar = !!photoURL && !isEmojiAvatar(photoURL);
  const initials = displayName.substring(0, 2).toUpperCase();

  // ── Personal info section ──
  const email = user?.email || firebaseUser?.email || '';
  const birthDateISO = user?.birthDate || (user?.yearOfBirth ? `${user.yearOfBirth}-01-01` : '');
  const birthDateDisplay = formatBirthDate(birthDateISO);
  const birthTime = user?.birthTime || '';
  const age = calcAge(birthDateISO);
  const menh = useMemo(() => getBanMenh(user?.yearOfBirth), [user?.yearOfBirth]);

  // Fallback to zero/defaults when UserProfile hasn't loaded yet (Firestore
  // fetch pending or anonymous session). AppHeader uses the same pattern so
  // header always renders. Previously this component blocked with a "loading"
  // state that never resolved when user stayed null.
  const xp = user?.xp ?? 0;
  const rankData = useMemo(() => getRankProgress(xp), [xp]);

  const stats = useMemo(() => {
    const tasksDone = tasks.filter(t => t.completedAt).length;
    const goalsCompleted = goals.filter(g => g.currentAmount >= g.targetAmount).length;
    return {
      streak: user?.streak || 0,
      resist: user?.resistCount || 0,
      goals: goalsCompleted,
      tasks: tasksDone,
    };
  }, [user, tasks, goals]);

  // Group badges by category
  const badgesByCategory = useMemo(() => {
    const grouped: Record<string, typeof badges> = {};
    for (const b of badges) {
      if (!grouped[b.badge.category]) {
        grouped[b.badge.category] = [];
      }
      grouped[b.badge.category].push(b);
    }
    return grouped;
  }, [badges]);

  return (
    <div className="profile-page">
      {!user && !firebaseUser && (
        <div className="profile-empty-hint" style={{ padding: '12px 16px', textAlign: 'center', color: '#A1A1AA', fontSize: '13px' }}>
          Chưa đăng nhập — số liệu hiển thị mặc định.
        </div>
      )}
      {/* ═══ Hero Section ═══ */}
      <section className="profile-hero">
        <div 
          className="profile-hero-bg"
          style={{ background: `linear-gradient(135deg, ${rankData.current.gradientFrom}, ${rankData.current.gradientTo})` }}
        />
        <div className="profile-avatar-container">
          {isPhotoAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoURL!} alt="Avatar" className="profile-avatar" />
          ) : avatarEmoji ? (
            <div className="profile-avatar-emoji">{avatarEmoji}</div>
          ) : (
            <div className="profile-avatar-fallback">{initials}</div>
          )}
        </div>
        
        <div className="profile-hero-info">
          <h1 className="profile-name">{displayName}</h1>

          <div className="profile-xp-bar-container">
            <div className="profile-xp-text">
              <span>{xp.toLocaleString('vi-VN')} XP</span>
              <span>{rankData.next ? `${rankData.next.xpRequired.toLocaleString('vi-VN')} XP` : 'MAX'}</span>
            </div>
            <div className="profile-xp-track">
              <div
                className="profile-xp-fill"
                style={{ width: `${rankData.progress}%` }}
              />
            </div>
          </div>

          {/* Rank roadmap — dải 7 hexagon (đã qua mờ, hiện tại sáng) */}
          <div className="profile-rank-roadmap">
            {RANKS.map((r) => {
              const isCurrent = r.id === rankData.current.id;
              const isPast = xp >= r.xpRequired && !isCurrent;
              return (
                <span
                  key={r.id}
                  className={`profile-roadmap-hex ${isCurrent ? 'is-current' : isPast ? 'is-past' : 'is-future'}`}
                  style={isCurrent ? { background: `linear-gradient(150deg, ${r.gradientFrom}, ${r.gradientTo})` } : undefined}
                  title={r.name}
                >
                  {r.icon}
                </span>
              );
            })}
          </div>

          {/* Personal info inline dưới XP — chỉ hiện khi có data */}
          {(email || birthDateDisplay || birthTime || menh) && (
            <div className="profile-hero-meta">
              {email && (
                <span className="profile-meta-chip">
                  <Mail size={11} />
                  <span className="profile-meta-text">{email}</span>
                </span>
              )}
              {birthDateDisplay && (
                <span className="profile-meta-chip">
                  <Calendar size={11} />
                  <span className="profile-meta-text">
                    {birthDateDisplay}
                    {age !== null && <span className="profile-meta-sub"> · {age}t</span>}
                  </span>
                </span>
              )}
              {birthTime && (
                <span className="profile-meta-chip">
                  <Clock size={11} />
                  <span className="profile-meta-text">{birthTime}</span>
                </span>
              )}
              {menh && (
                <span className="profile-meta-chip profile-meta-chip--menh">
                  <Sparkles size={11} />
                  <span className="profile-meta-text">
                    <strong>{menh.fullName}</strong>
                    <span className="profile-meta-sub"> · {menh.menh}</span>
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="profile-rank-badge">
          <HexagonLevelBadge rank={rankData.current} size={72} />
        </div>

        <button
          type="button"
          className="profile-edit-btn"
          onClick={() => setEditOpen(true)}
          aria-label="Sửa hồ sơ"
        >
          <Pencil size={14} />
          <span>Sửa hồ sơ</span>
        </button>
      </section>

      {/* ═══ Cá nhân hoá ═══ */}
      <section className="profile-personalize">
        <h2 className="profile-section-title">Cá nhân hoá</h2>
        <button type="button" className="profile-toggle-row" onClick={() => setEditOpen(true)}>
          <div className="profile-toggle-info">
            <strong>Vibe &amp; tuổi</strong>
            <span>Điều chỉnh lời chào cá nhân hoá</span>
          </div>
          <ChevronRight size={16} className="profile-pro-chevron" />
        </button>
        <div className="profile-toggle-row">
          <div className="profile-toggle-info">
            <strong>Giao diện sáng</strong>
            <span>Đổi sang nền sáng (mặc định tối)</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'light'}
            aria-label="Bật giao diện sáng"
            className={`profile-switch ${theme === 'light' ? 'is-on' : ''}`}
            onClick={toggleTheme}
          >
            <span className="profile-switch-knob" />
          </button>
        </div>
      </section>

      {/* ═══ Quản gia (tên + cấp độ, đổi cấp độ = consent) ═══ */}
      <ButlerSettingsCard />

      {/* ═══ La Bàn Tài Chính Nội Tâm (PV-3) — teaser cho Free, đầy đủ cho Phú Vương ═══ */}
      <FinancialDnaPanel />

      {/* ═══ Pro membership entry ═══ */}
      <Link href="/upgrade" className={`profile-pro-card ${proStatus.isPro ? 'is-pro' : ''}`}>
        <div className="profile-pro-icon" aria-hidden="true">
          <Crown size={18} />
        </div>
        <div className="profile-pro-info">
          <strong>{proStatus.isPro ? 'ManiCash Pro' : 'Nâng cấp lên Pro'}</strong>
          <span>
            {proStatus.isPro
              ? proStatus.daysRemaining > 0
                ? `Đang kích hoạt · còn ${proStatus.daysRemaining} ngày`
                : 'Đang kích hoạt'
              : 'Mở khoá AI Money Chat, CFO riêng & ghi sổ tự động'}
          </span>
        </div>
        <ChevronRight size={18} className="profile-pro-chevron" />
      </Link>

      {/* ═══ Lá Số Bát Tự — tự ẩn nếu chưa có ngày sinh ═══ */}
      <BatTuCard
        birthDate={birthDateISO || undefined}
        birthTime={birthTime || undefined}
        onAddTime={() => setEditOpen(true)}
      />

      {/* ═══ Stats Grid ═══ */}
      <section className="profile-stats-grid">
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ color: '#F97316' }}><Flame size={20} /></div>
          <div className="profile-stat-info">
            <span className="profile-stat-value">{stats.streak}</span>
            <span className="profile-stat-label">Ngày liên tiếp</span>
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ color: '#3B82F6' }}><Shield size={20} /></div>
          <div className="profile-stat-info">
            <span className="profile-stat-value">{stats.resist}</span>
            <span className="profile-stat-label">Lần nhịn chi tiêu</span>
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ color: '#22C55E' }}><Target size={20} /></div>
          <div className="profile-stat-info">
            <span className="profile-stat-value">{stats.goals}</span>
            <span className="profile-stat-label">Mục tiêu đã đạt</span>
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ color: '#A855F7' }}><CheckSquare size={20} /></div>
          <div className="profile-stat-info">
            <span className="profile-stat-value">{stats.tasks}</span>
            <span className="profile-stat-label">Nhiệm vụ hoàn thành</span>
          </div>
        </div>
      </section>

      {/* ═══ Badges Collection ═══ */}
      <section className="profile-badges">
        <h2 className="profile-section-title">🏆 Bộ sưu tập Huy Hiệu</h2>
        
        {['earner', 'discipline', 'saver', 'investor', 'elite'].map((cat) => {
          const catBadges = badgesByCategory[cat];
          if (!catBadges?.length) return null;

          return (
            <div key={cat} className="badges-category">
              <h3 className="badges-category-title">{CATEGORY_LABELS[cat]}</h3>
              <div className="badges-grid">
                {catBadges.map((item) => (
                  <div key={item.badge.id} className={`badge-card ${item.level > 0 ? 'unlocked' : 'locked'}`}>
                    <div className="badge-img-wrapper">
                      <BadgeImage badge={item.badge} unlocked={item.level > 0} size={80} />
                    </div>
                    <span className="badge-level-tag">Lv {item.level}/5</span>
                    <h4 className="badge-name">{item.badge.name}</h4>
                    
                    <div className="badge-progress-container">
                      <div className="badge-progress-text">
                        {item.level < 5 
                          ? `${item.value}/${item.nextThreshold} ${item.badge.unit}`
                          : 'Đã tối đa'
                        }
                      </div>
                      <div className="badge-progress-track">
                        <div 
                          className="badge-progress-fill" 
                          style={{ width: `${item.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* ═══ Hệ sinh thái (deep-link Academy) ═══ */}
      <EcosystemSection />

      {/* ═══ Legal links ═══ */}
      <section className="profile-legal">
        <h2 className="profile-section-title">Pháp lý</h2>
        <Link href="/legal/privacy" className="profile-legal-link">
          <span>Chính sách quyền riêng tư</span>
          <ChevronRight size={16} />
        </Link>
        <Link href="/legal/terms" className="profile-legal-link">
          <span>Điều khoản sử dụng</span>
          <ChevronRight size={16} />
        </Link>
      </section>

      {/* ═══ Cổng quản trị — CHỈ hiện với email admin (allowlist). Bảo mật thật ở server ═══ */}
      {isAdminEmail(user?.email) && (
        <section className="profile-admin-entry">
          <Link href="/admin" className="profile-admin-btn" aria-label="Vào trang quản trị">
            <span className="profile-admin-btn__icon"><Shield size={18} /></span>
            <span className="profile-admin-btn__text">
              <span className="profile-admin-btn__title">Trang quản trị</span>
              <span className="profile-admin-btn__sub">Chỉ dành cho quản trị viên</span>
            </span>
            <ChevronRight size={18} />
          </Link>
        </section>
      )}

      {/* ═══ Danger zone ═══ */}
      <section className="profile-danger">
        <h2 className="profile-section-title">Vùng nguy hiểm</h2>
        <button
          type="button"
          className="profile-wipe-btn profile-wipe-btn--neutral"
          onClick={handleSignOut}
        >
          <LogOut size={14} />
            <span>Đăng xuất</span>
        </button>
        <button
          type="button"
          className="profile-wipe-btn"
          onClick={() => setWipeOpen(true)}
        >
          <Trash2 size={14} />
          <span>Xóa toàn bộ dữ liệu</span>
        </button>
        <button
          type="button"
          className="profile-wipe-btn profile-wipe-btn--danger"
          onClick={() => setDeleteAccountOpen(true)}
        >
          <UserX size={14} />
            <span>Xóa tài khoản</span>
        </button>
        <p className="profile-wipe-hint">
          Đăng xuất chỉ rời khỏi thiết bị này. Xóa tài khoản sẽ lên lịch xóa
          vĩnh viễn sau 30 ngày. Nút xóa dữ liệu chỉ reset số liệu tài chính.
        </p>
        <p className="profile-wipe-hint profile-wipe-hint--legacy">
          Mọi số dư, giao dịch, mục tiêu sẽ về 0. Tên + email + ảnh đại diện được giữ.
        </p>
      </section>

      <ProfileEditModal isOpen={editOpen} onClose={() => setEditOpen(false)} />
      <WipeDataConfirm
        isOpen={wipeOpen}
        onClose={() => setWipeOpen(false)}
        onConfirmed={() => router.refresh()}
      />
      <AccountDeletionDialog
        isOpen={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
      />
    </div>
  );
}
