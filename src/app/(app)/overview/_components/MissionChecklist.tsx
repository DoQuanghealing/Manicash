/* ═══ MissionChecklist — Gợi ý nhiệm vụ tối ưu tài chính ═══ */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronRight, Trophy, Target, CheckCircle2 } from 'lucide-react';
import { useConfetti } from '@/hooks/useConfetti';
import { useAudio } from '@/hooks/useAudio';
import { useMissionStore } from '@/stores/useMissionStore';
import './MissionChecklist.css';

/* ── Mission Data ── */
interface MissionStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface NextAction {
  text: string;
  icon: string;
}

const MISSION_STEPS: MissionStep[] = [
  {
    id: 'account-income',
    title: 'Tài khoản THU NHẬP',
    description: 'Tạo một tài khoản ngân hàng riêng để nhận lương và mọi nguồn thu. Đây là "cổng vào" duy nhất của tiền bạn.',
    icon: '💰',
  },
  {
    id: 'account-spending',
    title: 'Tài khoản CHI TIÊU',
    description: 'Tạo tài khoản để chi trả hóa đơn cố định (điện, nước, internet) và chi tiêu hằng ngày (ăn uống, di chuyển). Chỉ dùng tiền trong tài khoản này để chi.',
    icon: '🛒',
  },
  {
    id: 'account-savings',
    title: 'Tài khoản TIẾT KIỆM',
    description: 'Tạo tài khoản cho 3 quỹ: Quỹ Dự Phòng (3-6 tháng lương), Quỹ Đầu Tư (sinh lời), và Quỹ Tự Do Tài Chính (nghỉ hưu sớm).',
    icon: '🏦',
  },
];

/* Congratulation messages — random khi hoàn thành step */
const CONGRATS_MESSAGES = [
  { title: 'Xuất sắc!', body: 'Bạn vừa đặt viên gạch đầu tiên trên hành trình làm chủ tài chính! 🎯' },
  { title: 'Tuyệt vời!', body: 'Mỗi bước nhỏ đều là bước tiến lớn. Bạn đang đi đúng đường! 🚀' },
  { title: 'Chiến binh tài chính!', body: 'Người giàu không kiếm nhiều hơn — họ quản lý giỏi hơn. Bạn đang làm điều đó! 💎' },
  { title: 'Đỉnh của chóp!', body: 'Bạn đã vượt qua 90% người Việt Nam vì họ không bao giờ làm bước này! 🏆' },
  { title: 'Phi thường!', body: 'Benjamin Franklin từng nói: "Đầu tư vào bản thân là khoản đầu tư sinh lời nhất." Bạn đang làm đúng! ✨' },
];

/* Gợi ý hành động tiếp theo */
const NEXT_ACTIONS: NextAction[] = [
  { text: 'Thiết lập chuyển tiền tự động hàng tháng', icon: '🔄' },
  { text: 'Đặt ngân sách cho từng danh mục chi tiêu', icon: '📊' },
  { text: 'Tạo mục tiêu tiết kiệm đầu tiên', icon: '🎯' },
  { text: 'Ghi chép chi tiêu hằng ngày trong 7 ngày', icon: '📝' },
];

