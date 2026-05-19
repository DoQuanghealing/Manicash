'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useBadgeStore } from '@/stores/useBadgeStore';
import { getRankProgress } from '@/data/rankDefinitions';
import BadgeImage from '@/components/ui/BadgeImage';
import HexagonLevelBadge from '@/components/ui/HexagonLevelBadge';
import { Flame, Shield, Target, CheckSquare } from 'lucide-react';
import './ProfileContent.css';

const CATEGORY_LABELS: Record<string, string> = {
  earner: 'Kiếm Tiền',
  discipline: 'Kỷ Luật',
  saver: 'Tiết Kiệm',
  investor: 'Đầu Tư',
  elite: 'Đẳng Cấp',
};

export default function ProfileContent() {
  const { user, firebaseUser } = useAuthStore();
  const tasks = useTaskStore((s) => s.tasks);
  const goals = useGoalsStore((s) => s.goals);
  const transactions = useFinanceStore((s) => s.transactions);
  const monthlySnapshots = useBudgetStore((s) => s.monthlySnapshots);
  const computeBadges = useBadgeStore((s) => s.computeBadges);

  const badges = useMemo(() => computeBadges(), [user, tasks, goals, transactions, monthlySnapshots, computeBadges]);

  const displayName = user?.displayName || firebaseUser?.displayName || 'Chiến binh';
  const photoURL = user?.photoURL || firebaseUser?.photoURL;
  const initials = displayName.substring(0, 2).toUpperCase();

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
          {photoURL ? (
            <img src={photoURL} alt="Avatar" className="profile-avatar" />
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
    </div>
  );
}
