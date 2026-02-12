
import React, { useEffect, useState } from 'react';
import { Transaction, User, IncomeProject, Milestone, Category, TransactionType, FinancialReport, Budget, Wallet, FixedCost, Goal } from '../types';
import { AiService } from '../services/aiService';
import { StorageService } from '../services/storageService';
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { Sparkles, Plus, Calendar, Trash2, ArrowRight, Wallet as WalletIcon, CheckCircle, TrendingUp, Activity, Target, Zap, AlertTriangle, X, PartyPopper, Clock, AlertCircle, ShieldAlert, Rocket, Ban, Loader2, Gauge, BarChart, LineChart, ChevronRight, CheckSquare, Square, Coins, Trophy, Star, Gift, Diamond } from 'lucide-react';

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
  "Tiền về đầy túi, nụ cười rạng rỡ, hôm nay thật tuyệt! 🧧😊🎉"
];

export const Insights: React.FC<Props> = ({ transactions, users }) => {
  const [activeTab, setActiveTab] = useState<'planning' | 'report'>('planning');
  const [projects, setProjects] = useState<IncomeProject[]>([]);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [celebratingProject, setCelebratingProject] = useState<IncomeProject | null>(null);
  const [currentQuote, setCurrentQuote] = useState("");
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingProject, setEditingProject] = useState<any>({ milestones: [] });

  useEffect(() => { loadProjects(); }, [users]);

  const loadProjects = () => { setProjects(StorageService.getIncomeProjects()); };

  const activeUser = users[0];

  const handleGenerateReport = async () => {
      setIsReportLoading(true);
      const result = await AiService.generateComprehensiveReport(
        transactions, 
        StorageService.getGoals(), 
        projects, 
        StorageService.getFixedCosts(), 
        StorageService.getBudgets(), 
        StorageService.getWallets(), 
        activeUser.gender as any
      );
      setReport(result);
      setIsReportLoading(false);
  };

  const toggleMilestone = (projectId: string, milestoneId: string) => {
    const ps = [...projects];
    const pIdx = ps.findIndex(p => p.id === projectId);
    if (pIdx === -1 || ps[pIdx].status === 'completed') return;
    
    const mIdx = ps[pIdx].milestones.findIndex(m => m.id === milestoneId);
    if (mIdx === -1) return;
    
    ps[pIdx].milestones[mIdx].isCompleted = !ps[pIdx].milestones[mIdx].isCompleted;
    ps[pIdx].status = calculateStatus(ps[pIdx]);
    
    if (ps[pIdx].milestones.length > 0 && ps[pIdx].milestones.every(m => m.isCompleted)) {
        const randomQuote = CELEBRATION_QUOTES[Math.floor(Math.random() * CELEBRATION_QUOTES.length)];
        setCurrentQuote(randomQuote);
        setCelebratingProject(ps[pIdx]);
    } else {
        StorageService.updateIncomeProject(ps[pIdx]);
        loadProjects();
    }
  };

  const handleCollectIncome = () => {
    if (!celebratingProject) return;

    const tx: Transaction = {
        id: `tx_inc_proj_${Date.now()}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        amount: celebratingProject.expectedIncome,
        type: TransactionType.INCOME,
        category: Category.INCOME,
        walletId: 'w1',
        description: `Thu nhập dự án: ${celebratingProject.name}`,
        timestamp: Date.now()
    };
    StorageService.addTransaction(tx);

    const updatedProj = { ...celebratingProject, status: 'completed' as const };
    StorageService.updateIncomeProject(updatedProj);
    
    setCelebratingProject(null);
    loadProjects();
    
    if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
  };

  const calculateStatus = (project: IncomeProject): IncomeProject['status'] => {
    const isAllCompleted = project.milestones.length > 0 && project.milestones.every(m => m.isCompleted);
    if (isAllCompleted) return 'completed';

    const today = new Date().toISOString().split('T')[0];
    if (project.endDate && project.endDate < today) return 'overdue';
    if (project.startDate && project.startDate > today) return 'upcoming';
    return 'in_progress';
  };

  const handleOpenCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingProject({
      id: '',
      userId: activeUser.id,
      name: '',
      description: '',
      expectedIncome: '',
      startDate: today,
      endDate: today,
      status: 'planning',
      milestones: []
    });
    setIsEditOpen(true);
  };

  const handleOpenEdit = (project: IncomeProject) => {
    setEditingProject({
      ...project,
      expectedIncome: formatNumberInput(project.expectedIncome)
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
          description: editingProject.description || '',
          expectedIncome: parseNumberInput(editingProject.expectedIncome),
          startDate: editingProject.startDate,
          endDate: editingProject.endDate,
          status: 'planning',
          milestones: editingProject.milestones || []
      };
      projectData.status = calculateStatus(projectData);
      
      if (editingProject.id) StorageService.updateIncomeProject(projectData);
      else StorageService.addIncomeProject(projectData);
      
      loadProjects();
      setIsEditOpen(false);
  };

  const handleGeneratePlan = async () => {
      if (!aiPrompt) return;
      setIsGenerating(true);
      const plan = await AiService.generateIncomePlan(aiPrompt);
      setIsGenerating(false);
      if (plan) {
          setIsAiModalOpen(false);
          const today = new Date().toISOString().split('T')[0];
          const newProj: any = {
              id: '', userId: activeUser.id, name: plan.name, description: plan.description, expectedIncome: formatNumberInput(plan.expectedIncome),
              startDate: today, endDate: today, status: 'planning',
              milestones: plan.milestones.map((m: any, idx: number) => ({
                   id: `m_ai_${idx}_${Date.now()}`, title: m.title, startDate: today, date: today, isCompleted: false
              }))
          };
          setEditingProject(newProj);
          setIsEditOpen(true);
      }
  };

  const renderPlanningTab = () => (
      <div className="space-y-6">
        {projects.length === 0 ? (
            <div className="glass-card liquid-glass rounded-[3rem] p-16 text-center border-0 shadow-xl">
                <Calendar size={48} className="mx-auto mb-6 text-warning" />
                <p className="text-foreground/30 font-black text-xs uppercase tracking-[0.2em]">{VI.insights.noProjects}</p>
            </div>
        ) : (
            <div className="space-y-6">
                {projects.map(project => {
                    const completedCount = project.milestones.filter(m => m.isCompleted).length;
                    const totalCount = project.milestones.length;
                    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    const currentStatus = calculateStatus(project);
                    return (
                        <div key={project.id} className="glass-card liquid-glass rounded-[2.5rem] p-7 border-0 relative group shadow-2xl bg-gradient-to-br from-surface/80 to-background overflow-hidden animate-in fade-in duration-500">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1 flex-1">
                                    <h3 className="text-xl font-[1000] text-foreground uppercase tracking-tighter leading-tight cursor-pointer hover:text-primary transition-colors flex items-center gap-2" onClick={() => handleOpenEdit(project)}>
                                      {project.name}
                                      {currentStatus === 'completed' && <Star size={18} className="text-gold fill-gold animate-pulse" />}
                                    </h3>
                                    <p className="text-secondary text-lg font-[1000] tracking-tighter flex items-center gap-1.5">
                                      <Diamond size={16} className="text-primary animate-pulse" />
                                      {formatVND(project.expectedIncome)}
                                    </p>
                                </div>
                                <div className={`text-[8px] px-3 py-1 rounded-full uppercase font-black tracking-[0.15em] shadow-md shrink-0 ${
                                    currentStatus === 'completed' ? 'bg-secondary text-white' : 
                                    currentStatus === 'overdue' ? 'bg-danger text-white' : 
                                    'bg-primary text-white'
                                }`}>
                                    {VI.insights.project.status[currentStatus]}
                                </div>
                            </div>

                            <div className="space-y-5 mb-6">
                                <div className="flex justify-between items-end text-[9px] font-black text-foreground/30 uppercase tracking-[0.02em] px-1">
                                    <span>Tiến độ thực hiện</span>
                                    <span className="text-secondary font-black">{progress}% ({completedCount}/{totalCount})</span>
                                </div>
                                <div className="h-2 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner relative">
                                    <div 
                                      className={`h-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary via-purple-500 to-secondary shadow-[0_0_12px_rgba(139,92,246,0.3)]`} 
                                      style={{ width: `${progress}%` }}
                                    ></div>
                                </div>

                                {project.milestones.length > 0 && (
                                    <div className="space-y-4 mt-6">
                                        {project.milestones.map(m => (
                                            <div 
                                              key={m.id} 
                                              className={`flex items-start gap-4 group/item cursor-pointer transition-all duration-300 p-2 rounded-2xl ${m.isCompleted ? 'bg-secondary/5 shadow-[0_0_15px_rgba(16,185,129,0.15)] opacity-50' : 'hover:bg-foreground/5'}`} 
                                              onClick={() => toggleMilestone(project.id, m.id)}
                                            >
                                                {m.isCompleted ? (
                                                  <CheckSquare size={18} className="text-secondary shrink-0 mt-0.5" />
                                                ) : (
                                                  <Square size={18} className="text-foreground/20 shrink-0 mt-0.5 group-hover/item:text-primary transition-colors" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] font-black uppercase truncate leading-[1.5] tracking-[0.02em] ${m.isCompleted ? 'text-foreground/40 line-through' : 'text-foreground/80'}`}>{m.title}</p>
                                                    <p className="text-[7px] font-bold text-foreground/10 mt-1 uppercase tracking-widest">{m.startDate} → {m.date}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-foreground/5">
                                <span className="text-[8px] font-black text-foreground/20 uppercase tracking-widest italic">{project.startDate} đến {project.endDate}</span>
                                <button onClick={() => handleOpenEdit(project)} className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center bg-primary/5 px-4 py-2 rounded-xl active:scale-95 transition-all">CHI TIÊU <ChevronRight size={14} className="ml-1" /></button>
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

  const renderReportTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="glass-card bg-gradient-to-br from-primary/10 via-surface to-background rounded-[2.5rem] p-8 text-center space-y-6 shadow-xl border-0 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
        <div className="relative z-10 space-y-4">
          <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em]">Phân tích tài chính tổng thể</h3>
          <button 
            onClick={handleGenerateReport} 
            disabled={isReportLoading}
            className="mx-auto w-24 h-24 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl neon-glow-primary active:scale-95 transition-all border-4 border-white/10 disabled:opacity-50"
          >
            {isReportLoading ? <Loader2 size={40} className="animate-spin" /> : <Gauge size={44} />}
          </button>
          <div className="space-y-1">
            <p className="text-2xl font-[1000] text-foreground uppercase tracking-tight">
              {isReportLoading ? "Đang xử lý dữ liệu..." : report ? `Điểm: ${report.healthScore}/100` : "Sẵn sàng phân tích"}
            </p>
            {report && (
              <p className="text-[11px] font-medium text-foreground/50 uppercase tracking-widest leading-relaxed px-4">
                {report.healthAnalysis}
              </p>
            )}
          </div>
        </div>
      </div>

      {report && (
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
              <p className="text-[11px] font-medium text-foreground/60 leading-relaxed uppercase tracking-tight">{report.budgetDiscipline.varianceAnalysis}</p>
              {report.budgetDiscipline.trashSpending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-danger uppercase tracking-widest">Chi tiêu cần cắt giảm:</p>
                  <div className="flex flex-wrap gap-2">
                    {report.budgetDiscipline.trashSpending.map((item, idx) => (
                      <span key={idx} className="px-3 py-1 bg-danger/10 text-danger rounded-lg text-[9px] font-black uppercase tracking-tight border border-danger/10">{item}</span>
                    ))}
                  </div>
                </div>
              )}
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
    <div className="p-6 pt-12 space-y-8 pb-32 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-[900] text-foreground tracking-tighter uppercase flex items-center gap-4">
          <Sparkles className="text-primary animate-pulse" size={32} />
          THU NHẬP
        </h2>
        {activeTab === 'planning' && (
            <button onClick={() => setIsAiModalOpen(true)} className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl neon-glow-primary active:scale-90 transition-all"><Sparkles size={24} /></button>
        )}
      </div>
      
      <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
          <div className="flex relative">
              <button onClick={() => setActiveTab('planning')} className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined ${activeTab === 'planning' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>LẬP KẾ HOẠCH</button>
              <button onClick={() => setActiveTab('report')} className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined ${activeTab === 'report' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>BÁO CÁO CFO</button>
          </div>
      </div>

      {activeTab === 'planning' ? renderPlanningTab() : renderReportTab()}

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

      {isAiModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-6">
              <div className="glass-card w-full max-w-sm rounded-[3rem] p-10 border-0 shadow-2xl bg-surface animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-black text-foreground uppercase tracking-tight">AI SUGGESTION</h3>
                      <button onClick={() => setIsAiModalOpen(false)} className="p-2 bg-foreground/5 rounded-xl"><X size={18} /></button>
                  </div>
                  <div className="space-y-6">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-foreground/30 uppercase tracking-widest ml-2">Bạn định kiếm tiền từ việc gì?</label>
                          <textarea 
                            className="w-full bg-foreground/5 text-foreground p-5 rounded-2xl font-bold focus:ring-2 focus:ring-primary border-0 shadow-inner h-32 resize-none" 
                            placeholder="VD: Dạy tiếng Anh online, Bán đồ cũ..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                          />
                      </div>
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

      {isEditOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4 sm:p-6 overflow-hidden">
              <div className="glass-card w-full max-w-md h-[92vh] flex flex-col rounded-[3.5rem] shadow-2xl border-0 bg-surface overflow-hidden relative animate-in zoom-in-95">
                  <div className="flex justify-between items-center p-8 pb-4 shrink-0 bg-surface/80 backdrop-blur-md z-10 border-b border-foreground/5">
                      <h2 className="text-xl font-bold text-foreground uppercase tracking-refined leading-relaxed">CHI TIÊU DỰ ÁN</h2>
                      <button onClick={() => setIsEditOpen(false)} className="p-3 bg-foreground/5 rounded-2xl text-foreground hover:text-primary transition-all"><X size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-8 pb-[180px] space-y-6 no-scrollbar pt-6">
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-foreground/30 ml-2 tracking-refined uppercase">Tên dự án</label>
                          <input className="w-full bg-foreground/5 text-foreground p-5 rounded-[1.5rem] font-bold focus:ring-2 focus:ring-primary text-xs uppercase border-0 shadow-inner" value={editingProject.name} onChange={e => setEditingProject((prev: any) => ({...prev, name: e.target.value}))} />
                      </div>
                      
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-foreground/30 ml-2 tracking-refined uppercase">Doanh thu kỳ vọng (VND)</label>
                          <input type="text" inputMode="numeric" className="w-full bg-foreground/5 text-secondary text-2xl font-bold p-5 rounded-[1.5rem] focus:outline-none border-0 shadow-inner" value={editingProject.expectedIncome} onChange={e => setEditingProject((prev: any) => ({...prev, expectedIncome: formatNumberInput(e.target.value)}))} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <div className="flex items-center gap-1.5 ml-2">
                                <Calendar size={12} className="text-warning" />
                                <label className="text-[9px] font-bold text-foreground/30 tracking-refined uppercase">Bắt đầu</label>
                              </div>
                              <input type="date" className="w-full bg-foreground/5 text-foreground p-4 rounded-xl font-bold focus:outline-none text-xs border-0" value={editingProject.startDate} onChange={e => setEditingProject((prev: any) => ({...prev, startDate: e.target.value}))} />
                          </div>
                          <div className="space-y-1">
                              <div className="flex items-center gap-1.5 ml-2">
                                <Calendar size={12} className="text-warning" />
                                <label className="text-[9px] font-bold text-foreground/30 tracking-refined uppercase">Hoàn thành</label>
                              </div>
                              <input type="date" className="w-full bg-foreground/5 text-foreground p-4 rounded-xl font-bold focus:outline-none text-xs border-0" value={editingProject.endDate} onChange={e => setEditingProject((prev: any) => ({...prev, endDate: e.target.value}))} />
                          </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-foreground/5">
                        <div className="flex justify-between items-center px-1">
                            <h4 className="text-[10px] font-bold text-foreground/40 uppercase tracking-refined">CÁC BƯỚC THỰC HIỆN</h4>
                            <button onClick={() => setEditingProject((prev: any) => ({...prev, milestones: [...(prev.milestones || []), { id: `m_${Date.now()}`, title: '', startDate: new Date().toISOString().split('T')[0], date: new Date().toISOString().split('T')[0], isCompleted: false }] }))} className="text-primary text-[8px] font-bold uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-xl">+ THÊM BƯỚC</button>
                        </div>
                        <div className="space-y-4">
                            {editingProject.milestones?.map((m: any, idx: number) => (
                                <div key={m.id} className="glass-card bg-foreground/[0.03] p-5 rounded-[2rem] border-0 space-y-3 relative">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={m.isCompleted} onChange={(e) => {
                                            const ms = [...editingProject.milestones];
                                            ms[idx].isCompleted = e.target.checked;
                                            setEditingProject({...editingProject, milestones: ms});
                                        }} className="w-5 h-5 rounded-lg border-2 border-primary/30 checked:bg-primary" />
                                        <input className="flex-1 bg-transparent border-0 focus:outline-none text-xs font-bold uppercase placeholder:opacity-20 leading-relaxed-tight tracking-refined" placeholder="Tên công việc..." value={m.title} onChange={e => {
                                            const ms = [...editingProject.milestones];
                                            ms[idx].title = e.target.value;
                                            setEditingProject({...editingProject, milestones: ms});
                                        }} />
                                        <button onClick={() => {
                                            const ms = [...editingProject.milestones];
                                            ms.splice(idx, 1);
                                            setEditingProject({...editingProject, milestones: ms});
                                        }} className="text-danger/40 hover:text-danger p-1"><Trash2 size={16}/></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-foreground/5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 ml-1">
                                                <Calendar size={10} className="text-warning" />
                                                <p className="text-[7px] font-bold text-foreground/20 uppercase tracking-refined">Bắt đầu</p>
                                            </div>
                                            <input type="date" className="w-full bg-foreground/5 p-2 rounded-lg text-[9px] font-bold border-0 focus:outline-none" value={m.startDate} onChange={e => {
                                                const ms = [...editingProject.milestones];
                                                ms[idx].startDate = e.target.value;
                                                setEditingProject({...editingProject, milestones: ms});
                                            }} />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 ml-1">
                                                <Calendar size={10} className="text-warning" />
                                                <p className="text-[7px] font-bold text-foreground/20 uppercase tracking-refined">Hoàn thành</p>
                                            </div>
                                            <input type="date" className="w-full bg-foreground/5 p-2 rounded-lg text-[9px] font-bold border-0 focus:outline-none" value={m.date} onChange={e => {
                                                const ms = [...editingProject.milestones];
                                                ms[idx].date = e.target.value;
                                                setEditingProject({...editingProject, milestones: ms});
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                      </div>
                  </div>
                  
                  {/* Cố định nút Lưu Dự Án ở phía trên thanh điều hướng (Dùng absolute bottom lớn hơn) */}
                  <div className="absolute bottom-[140px] left-0 right-0 px-8 z-[300] flex gap-3 pointer-events-none">
                      <div className="flex-1 flex gap-3 pointer-events-auto">
                        <button 
                            onClick={() => handleDelete(editingProject.id)} 
                            className="p-6 bg-danger text-white rounded-[2rem] shadow-xl active:scale-95 transition-all border border-white/20 backdrop-blur-xl"
                        >
                            <Trash2 size={20}/>
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
