'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useBadgeStore } from '@/stores/useBadgeStore';
import { getRankProgress } from '@/data/rankDefinitions';
import BadgeImage from '@/components/ui/BadgeImage';
import HexagonLevelBadge from '@/components/ui/HexagonLevelBadge';
import ProfileEditModal from '@/components/ui/ProfileEditModal';
import WipeDataConfirm from '@/components/ui/WipeDataConfirm';
import { getEmojiFromAvatar, isEmojiAvatar } from '@/data/avatarIcons';
import { getBanMenh } from '@/lib/banMenh';
import { Flame, Pencil, Shield, Target, CheckSquare, Trash2, Mail, Calendar, Clock, Sparkles } from 'lucide-react';
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
  const [editOpen, setEditOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);

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

      {/* ═══ Personal Info Card ═══ */}
      <section className="profile-info-card">
        {email && (
          <div className="profile-info-row">
            <span className="profile-info-icon"><Mail size={14} /></span>
            <span className="profile-info-label">Email</span>
            <span className="profile-info-value">{email}</span>
          </div>
        )}
        {birthDateDisplay && (
          <div className="profile-info-row">
            <span className="profile-info-icon"><Calendar size={14} /></span>
            <span className="profile-info-label">Ngày sinh</span>
            <span className="profile-info-value">
              {birthDateDisplay}
              {age !== null && <span className="profile-info-sub"> · {age} tuổi</span>}
            </span>
          </div>
        )}
        {birthTime && (
          <div className="profile-info-row">
            <span className="profile-info-icon"><Clock size={14} /></span>
            <span className="profile-info-label">Giờ sinh</span>
            <span className="profile-info-value">{birthTime}</span>
          </div>
        )}
        {menh && (
          <div className="profile-info-row profile-info-row--menh">
            <span className="profile-info-icon"><Sparkles size={14} /></span>
            <span className="profile-info-label">Bản mệnh</span>
            <span className="profile-info-value">
              <strong>{menh.fullName}</strong>
              <span className="profile-info-sub"> · {menh.menhDetail} ({menh.menh})</span>
            </span>
          </div>
        )}
        {!email && !birthDateDisplay && !birthTime && !menh && (
          <button
            type="button"
            className="profile-info-empty"
            onClick={() => setEditOpen(true)}
          >
            <Pencil size={12} />
            <span>Bấm &ldquo;Sửa hồ sơ&rdquo; để bổ sung thông tin cá nhân</span>
          </button>
        )}
      </section>

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

      {/* ═══ Danger zone ═══ */}
      <section className="profile-danger">
        <h2 className="profile-section-title">Vùng nguy hiểm</h2>
        <button
          type="button"
          className="profile-wipe-btn"
          onClick={() => setWipeOpen(true)}
        >
          <Trash2 size={14} />
          <span>Xóa toàn bộ dữ liệu</span>
        </button>
        <p className="profile-wipe-hint">
          Mọi số dư, giao dịch, mục tiêu sẽ về 0. Tên + email + ảnh đại diện được giữ.
        </p>
      </section>

      <ProfileEditModal isOpen={editOpen} onClose={() => setEditOpen(false)} />
      <WipeDataConfirm
        isOpen={wipeOpen}
        onClose={() => setWipeOpen(false)}
        onConfirmed={() => router.refresh()}
      />
    </div>
  );
}