export default function MissionChecklist() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCongrats, setShowCongrats] = useState<{ title: string; body: string } | null>(null);
  const [showNextActions, setShowNextActions] = useState(false);
  const { fireConfetti } = useConfetti();
  const { play } = useAudio();

  // Lift completion state → useMissionStore. Subscribe để re-render khi đổi.
  const completedMissionIds = useMissionStore((s) => s.completedMissionIds);
  const completeMission = useMissionStore((s) => s.completeMission);
  const uncompleteMission = useMissionStore((s) => s.uncompleteMission);

  // completedMissionIds chứa cả id ngoài MISSION_STEPS (future-proof) — chỉ count steps thuộc mission này.
  const completedCount = MISSION_STEPS.filter((s) => completedMissionIds.includes(s.id)).length;
  const allCompleted = completedCount === MISSION_STEPS.length;
  const progress = Math.round((completedCount / MISSION_STEPS.length) * 100);

  const handleToggleStep = useCallback((stepId: string) => {
    if (completedMissionIds.includes(stepId)) {
      // Bỏ tick — không hoàn XP (đã grant là giữ).
      uncompleteMission(stepId);
      setShowCongrats(null);
      setShowNextActions(false);
      return;
    }

    // Tick mới → grant XP idempotent qua store.
    const result = completeMission(stepId);
    // result.granted = false chỉ khi id đã có, ở đây không xảy ra (đã guard ở trên).

    // Pick random congrats message
    const msg = CONGRATS_MESSAGES[Math.floor(Math.random() * CONGRATS_MESSAGES.length)];
    setShowCongrats(msg);

    // Fire confetti! Compute "all done" sau khi store đã update.
    const newCompletedCount = completedCount + (result.granted ? 1 : 0);
    if (newCompletedCount === MISSION_STEPS.length) {
      // ALL DONE — big celebration!
      fireConfetti('rankUp');
      try { play('levelUp'); } catch {}
    } else {
      fireConfetti('mission');
      try { play('missionComplete'); } catch {}
    }

    // Show next actions after brief delay
    setTimeout(() => {
      setShowNextActions(true);
    }, 2000);

    // Auto-hide congrats after 4s
    setTimeout(() => {
      setShowCongrats(null);
    }, 4000);
  }, [completedMissionIds, completedCount, completeMission, uncompleteMission, fireConfetti, play]);

  return (
    <>
      {/* ═══ Trigger Card on Overview ═══ */}
      <motion.button
        className="mc-trigger-card"
        id="mission-checklist-trigger"
        onClick={() => setIsOpen(true)}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <div className="mc-trigger-icon-wrap">
          <Target size={20} className="mc-trigger-icon" />
          {!allCompleted && <span className="mc-trigger-badge">{MISSION_STEPS.length - completedCount}</span>}
          {allCompleted && <CheckCircle2 size={14} className="mc-trigger-check" />}
        </div>
        <div className="mc-trigger-content">
          <p className="mc-trigger-title">
            {allCompleted ? '✅ Đã hoàn thành gói nhiệm vụ!' : '🚀 Nhiệm vụ tối ưu tài chính'}
          </p>
          <p className="mc-trigger-desc">
            {allCompleted
              ? 'Tuyệt vời! Bạn đã sẵn sàng làm chủ tài chính.'
              : 'Tiền bạn sẽ được sử dụng tối ưu nếu bạn thực hiện gói nhiệm vụ này.'
            }
          </p>
          {/* Progress bar */}
          {!allCompleted && (
            <div className="mc-trigger-progress">
              <div className="mc-trigger-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <ChevronRight size={18} className="mc-trigger-arrow" />
      </motion.button>

      {/* ═══ Mission Modal ═══ */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop + Panel wrapper — Flexbox centering */}
            <motion.div
              className="mc-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            >
              {/* Panel — centered inside backdrop */}
              <motion.div
                className="mc-panel"
                initial={{ opacity: 0, y: 60, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close */}
                <button className="mc-close" onClick={() => setIsOpen(false)}>
                  <X size={18} />
                </button>

                {/* Header */}
                <div className="mc-header">
                  <div className="mc-header-icon"><Trophy size={28} /></div>
                  <h2 className="mc-header-title">Gói Nhiệm Vụ Tối Ưu Tài Chính</h2>
                  <p className="mc-header-desc">
                    Hãy phân chia tiền ra — đừng để một chỗ, bạn sẽ vô thức tiêu hết nó đấy! 💡
                  </p>
                </div>

                {/* Progress */}
                <div className="mc-progress-section">
                  <div className="mc-progress-bar">
                    <motion.div
                      className="mc-progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="mc-progress-text">{completedCount}/{MISSION_STEPS.length} hoàn thành</span>
                </div>

                {/* Mission 1: Tạo 3 tài khoản */}
                <div className="mc-mission-block">
                  <div className="mc-mission-title-row">
                    <Sparkles size={16} className="mc-sparkle" />
                    <h3 className="mc-mission-title">Nhiệm vụ 1: Tạo 3 tài khoản ngân hàng</h3>
                  </div>
                  <p className="mc-mission-subtitle">
                    Chia tiền vào các tài khoản riêng biệt để kiểm soát và bảo vệ tài sản
                  </p>

                  {/* Steps */}
                  <div className="mc-steps">
                    {MISSION_STEPS.map((step, i) => {
                      const isDone = completedMissionIds.includes(step.id);
                      return (
                        <motion.button
                          key={step.id}
                          className={`mc-step ${isDone ? 'mc-step--done' : ''}`}
                          onClick={() => handleToggleStep(step.id)}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.1 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={`mc-step-checkbox ${isDone ? 'mc-step-checkbox--done' : ''}`}>
                            {isDone && <CheckCircle2 size={18} />}
                            {!isDone && <span className="mc-step-number">{i + 1}</span>}
                          </div>
                          <div className="mc-step-content">
                            <div className="mc-step-header">
                              <span className="mc-step-icon">{step.icon}</span>
                              <span className={`mc-step-title ${isDone ? 'mc-step-title--done' : ''}`}>
                                {step.title}
                              </span>
                            </div>
                            <p className="mc-step-desc">{step.description}</p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Congrats Toast */}
                <AnimatePresence>
                  {showCongrats && (
                    <motion.div
                      className="mc-congrats"
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <span className="mc-congrats-emoji">🎉</span>
                      <div>
                        <p className="mc-congrats-title">{showCongrats.title}</p>
                        <p className="mc-congrats-body">{showCongrats.body}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Next Actions (after completing a step) */}
                <AnimatePresence>
                  {showNextActions && !allCompleted && (
                    <motion.div
                      className="mc-next-actions"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <p className="mc-next-title">💡 Hành động tiếp theo gợi ý:</p>
                      <div className="mc-next-list">
                        {NEXT_ACTIONS.slice(0, 2).map((action, i) => (
                          <div key={i} className="mc-next-item">
                            <span>{action.icon}</span>
                            <span>{action.text}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* All Done - Final celebration */}
                <AnimatePresence>
                  {allCompleted && (
                    <motion.div
                      className="mc-all-done"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, type: 'spring' }}
                    >
                      <span className="mc-all-done-emoji">🏆</span>
                      <h3 className="mc-all-done-title">Hoàn thành xuất sắc!</h3>
                      <p className="mc-all-done-desc">
                        Bạn đã sẵn sàng làm chủ dòng tiền. Tiếp tục thực hiện các hành động sau để tối ưu hơn nữa:
                      </p>
                      <div className="mc-next-list mc-next-list--final">
                        {NEXT_ACTIONS.map((action, i) => (
                          <div key={i} className="mc-next-item">
                            <span>{action.icon}</span>
                            <span>{action.text}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
