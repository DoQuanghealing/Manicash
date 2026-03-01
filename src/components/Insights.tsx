import React, { useEffect, useMemo, useState } from "react";

import {
  Transaction,
  User,
  IncomeProject,
  Category,
  TransactionType,
  FinancialReport,
  Budget,
  Wallet,
  FixedCost,
  Goal,
  CompletedPlan,
  GamificationState,
  Rank,
} from "../types";

import { AiService } from "../services/aiService";
import type { AiResult, Brain } from "../services/aiService";
import { StorageService } from "../services/storageService";
import { VI } from "../constants/vi";
import { formatVND, formatNumberInput, parseNumberInput } from "../utils/format";

import {
  Sparkles,
  Plus,
  Calendar,
  Trash2,
  ArrowRight,
  CheckSquare,
  Square,
  Coins,
  Trophy,
  Star,
  Diamond,
  Medal,
  History,
  Award,
  HelpCircle,
  Loader2,
  Gauge,
  TrendingUp,
  AlertCircle,
  Zap,
  ChevronRight,
  X,
} from "lucide-react";

import { useToast } from "./ToastProvider";
import { AiStatusPill } from "./AiStatusPill";

interface Props {
  transactions: Transaction[];
  users: User[];
}

const CELEBRATION_QUOTES = [
  "Đỉnh cao quá Cậu chủ ơi! Tiền về như lũ, túi đồ rủng rỉnh! 🚀💰🔥",
  "Thành quả xứng đáng cho sự nỗ lực không ngừng nghỉ! 💎🌟🏆",
  "Bùm! Mục tiêu đã bị chinh phục, ví tiền lại dày thêm! 🎇📈🥂",
  "Cậu chủ đúng là bậc thầy quản trị tài chính! 👑💵✨",
  "Lúa về đầy kho, ấm no cả tháng rồi thưa Người! 🌾🧧🤑",
  "Sức mạnh của kỷ luật đã mang lại trái ngọt hôm nay! 🦾🍫🎆",
  "Thêm một dự án thành công, đế chế ngày càng vững mạnh! 🏰🚩💎",
  "Số tiền này là minh chứng cho sự tài giỏi của Người! 🎖️💰🌈",
  "Không gì có thể ngăn cản bước chân chinh phục của Cậu chủ! 🌪️🔥🎯",
  "Tiền về đầy túi, nụ cười rạng rỡ, hôm nay thật tuyệt! 🧧😊🎉",
];

type Brain = "gemini" | "llama";
type AiMeta = {
  preferredBrain: Brain;
  brainUsed: Brain | null;
  fallback: boolean;
  error?: string;
  lastAction?: "CFO_REPORT" | "INCOME_PLAN" | null;
};

const BrainBadge: React.FC<{ meta: AiMeta }> = ({ meta }) => {
  const used = meta.brainUsed;
  const preferred = meta.preferredBrain;
  const isFallback = meta.fallback;

  const label = used
    ? `${used === "gemini" ? "GEMINI" : "LLAMA"}${isFallback ? " (FALLBACK)" : ""}`
    : "AI OFF";

  const sub = used
    ? isFallback
      ? `Ưu tiên: ${preferred.toUpperCase()}`
      : `Ưu tiên: ${preferred.toUpperCase()}`
    : `Ưu tiên: ${preferred.toUpperCase()}`;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
          used === "gemini"
            ? "bg-primary/10 text-primary border-primary/20"
            : used === "llama"
            ? "bg-secondary/10 text-secondary border-secondary/20"
            : "bg-foreground/5 text-foreground/30 border-foreground/10"
        }`}
        title={sub}
      >
        {label}
      </span>
      {meta.error && (
        <span className="text-[9px] font-black text-danger/70 uppercase tracking-widest">
          FAIL
        </span>
      )}
    </div>
  );
};

const ReportSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="glass-card bg-surface/50 p-7 rounded-[2.5rem] border-0 shadow-lg space-y-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-foreground/10 animate-pulse" />
            <div className="h-4 w-40 rounded bg-foreground/10 animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-foreground/10 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-foreground/10 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-foreground/10 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-foreground/10 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

  /* ================================      AI ENGINE STATE (Part 5/6/7)   ================================= */    const { showToast } = useToast();    // Brain user đã chọn trong Settings   const [aiPreferred, setAiPreferred] = useState<Brain>(     AiService.getPreferredBrain()   );    // Trạng thái runtime của AI   const [aiStatus, setAiStatus] = useState<{     brainUsed: Brain | null;     fallback: boolean;     fromCache: boolean;     error: string | null;     retryAfterMs: number;     lastFeature: "income_plan" | "cfo_report" | null;   }>({     brainUsed: null,     fallback: false,     fromCache: false,     error: null,     retryAfterMs: 0,     lastFeature: null,   });    // Countdown cho retryAfter (rate limit)   useEffect(() => {     if (!aiStatus.retryAfterMs || aiStatus.retryAfterMs <= 0) return;      const id = window.setInterval(() => {       setAiStatus((prev) => ({         ...prev,         retryAfterMs: Math.max(0, prev.retryAfterMs - 250),       }));     }, 250);      return () => window.clearInterval(id);   }, [aiStatus.retryAfterMs]);    // Update preferred brain nếu user đổi trong Settings   useEffect(() => {     setAiPreferred(AiService.getPreferredBrain());   }, [users]);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"planning" | "report">("planning");
  const [projects, setProjects] = useState<IncomeProject[]>([]);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [celebratingProject, setCelebratingProject] = useState<IncomeProject | null>(null);
  const [currentQuote, setCurrentQuote] = useState("");

  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingProject, setEditingProject] = useState<any>({ milestones: [] });

  const [completedHistory, setCompletedHistory] = useState<CompletedPlan[]>([]);
  const [gamification, setGamification] = useState<GamificationState>({
    points: 0,
    rank: Rank.IRON,
    lastUpdated: new Date().toISOString(),
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showRankUp, setShowRankUp] = useState<{ old: Rank; new: Rank } | null>(null);
  const [isXpAnimating, setIsXpAnimating] = useState(false);

  // ✅ AI META (brain thật sự dùng + fallback)
  const preferredBrain = useMemo(() => (StorageService.getAiBrain() as Brain) || "gemini", []);
  const [aiMeta, setAiMeta] = useState<AiMeta>({
    preferredBrain,
    brainUsed: null,
    fallback: false,
    error: undefined,
    lastAction: null,
  });

  useEffect(() => {
    loadProjects();
    setCompletedHistory(StorageService.getCompletedProjects());
    setGamification(StorageService.getGamificationState());
    // refresh preferred brain mỗi khi users đổi (vì settings có thể đổi)
    setAiMeta((prev) => ({
      ...prev,
      preferredBrain: (StorageService.getAiBrain() as Brain) || "gemini",
    }));
  }, [users]);

  const loadProjects = () => {
    setProjects(StorageService.getIncomeProjects());
  };

  const activeUser = users[0];

  // ✅ helper cập nhật ai meta + toast
  const commitAiMeta = (meta: Partial<AiMeta>) => {
    setAiMeta((prev) => ({ ...prev, ...meta }));
  };

  const toastFallback = (brainUsed: Brain, fallback: boolean) => {   if (!fallback) return;    showToast(     `AI đã fallback sang ${brainUsed.toUpperCase()}`,     "info"   ); };
    if (!fallback) return;
    toast({
      title: "AI đã tự động fallback",
      description: `Hệ thống đang dùng ${brainUsed.toUpperCase()} do AI ưu tiên bị lỗi/thiếu key.`,
      variant: "warning",
    });
  };

  const toastFail = (actionLabel: string) => {   showToast(     `AI không phản hồi khi tạo ${actionLabel}. Bạn có thể thử lại.`,     "error"   ); };
    toast({
      title: "AI không phản hồi",
      description: `Không tạo được ${actionLabel}. Bạn có thể bấm “Thử lại”.`,
      variant: "danger",
    });
  };

  // ✅ UPDATED: CFO report dùng AiResult
  const handleGenerateReport = async () => {
    setIsReportLoading(true);
    commitAiMeta({ error: undefined, lastAction: "CFO_REPORT" });

    try {
      const result = await AiService.generateComprehensiveReport(
        transactions,
        StorageService.getGoals(),
        projects,
        StorageService.getFixedCosts(),
        StorageService.getBudgets(),
        StorageService.getWallets(),
        gamification,
        (activeUser?.gender as any) || "MALE"
      );

      commitAiMeta({
        brainUsed: result.brainUsed,
        fallback: result.fallback,
        error: result.error,
      });

      if (result.data) {
        setReport(result.data);
        toastFallback((result.brainUsed || aiMeta.preferredBrain) as Brain, !!result.fallback);
      } else {
        setReport(null);
        toastFail("BÁO CÁO CFO");
      }
    } catch (e: any) {
      commitAiMeta({ brainUsed: null, fallback: true, error: e?.message || "Unknown error" });
      setReport(null);
      toastFail("BÁO CÁO CFO");
    } finally {
      setIsReportLoading(false);
    }
  };

  const toggleMilestone = (projectId: string, milestoneId: string) => {
    const ps = [...projects];
    const pIdx = ps.findIndex((p) => p.id === projectId);
    if (pIdx === -1 || ps[pIdx].status === "completed") return;

    const mIdx = ps[pIdx].milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx === -1) return;

    ps[pIdx].milestones[mIdx].isCompleted = !ps[pIdx].milestones[mIdx].isCompleted;
    ps[pIdx].status = calculateStatus(ps[pIdx]);

    if (ps[pIdx].milestones[mIdx].isCompleted) {
      setIsXpAnimating(true);
      setTimeout(() => setIsXpAnimating(false), 3000);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }

    if (ps[pIdx].milestones.length > 0 && ps[pIdx].milestones.every((m) => m.isCompleted)) {
      const randomQuote = CELEBRATION_QUOTES[Math.floor(Math.random() * CELEBRATION_QUOTES.length)];
      setCurrentQuote(randomQuote);
      setCelebratingProject(ps[pIdx]);
    } else {
      StorageService.updateIncomeProject(ps[pIdx]);
      loadProjects();
    }
  };

  const handleCollectIncome = async () => {
    if (!celebratingProject) return;

    const tx: Transaction = {
      id: `tx_inc_proj_${Date.now()}`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      amount: celebratingProject.expectedIncome,
      type: TransactionType.INCOME,
      category: Category.INCOME,
      walletId: "w1",
      description: `Thu nhập dự án: ${celebratingProject.name}`,
      timestamp: Date.now(),
    };
    StorageService.addTransaction(tx);

    // Calculate points
    const basePoints = Math.floor(celebratingProject.expectedIncome / 10000);
    const milestoneBonus = celebratingProject.milestones.length * 50;
    let totalPoints = basePoints + milestoneBonus;

    const today = new Date().toISOString().split("T")[0];
    if (celebratingProject.endDate && today <= celebratingProject.endDate) {
      totalPoints = Math.floor(totalPoints * 1.2);
    }

    // Save to history
    const completedPlan: CompletedPlan = {
      id: celebratingProject.id,
      name: celebratingProject.name,
      earnedAmount: celebratingProject.expectedIncome,
      completedAt: new Date().toISOString(),
      pointsAwarded: totalPoints,
    };
    await StorageService.addCompletedProject(completedPlan);

    // Update Gamification
    const newState = { ...gamification };
    const oldRank = newState.rank;
    newState.points += totalPoints;
    newState.lastUpdated = new Date().toISOString();

    // Rank logic
    const thresholds = {
      [Rank.IRON]: 0,
      [Rank.BRONZE]: 500,
      [Rank.SILVER]: 1500,
      [Rank.GOLD]: 4000,
      [Rank.PLATINUM]: 10000,
      [Rank.EMERALD]: 25000,
      [Rank.DIAMOND]: 60000,
    };

    let newRank = Rank.IRON;
    if (newState.points >= thresholds[Rank.DIAMOND]) newRank = Rank.DIAMOND;
    else if (newState.points >= thresholds[Rank.EMERALD]) newRank = Rank.EMERALD;
    else if (newState.points >= thresholds[Rank.PLATINUM]) newRank = Rank.PLATINUM;
    else if (newState.points >= thresholds[Rank.GOLD]) newRank = Rank.GOLD;
    else if (newState.points >= thresholds[Rank.SILVER]) newRank = Rank.SILVER;
    else if (newState.points >= thresholds[Rank.BRONZE]) newRank = Rank.BRONZE;

    if (newRank !== oldRank) {
      newState.rank = newRank;
      setShowRankUp({ old: oldRank, new: newRank });
    }

    await StorageService.updateGamificationState(newState);
    setGamification(newState);
    setCompletedHistory(StorageService.getCompletedProjects());

    const updatedProj = { ...celebratingProject, status: "completed" as const };
    StorageService.updateIncomeProject(updatedProj);

    setCelebratingProject(null);
    loadProjects();

    if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
  };

  const calculateStatus = (project: IncomeProject): IncomeProject["status"] => {
    const isAllCompleted = project.milestones.length > 0 && project.milestones.every((m) => m.isCompleted);
    if (isAllCompleted) return "completed";

    const today = new Date().toISOString().split("T")[0];
    if (project.endDate && project.endDate < today) return "overdue";
    if (project.startDate && project.startDate > today) return "upcoming";
    return "in_progress";
  };

  const handleOpenCreate = () => {
    const today = new Date().toISOString().split("T")[0];
    setEditingProject({
      id: "",
      userId: activeUser.id,
      name: "",
      description: "",
      expectedIncome: "",
      startDate: today,
      endDate: today,
      status: "planning",
      milestones: [],
    });
    setIsEditOpen(true);
  };

  const handleOpenEdit = (project: IncomeProject) => {
    setEditingProject({
      ...project,
      expectedIncome: formatNumberInput(project.expectedIncome),
    });
    setIsEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa kế hoạch này?")) {
      StorageService.deleteIncomeProject(id);
      loadProjects();
      setIsEditOpen(false);
    }
  };

  const handleSaveProject = () => {
    if (!editingProject.name?.trim()) return;
    const projectData: IncomeProject = {
      id: editingProject.id || `p_${Date.now()}`,
      userId: editingProject.userId || activeUser.id,
      name: editingProject.name.trim(),
      description: editingProject.description || "",
      expectedIncome: parseNumberInput(editingProject.expectedIncome),
      startDate: editingProject.startDate,
      endDate: editingProject.endDate,
      status: "planning",
      milestones: editingProject.milestones || [],
    };
    projectData.status = calculateStatus(projectData);

    if (editingProject.id) StorageService.updateIncomeProject(projectData);
    else StorageService.addIncomeProject(projectData);

    loadProjects();
    setIsEditOpen(false);
  };

  // ✅ UPDATED: income plan dùng AiResult
  const handleGeneratePlan = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    commitAiMeta({ error: undefined, lastAction: "INCOME_PLAN" });

    try {
      const result = await AiService.generateIncomePlan(aiPrompt);

      commitAiMeta({
        brainUsed: result.brainUsed,
        fallback: result.fallback,
        error: result.error,
      });

      if (result.data) {
        // ✅ fallback toast
        toastFallback((result.brainUsed || aiMeta.preferredBrain) as Brain, !!result.fallback);

        setIsAiModalOpen(false);
        const today = new Date().toISOString().split("T")[0];

        const plan = result.data;
        const newProj: any = {
          id: "",
          userId: activeUser.id,
          name: plan.name,
          description: plan.description,
          expectedIncome: formatNumberInput(plan.expectedIncome),
          startDate: today,
          endDate: today,
          status: "planning",
          milestones: (plan.milestones || []).map((m: any, idx: number) => ({
            id: `m_ai_${idx}_${Date.now()}`,
            title: m.title,
            startDate: today,
            date: today,
            isCompleted: false,
          })),
        };

        setEditingProject(newProj);
        setIsEditOpen(true);
      } else {
        toastFail("KẾ HOẠCH THU NHẬP");
      }
    } catch (e: any) {
      commitAiMeta({ brainUsed: null, fallback: true, error: e?.message || "Unknown error" });
      toastFail("KẾ HOẠCH THU NHẬP");
    } finally {
      setIsGenerating(false);
    }
  };

  const renderPlanningTab = () => {
    const RANK_THRESHOLDS: Record<Rank, number> = {
      [Rank.IRON]: 0,
      [Rank.BRONZE]: 500,
      [Rank.SILVER]: 1500,
      [Rank.GOLD]: 4000,
      [Rank.PLATINUM]: 10000,
      [Rank.EMERALD]: 25000,
      [Rank.DIAMOND]: 60000,
    };

    const NEXT_RANK_MAP: Record<Rank, Rank | null> = {
      [Rank.IRON]: Rank.BRONZE,
      [Rank.BRONZE]: Rank.SILVER,
      [Rank.SILVER]: Rank.GOLD,
      [Rank.GOLD]: Rank.PLATINUM,
      [Rank.PLATINUM]: Rank.EMERALD,
      [Rank.EMERALD]: Rank.DIAMOND,
      [Rank.DIAMOND]: null,
    };

    const currentXP = gamification.points;
    const minXP = RANK_THRESHOLDS[gamification.rank];
    const nextRank = NEXT_RANK_MAP[gamification.rank];
    const maxXP = nextRank ? RANK_THRESHOLDS[nextRank] : currentXP;
    const progressPercent = nextRank
      ? Math.min(100, Math.max(0, ((currentXP - minXP) / (maxXP - minXP)) * 100))
      : 100;

    return (
      <div className="space-y-4">
        {/* Rank Display */}
        <div className="glass-card bg-gradient-to-r from-primary/10 via-surface/40 to-secondary/10 p-6 rounded-[2.5rem] border-0 shadow-xl group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

          <div className="flex items-center justify-between relative z-10 mb-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transform group-hover:rotate-12 transition-transform duration-500 bg-surface`}
              >
                {gamification.rank === Rank.IRON && <Medal size={32} className="text-slate-400" />}
                {gamification.rank === Rank.BRONZE && <Medal size={32} className="text-orange-600" />}
                {gamification.rank === Rank.SILVER && <Medal size={32} className="text-slate-300" />}
                {gamification.rank === Rank.GOLD && <Medal size={32} className="text-gold" />}
                {gamification.rank === Rank.PLATINUM && <Award size={32} className="text-cyan-400" />}
                {gamification.rank === Rank.EMERALD && <Award size={32} className="text-emerald-400" />}
                {gamification.rank === Rank.DIAMOND && <Diamond size={32} className="text-blue-400 animate-pulse" />}
              </div>
              <div>
                <h4 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em]">Hạng hiện tại</h4>
                <p className="text-xl font-[1000] text-foreground uppercase tracking-tight leading-none mb-1">{gamification.rank}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{gamification.points} XP</p>
                  <button onClick={() => setIsHelpOpen(true)} className="text-foreground/20 hover:text-primary transition-colors">
                    <HelpCircle size={12} />
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-4 bg-surface/80 rounded-2xl text-foreground/40 hover:text-primary transition-all active:scale-90 shadow-lg"
            >
              <History size={20} />
            </button>
          </div>

          {/* XP Progress Bar */}
          <div className="relative z-10 space-y-3">
            <div className="flex justify-between items-end text-[9px] font-black uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full border-2 border-primary/30 flex items-center justify-center relative ${isXpAnimating ? "animate-xp-purple" : ""}`}>
                  <Zap size={10} className={`text-primary ${isXpAnimating ? "xp-glow-vibrant" : ""}`} fill={isXpAnimating ? "currentColor" : "none"} />
                </div>
                <span className="text-foreground/30">Tiến trình thăng hạng</span>
              </div>
              <span className="text-primary">{nextRank ? `${Math.floor(progressPercent)}%` : "MAX LEVEL"}</span>
            </div>

            <div className="h-3 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner relative border border-foreground/5">
              <div
                className={`h-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary via-purple-500 to-secondary shadow-[0_0_15px_rgba(139,92,246,0.4)] ${isXpAnimating ? "brightness-125" : ""}`}
                style={{ width: `${progressPercent}%` }}
              >
                {isXpAnimating && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>}
              </div>
            </div>

            {nextRank && (
              <p className="text-[8px] font-bold text-foreground/20 uppercase tracking-widest text-right">
                Cần thêm {maxXP - currentXP} XP để lên {nextRank}
              </p>
            )}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="glass-card liquid-glass rounded-[3rem] p-16 text-center border-0 shadow-xl">
            <Calendar size={48} className="mx-auto mb-6 text-warning" />
            <p className="text-foreground/30 font-black text-xs uppercase tracking-[0.2em]">{VI.insights.noProjects}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => {
              const completedCount = project.milestones.filter((m) => m.isCompleted).length;
              const totalCount = project.milestones.length;
              const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const currentStatus = calculateStatus(project);

              if (currentStatus === "completed") {
                const basePoints = Math.floor(project.expectedIncome / 10000);
                const milestoneBonus = project.milestones.length * 50;
                let totalPoints = basePoints + milestoneBonus;
                const today = new Date().toISOString().split("T")[0];
                const isEarly = project.endDate && today <= project.endDate;
                if (isEarly) totalPoints = Math.floor(totalPoints * 1.2);

                return (
                  <div
                    key={project.id}
                    className="glass-card bg-secondary/5 border-2 border-secondary/20 rounded-[2rem] p-5 relative overflow-hidden animate-in fade-in slide-in-from-right duration-500"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-[1000] text-foreground uppercase tracking-tight truncate mb-1">{project.name}</h3>
                        <div className="flex items-center gap-3">
                          <p className="text-secondary text-[12px] font-black tracking-tighter flex items-center gap-1">
                            <Coins size={12} /> {formatVND(project.expectedIncome)}
                          </p>
                          <span className="text-foreground/20 text-[10px]">•</span>
                          <p className="text-foreground/40 text-[9px] font-bold uppercase tracking-tight">Xong: {project.endDate}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1.5">
                        <div className="bg-secondary text-white text-[7px] px-3 py-1 rounded-full font-black uppercase tracking-[0.2em] inline-block">ĐÃ HOÀN THÀNH</div>
                        <div className="flex items-center gap-1 text-primary justify-end">
                          <Zap size={14} fill="currentColor" />
                          <span className="text-lg font-black tracking-tighter">+{totalPoints}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleOpenEdit(project)} className="absolute inset-0 w-full h-full opacity-0 z-10" />
                  </div>
                );
              }

              return (
                <div
                  key={project.id}
                  className="glass-card liquid-glass rounded-[2.5rem] p-7 border-0 relative group shadow-2xl bg-gradient-to-br from-surface/80 to-background overflow-hidden animate-in fade-in duration-500"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1 flex-1">
                      <h3
                        className="text-xl font-[1000] text-foreground uppercase tracking-tighter leading-tight cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                        onClick={() => handleOpenEdit(project)}
                      >
                        {project.name}
                      </h3>
                      <p className="text-secondary text-lg font-[1000] tracking-tighter flex items-center gap-1.5">
                        <Diamond size={16} className="text-primary animate-pulse" />
                        {formatVND(project.expectedIncome)}
                      </p>
                    </div>
                    <div
                      className={`text-[8px] px-3 py-1 rounded-full uppercase font-black tracking-[0.15em] shadow-md shrink-0 ${
                        currentStatus === "overdue" ? "bg-danger text-white" : "bg-primary text-white"
                      }`}
                    >
                      {VI.insights.project.status[currentStatus]}
                    </div>
                  </div>

                  <div className="space-y-5 mb-6">
                    <div className="flex justify-between items-end text-[9px] font-black text-foreground/30 uppercase tracking-[0.02em] px-1">
                      <span>Tiến độ thực hiện</span>
                      <span className="text-secondary font-black">
                        {progress}% ({completedCount}/{totalCount})
                      </span>
                    </div>

                    <div className="h-2 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner relative">
                      <div
                        className={`h-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary via-purple-500 to-secondary shadow-[0_0_12px_rgba(139,92,246,0.3)]`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>

                    {project.milestones.length > 0 && (
                      <div className="space-y-4 mt-6">
                        {project.milestones.map((m) => (
                          <div
                            key={m.id}
                            className={`flex items-start gap-4 group/item cursor-pointer transition-all duration-300 p-2 rounded-2xl ${
                              m.isCompleted
                                ? "bg-secondary/5 shadow-[0_0_15px_rgba(16,185,129,0.15)] opacity-50"
                                : "hover:bg-foreground/5"
                            }`}
                            onClick={() => toggleMilestone(project.id, m.id)}
                          >
                            {m.isCompleted ? (
                              <CheckSquare size={18} className="text-secondary shrink-0 mt-0.5" />
                            ) : (
                              <Square size={18} className="text-foreground/20 shrink-0 mt-0.5 group-hover/item:text-primary transition-colors" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-[11px] font-black uppercase truncate leading-[1.5] tracking-[0.02em] ${
                                  m.isCompleted ? "text-foreground/40 line-through" : "text-foreground/80"
                                }`}
                              >
                                {m.title}
                              </p>
                              <p className="text-[7px] font-bold text-foreground/10 mt-1 uppercase tracking-widest">
                                {m.startDate} → {m.date}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-foreground/5">
                    <span className="text-[8px] font-black text-foreground/20 uppercase tracking-widest italic">
                      {project.startDate} đến {project.endDate}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(project)}
                      className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center bg-primary/5 px-4 py-2 rounded-xl active:scale-95 transition-all"
                    >
                      CHI TIÊU <ChevronRight size={14} className="ml-1" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleOpenCreate}
          className="w-full py-10 glass-card bg-surface/10 backdrop-blur-[60px] rounded-[3.5rem] border-2 border-dashed border-primary/30 text-primary font-black text-[11px] uppercase tracking-[0.3em] hover:bg-primary/5 hover:border-primary/50 transition-all shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50"></div>
          <span className="relative z-10 flex items-center justify-center gap-3">
            <Plus size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
            BẮT ĐẦU CƠ HỘI MỚI
          </span>
        </button>
      </div>
    );
  };

  const renderReportTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="glass-card bg-gradient-to-br from-primary/10 via-surface to-background rounded-[2.5rem] p-8 text-center space-y-6 shadow-xl border-0 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em]">Phân tích tài chính tổng thể</h3>
            {/* ✅ AI STATUS BADGE */}
            <BrainBadge meta={aiMeta} />
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isReportLoading}
            className="mx-auto w-24 h-24 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl neon-glow-primary active:scale-95 transition-all border-4 border-white/10 disabled:opacity-50"
            title="Tạo báo cáo CFO"
          >
            {isReportLoading ? <Loader2 size={40} className="animate-spin" /> : <Gauge size={44} />}
          </button>

          <div className="space-y-1">
            <p className="text-2xl font-[1000] text-foreground uppercase tracking-tight">
              {isReportLoading ? "Đang xử lý dữ liệu..." : report ? `Điểm: ${report.healthScore}/100` : "Sẵn sàng phân tích"}
            </p>

            {/* ✅ error + retry */}
            {!isReportLoading && aiMeta.error && (
              <div className="pt-3 space-y-3">
                <p className="text-[10px] font-black text-danger/70 uppercase tracking-widest">
                  AI lỗi: {aiMeta.error}
                </p>
                <button
                  onClick={handleGenerateReport}
                  className="mx-auto bg-foreground text-background px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Thử lại
                </button>
              </div>
            )}

            {report && !isReportLoading && (
              <p className="text-[11px] font-medium text-foreground/50 uppercase tracking-widest leading-relaxed px-4">
                {report.healthAnalysis}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ✅ skeleton mượt */}
      {isReportLoading && <ReportSkeleton />}

      {report && !isReportLoading && (
        <div className="space-y-6">
          <div className="glass-card bg-surface/50 p-7 rounded-[2.5rem] border-0 shadow-lg space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Hiệu suất thu nhập</h4>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-[13px] font-bold">
                <span className="text-foreground/40 uppercase tracking-tight">Nguồn tốt nhất:</span>
                <span className="text-secondary uppercase tracking-tight">{report.incomeEfficiency.bestSource}</span>
              </div>
              <p className="text-[11px] font-medium text-foreground/60 leading-relaxed uppercase tracking-tight">{report.incomeEfficiency.analysis}</p>
              <div className="p-3 bg-secondary/5 rounded-xl border border-secondary/10">
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Dự báo CFO:</p>
                <p className="text-[11px] font-bold text-foreground/80 uppercase leading-none">{report.incomeEfficiency.forecast}</p>
              </div>
            </div>
          </div>

          <div className="glass-card bg-surface/50 p-7 rounded-[2.5rem] border-0 shadow-lg space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-danger/10 text-danger rounded-xl flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Kỷ luật ngân sách</h4>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-medium text-foreground/60 leading-relaxed uppercase tracking-tight">
                {report.budgetDiscipline.varianceAnalysis}
              </p>

              {report.budgetDiscipline.trashSpending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-danger uppercase tracking-widest">Chi tiêu cần cắt giảm:</p>
                  <div className="flex flex-wrap gap-2">
                    {report.budgetDiscipline.trashSpending.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-danger/10 text-danger rounded-lg text-[9px] font-black uppercase tracking-tight border border-danger/10"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card bg-surface/50 p-7 rounded-[2.5rem] border-0 shadow-lg space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-warning/10 text-warning rounded-xl flex items-center justify-center">
                <Trophy size={20} />
              </div>
              <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Đánh giá thăng hạng</h4>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-warning/5 rounded-2xl border border-warning/10 space-y-3">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-warning uppercase tracking-widest">Tốc độ thăng hạng:</p>
                  <p className="text-[11px] font-bold text-foreground/80 uppercase leading-tight">{report.gamificationInsights?.rankVelocity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-warning uppercase tracking-widest">Thu nhập vs Mục tiêu:</p>
                  <p className="text-[11px] font-bold text-foreground/80 uppercase leading-tight">{report.gamificationInsights?.incomeVsGoals}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-warning uppercase tracking-widest">Kỹ năng thực thi:</p>
                  <p className="text-[11px] font-bold text-foreground/80 uppercase leading-tight">{report.gamificationInsights?.domainExpertise}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card bg-surface/50 p-7 rounded-[2.5rem] border-0 shadow-lg space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <Zap size={20} />
              </div>
              <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Tốc độ giàu có</h4>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                {report.wealthVelocity.goalForecasts.map((gf, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-foreground/40 uppercase tracking-tight">{gf.name}</span>
                    <span className="text-primary uppercase tracking-tight">Dự kiến: {gf.estimatedDate}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-[11px] font-medium text-foreground/70 leading-relaxed italic uppercase tracking-tight">"{report.cfoAdvice}"</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 pt-12 space-y-6 pb-32 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-[900] text-foreground tracking-tighter uppercase flex items-center gap-4">
            <Sparkles className="text-primary animate-pulse" size={32} />
            THU NHẬP
          </h2>
          {/* ✅ status nhỏ ở header luôn */}
          <BrainBadge meta={aiMeta} />
        </div>

        {activeTab === "planning" && (
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl neon-glow-primary active:scale-90 transition-all"
            title="AI gợi ý nhiệm vụ"
          >
            <Sparkles size={24} />
          </button>
        )}
      </div>

      <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
        <div className="flex relative">
          <button
            onClick={() => setActiveTab("planning")}
            className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined ${
              activeTab === "planning" ? "bg-primary text-white shadow-xl neon-glow-primary" : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            LẬP KẾ HOẠCH
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined ${
              activeTab === "report" ? "bg-primary text-white shadow-xl neon-glow-primary" : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            BÁO CÁO CFO
          </button>
        </div>
      </div>

      {activeTab === "planning" ? renderPlanningTab() : renderReportTab()}

      {/* ========= RANK HELP MODAL (giữ nguyên) ========= */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-6 pb-[100px] overflow-hidden">
          <div className="glass-card w-full max-w-[380px] rounded-[2.5rem] border-0 shadow-2xl bg-surface overflow-hidden animate-in zoom-in-95 duration-500 relative flex flex-col max-h-[80vh]">
            <div className="p-4 px-6 flex justify-between items-center shrink-0 border-b border-foreground/5">
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] whitespace-nowrap">
                HƯỚNG DẪN THĂNG HẠNG
              </h3>
              <button onClick={() => setIsHelpOpen(false)} className="p-2 bg-foreground/5 rounded-xl text-foreground/40 hover:text-primary transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">1. CÁC CẤP BẬC DANH VỌNG</h4>
                <div className="space-y-2">
                  {[
                    { rank: Rank.IRON, xp: "0 XP", color: "text-slate-400" },
                    { rank: Rank.BRONZE, xp: "500 XP", color: "text-orange-600" },
                    { rank: Rank.SILVER, xp: "1,500 XP", color: "text-slate-300" },
                    { rank: Rank.GOLD, xp: "4,000 XP", color: "text-gold" },
                    { rank: Rank.PLATINUM, xp: "10,000 XP", color: "text-cyan-400" },
                    { rank: Rank.EMERALD, xp: "25,000 XP", color: "text-emerald-400" },
                    { rank: Rank.DIAMOND, xp: "60,000 XP", color: "text-blue-400" },
                  ].map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-foreground/[0.03] rounded-2xl border border-foreground/5">
                      <span className={`text-[12px] font-black uppercase tracking-tight ${r.color}`}>{r.rank}</span>
                      <span className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">{r.xp}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">2. CÁCH KIẾM ĐIỂM KINH NGHIỆM (XP)</h4>
                <div className="space-y-3">
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center shrink-0">
                      <Coins size={16} />
                    </div>
                    <p className="text-[11px] font-bold text-foreground/60 leading-relaxed uppercase tracking-tight">
                      Mỗi <span className="text-secondary">1.000.000 VND</span> thu nhập hoàn thành tương đương{" "}
                      <span className="text-secondary">100 XP</span>.
                    </p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                      <Zap size={16} />
                    </div>
                    <p className="text-[11px] font-bold text-foreground/60 leading-relaxed uppercase tracking-tight">
                      Hoàn thành dự án <span className="text-primary">SỚM HƠN</span> thời hạn sẽ được thưởng thêm{" "}
                      <span className="text-primary">20% TỔNG XP</span>.
                    </p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 bg-warning/10 text-warning rounded-lg flex items-center justify-center shrink-0">
                      <Trophy size={16} />
                    </div>
                    <p className="text-[11px] font-bold text-foreground/60 leading-relaxed uppercase tracking-tight">
                      Mỗi <span className="text-warning">ĐẦU VIỆC (MILESTONE)</span> trong dự án mang lại{" "}
                      <span className="text-warning">50 XP</span> khi hoàn thành dự án.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="w-full bg-foreground text-background font-black py-5 rounded-[2rem] text-[11px] uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all"
                >
                  ĐÃ HIỂU THƯA QUẢN GIA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========= COMPLETED HISTORY MODAL (giữ nguyên) ========= */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4 overflow-hidden">
          <div className="glass-card w-full max-w-[420px] h-[80vh] flex flex-col rounded-[3.5rem] border-0 shadow-2xl bg-surface overflow-hidden animate-in zoom-in-95 duration-500 relative">
            <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-foreground/5 bg-surface/80 backdrop-blur-md z-10">
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight uppercase leading-none">LỊCH SỬ VINH QUANG</h3>
                <p className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                  <span className="text-primary">•</span> Lưu trữ trong 30 ngày
                </p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="p-3 bg-foreground/5 rounded-2xl hover:bg-foreground/10 text-foreground transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
              {completedHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20 py-20">
                  <History size={48} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Chưa có chiến tích nào</p>
                </div>
              ) : (
                completedHistory
                  .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                  .map((cp) => (
                    <div
                      key={cp.id}
                      className="glass-card bg-foreground/[0.03] p-6 rounded-[2.25rem] border-0 flex items-center justify-between group hover:bg-foreground/[0.06] transition-all"
                    >
                      <div className="space-y-1">
                        <p className="text-[13px] font-[1000] text-foreground uppercase tracking-tight">{cp.name}</p>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">+{formatVND(cp.earnedAmount)}</p>
                        <p className="text-[8px] font-medium text-foreground/30 uppercase tracking-widest">{new Date(cp.completedAt).toLocaleDateString("vi-VN")}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-primary">
                          <Zap size={14} fill="currentColor" />
                          <span className="text-lg font-black tracking-tighter">+{cp.pointsAwarded}</span>
                        </div>
                        <p className="text-[8px] font-black text-foreground/20 uppercase tracking-widest">EXP</p>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="p-8 bg-surface/90 backdrop-blur-md border-t border-foreground/5">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="w-full bg-primary text-white font-[1000] py-5 rounded-[2rem] text-[11px] uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all"
              >
                ĐÓNG DANH SÁCH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= RANK UP MODAL (giữ nguyên) ========= */}
      {showRankUp && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 animate-in fade-in duration-700">
          <div className="glass-card w-full max-w-[400px] rounded-[4rem] p-12 text-center border-0 shadow-2xl bg-gradient-to-br from-primary/20 via-surface to-background relative overflow-hidden animate-in zoom-in-95 duration-700">
            <div className="absolute inset-0 opacity-5"></div>
            <div className="space-y-10 relative z-10">
              <div className="relative h-48 flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-[60px] animate-pulse"></div>
                <div className="w-32 h-32 bg-surface rounded-[2.5rem] flex items-center justify-center shadow-2xl neon-glow-primary animate-bounce relative z-20">
                  {showRankUp.new === Rank.BRONZE && <Medal size={64} className="text-orange-600" />}
                  {showRankUp.new === Rank.SILVER && <Medal size={64} className="text-slate-300" />}
                  {showRankUp.new === Rank.GOLD && <Medal size={64} className="text-gold" />}
                  {showRankUp.new === Rank.PLATINUM && <Award size={64} className="text-cyan-400" />}
                  {showRankUp.new === Rank.EMERALD && <Award size={64} className="text-emerald-400" />}
                  {showRankUp.new === Rank.DIAMOND && <Diamond size={64} className="text-blue-400 animate-pulse" />}
                </div>
              </div>

              <div className="space-y-4">
                <div className="inline-block px-6 py-2 rounded-full bg-primary/10 border border-primary/20 mb-2">
                  <h3 className="text-[12px] font-black text-primary uppercase tracking-[0.6em] animate-pulse">THĂNG HẠNG!</h3>
                </div>
                <h4 className="text-4xl font-[1000] text-foreground tracking-tighter uppercase leading-tight drop-shadow-xl">{showRankUp.new}</h4>
                <p className="text-foreground/40 text-[11px] font-bold uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed">
                  Người đã vượt qua giới hạn của bản thân. Đế chế tài chính đang lớn mạnh!
                </p>
              </div>

              <div className="flex items-center justify-center gap-6 py-4">
                <div className="text-center opacity-40">
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1">Từ</p>
                  <p className="text-sm font-black uppercase">{showRankUp.old}</p>
                </div>
                <ArrowRight className="text-primary" size={24} />
                <div className="text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1 text-primary">Đến</p>
                  <p className="text-lg font-black uppercase text-primary">{showRankUp.new}</p>
                </div>
              </div>

              <button
                onClick={() => setShowRankUp(null)}
                className="w-full bg-primary text-white font-[1000] py-6 rounded-[2.25rem] text-[12px] uppercase tracking-[0.4em] shadow-[0_25px_50px_rgba(139,92,246,0.5)] neon-glow-primary active:scale-95 transition-all border border-white/20"
              >
                TIẾP TỤC CHINH PHỤC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= CELEBRATION MODAL (giữ nguyên) ========= */}
      {celebratingProject && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-6">
          <div className="glass-card w-full max-w-[360px] rounded-[3.5rem] p-10 text-center border-0 shadow-2xl bg-surface animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-secondary shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
            <div className="space-y-8">
              <div className="w-24 h-24 bg-secondary text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl neon-glow-secondary animate-bounce">
                <Trophy size={48} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-black text-foreground tracking-tight uppercase leading-tight">CHÚC MỪNG!</h3>
                <p className="font-comic text-lg text-foreground font-bold leading-relaxed italic opacity-90">"{currentQuote}"</p>
              </div>
              <div className="glass-card bg-foreground/[0.04] p-6 rounded-[2rem] border-0">
                <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1">TIỀN VỀ VÍ CHÍNH</p>
                <p className="text-3xl font-black text-secondary tracking-tighter">{formatVND(celebratingProject.expectedIncome)}</p>
              </div>
              <button
                onClick={handleCollectIncome}
                className="w-full bg-secondary text-white font-black py-6 rounded-[2rem] text-[12px] uppercase tracking-[0.4em] shadow-xl neon-glow-secondary active:scale-95 transition-all"
              >
                THU TIỀN NGAY <ArrowRight size={20} className="ml-2 inline" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= AI MODAL (đã thêm retry + status) ========= */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-6">
          <div className="glass-card w-full max-w-sm rounded-[3rem] p-10 border-0 shadow-2xl bg-surface animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-foreground uppercase tracking-tight">AI SUGGESTION</h3>
                <div className="flex items-center gap-2">
                  <BrainBadge meta={aiMeta} />
                  {aiMeta.lastAction === "INCOME_PLAN" && aiMeta.error && (
                    <button
                      onClick={handleGeneratePlan}
                      className="px-3 py-1 rounded-full bg-foreground text-background text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                    >
                      Thử lại
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="p-2 bg-foreground/5 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-foreground/30 uppercase tracking-widest ml-2">
                  Bạn định kiếm tiền từ việc gì?
                </label>
                <textarea
                  className="w-full bg-foreground/5 text-foreground p-5 rounded-2xl font-bold focus:ring-2 focus:ring-primary border-0 shadow-inner h-32 resize-none"
                  placeholder="VD: Dạy tiếng Anh online, Bán đồ cũ..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
              </div>

              {aiMeta.lastAction === "INCOME_PLAN" && aiMeta.error && (
                <div className="p-4 rounded-2xl bg-danger/10 border border-danger/20">
                  <p className="text-[10px] font-black text-danger uppercase tracking-widest mb-1">AI lỗi</p>
                  <p className="text-[11px] font-bold text-foreground/70 leading-relaxed">{aiMeta.error}</p>
                </div>
              )}

              <button
                onClick={handleGeneratePlan}
                disabled={isGenerating || !aiPrompt.trim()}
                className="w-full bg-primary text-white font-black py-5 rounded-[1.75rem] shadow-xl neon-glow-primary active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> LẬP KẾ HOẠCH AI</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= EDIT MODAL (giữ nguyên đúng phần bạn gửi) ========= */}
      {isEditOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4 sm:p-6 overflow-hidden">
          <div className="glass-card w-full max-w-md h-[92vh] flex flex-col rounded-[3.5rem] shadow-2xl border-0 bg-surface overflow-hidden relative animate-in zoom-in-95">
            <div className="flex justify-between items-center p-8 pb-4 shrink-0 bg-surface/80 backdrop-blur-md z-10 border-b border-foreground/5">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-refined leading-relaxed">CHI TIÊU DỰ ÁN</h2>
              <button onClick={() => setIsEditOpen(false)} className="p-3 bg-foreground/5 rounded-2xl text-foreground hover:text-primary transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-[180px] space-y-6 no-scrollbar pt-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-foreground/30 ml-2 tracking-refined uppercase">Tên dự án</label>
                <input
                  className="w-full bg-foreground/5 text-foreground p-5 rounded-[1.5rem] font-bold focus:ring-2 focus:ring-primary text-xs uppercase border-0 shadow-inner"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject((prev: any) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-foreground/30 ml-2 tracking-refined uppercase">Doanh thu kỳ vọng (VND)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full bg-foreground/5 text-secondary text-2xl font-bold p-5 rounded-[1.5rem] focus:outline-none border-0 shadow-inner"
                  value={editingProject.expectedIncome}
                  onChange={(e) => setEditingProject((prev: any) => ({ ...prev, expectedIncome: formatNumberInput(e.target.value) }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 ml-2">
                    <Calendar size={12} className="text-warning" />
                    <label className="text-[9px] font-bold text-foreground/30 tracking-refined uppercase">Bắt đầu</label>
                  </div>
                  <input
                    type="date"
                    className="w-full bg-foreground/5 text-foreground p-4 rounded-xl font-bold focus:outline-none text-xs border-0"
                    value={editingProject.startDate}
                    onChange={(e) => setEditingProject((prev: any) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 ml-2">
                    <Calendar size={12} className="text-warning" />
                    <label className="text-[9px] font-bold text-foreground/30 tracking-refined uppercase">Hoàn thành</label>
                  </div>
                  <input
                    type="date"
                    className="w-full bg-foreground/5 text-foreground p-4 rounded-xl font-bold focus:outline-none text-xs border-0"
                    value={editingProject.endDate}
                    onChange={(e) => setEditingProject((prev: any) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-foreground/5">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-bold text-foreground/40 uppercase tracking-refined">CÁC BƯỚC THỰC HIỆN</h4>
                  <button
                    onClick={() =>
                      setEditingProject((prev: any) => ({
                        ...prev,
                        milestones: [
                          ...(prev.milestones || []),
                          { id: `m_${Date.now()}`, title: "", startDate: new Date().toISOString().split("T")[0], date: new Date().toISOString().split("T")[0], isCompleted: false },
                        ],
                      }))
                    }
                    className="text-primary text-[8px] font-bold uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-xl"
                  >
                    + THÊM BƯỚC
                  </button>
                </div>

                <div className="space-y-4">
                  {editingProject.milestones?.map((m: any, idx: number) => (
                    <div key={m.id} className="glass-card bg-foreground/[0.03] p-5 rounded-[2rem] border-0 space-y-3 relative">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={m.isCompleted}
                          onChange={(e) => {
                            const ms = [...editingProject.milestones];
                            ms[idx].isCompleted = e.target.checked;
                            setEditingProject({ ...editingProject, milestones: ms });
                          }}
                          className="w-5 h-5 rounded-lg border-2 border-primary/30 checked:bg-primary"
                        />
                        <input
                          className="flex-1 bg-transparent border-0 focus:outline-none text-xs font-bold uppercase placeholder:opacity-20 leading-relaxed-tight tracking-refined"
                          placeholder="Tên công việc..."
                          value={m.title}
                          onChange={(e) => {
                            const ms = [...editingProject.milestones];
                            ms[idx].title = e.target.value;
                            setEditingProject({ ...editingProject, milestones: ms });
                          }}
                        />
                        <button
                          onClick={() => {
                            const ms = [...editingProject.milestones];
                            ms.splice(idx, 1);
                            setEditingProject({ ...editingProject, milestones: ms });
                          }}
                          className="text-danger/40 hover:text-danger p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-foreground/5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 ml-1">
                            <Calendar size={10} className="text-warning" />
                            <p className="text-[7px] font-bold text-foreground/20 uppercase tracking-refined">Bắt đầu</p>
                          </div>
                          <input
                            type="date"
                            className="w-full bg-foreground/5 p-2 rounded-lg text-[9px] font-bold border-0 focus:outline-none"
                            value={m.startDate}
                            onChange={(e) => {
                              const ms = [...editingProject.milestones];
                              ms[idx].startDate = e.target.value;
                              setEditingProject({ ...editingProject, milestones: ms });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 ml-1">
                            <Calendar size={10} className="text-warning" />
                            <p className="text-[7px] font-bold text-foreground/20 uppercase tracking-refined">Hoàn thành</p>
                          </div>
                          <input
                            type="date"
                            className="w-full bg-foreground/5 p-2 rounded-lg text-[9px] font-bold border-0 focus:outline-none"
                            value={m.date}
                            onChange={(e) => {
                              const ms = [...editingProject.milestones];
                              ms[idx].date = e.target.value;
                              setEditingProject({ ...editingProject, milestones: ms });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute bottom-[140px] left-0 right-0 px-8 z-[300] flex gap-3 pointer-events-none">
              <div className="flex-1 flex gap-3 pointer-events-auto">
                <button onClick={() => handleDelete(editingProject.id)} className="p-6 bg-danger text-white rounded-[2rem] shadow-xl active:scale-95 transition-all border border-white/20 backdrop-blur-xl">
                  <Trash2 size={20} />
                </button>
                <button
                  onClick={handleSaveProject}
                  className="flex-1 bg-primary text-white font-[1000] py-6 rounded-[2.25rem] text-[12px] uppercase tracking-[0.4em] shadow-[0_20px_40px_rgba(139,92,246,0.6)] neon-glow-primary active:scale-95 transition-all border border-white/20 backdrop-blur-xl"
                >
                  LƯU DỰ ÁN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
