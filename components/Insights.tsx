
import React, { useEffect, useState } from 'react';
import { Transaction, User, IncomeProject, Milestone, Category, TransactionType, FinancialReport, Budget, Wallet, FixedCost, Goal } from '../types';
import { GeminiService } from '../services/aiService';
import { StorageService } from '../services/storageService';
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { Sparkles, Plus, Calendar, Trash2, ArrowRight, Wallet as WalletIcon, CheckCircle, TrendingUp, Activity, Target, Zap, AlertTriangle, X, PartyPopper, Clock, AlertCircle, ShieldAlert, Rocket, Ban, Loader2, Gauge, BarChart, LineChart, ChevronRight, CheckSquare, Square, Coins, Trophy, Star, Gift } from 'lucide-react';

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
      const result = await GeminiService.generateComprehensiveReport(
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
    
    // Nếu hoàn thành toàn bộ checklist
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

    // 1. Tạo giao dịch thu nhập
    const tx: Transaction = {
        id: `tx_inc_proj_${Date.now()}`,
        date: new Date().toISOString(),
        amount: celebratingProject.expectedIncome,
        type: TransactionType.INCOME,
        category: Category.INCOME,
        walletId: 'w1',
        description: `Thu nhập dự án: ${celebratingProject.name}`,
        timestamp: Date.now()
    };
    StorageService.addTransaction(tx);

    // 2. Chốt trạng thái dự án
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
      const plan = await GeminiService.generateIncomePlan(aiPrompt);
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
                <Calendar size={48} className="mx-auto mb-6 text-foreground/10" />
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
                        <div key={project.id} className="glass-card liquid-glass rounded-[2.5rem] p-7 border-0 relative group shadow-2xl bg-gradient-to-br from-surface/80 to-background overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1 flex-1">
                                    <h3 className="text-xl font-[1000] text-foreground uppercase tracking-tighter leading-tight cursor-pointer hover:text-primary transition-colors" onClick={() => handleOpenEdit(project)}>{project.name}</h3>
                                    <p className="text-secondary text-lg font-[1000] tracking-tighter">{formatVND(project.expectedIncome)}</p>
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
                                <div className="flex justify-between items-end text-[9px] font-black text-foreground/30 uppercase tracking-widest px-1">
                                    <span>Tiến độ thực hiện</span>
                                    <span className="text-secondary font-black">{progress}% ({completedCount}/{totalCount})</span>
                                </div>
                                <div className="h-2 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner relative">
                                    <div className={`h-full transition-all duration-700 neon-glow-primary ${currentStatus === 'overdue' ? 'bg-danger' : (currentStatus === 'completed' ? 'bg-secondary' : 'bg-primary')}`} style={{ width: `${progress}%` }}></div>
                                </div>

                                {project.milestones.length > 0 && (
                                    <div className="space-y-4 mt-6">
                                        {project.milestones.map(m => (
                                            <div key={m.id} className="flex items-start gap-4 group/item cursor-pointer" onClick={() => toggleMilestone(project.id, m.id)}>
                                                {m.isCompleted ? <CheckSquare size={18} className="text-secondary shrink-0 mt-0.5" /> : <Square size={18} className="text-foreground/20 shrink-0 mt-0.5" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] font-black uppercase truncate leading-snug ${m.isCompleted ? 'text-foreground/20 line-through' : 'text-foreground/80'}`}>{m.title}</p>
                                                    <p className="text-[7px] font-bold text-foreground/10 mt-1 uppercase">{m.startDate} → {m.date}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-foreground/5">
                                <span className="text-[8px] font-black text-foreground/20 uppercase tracking-widest italic">{project.startDate} đến {project.endDate}</span>
                                <button onClick={() => handleOpenEdit(project)} className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center bg-primary/5 px-4 py-2 rounded-xl">CHI TIẾT <ChevronRight size={14} className="ml-1" /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
        <button onClick={handleOpenCreate} className="w-full py-8 glass-card bg-foreground/[0.02] rounded-[3rem] border-dashed border-foreground/20 text-foreground/30 font-black text-[11px] uppercase tracking-[0.3em] hover:bg-foreground/[0.05] transition-all border-2">
            + THÊM KẾ HOẠCH MỚI
        </button>
      </div>
  );

  const renderReportTab = () => (
      <div className="space-y-8">
          {!report ? (
              <div className="glass-card liquid-glass rounded-[3rem] p-16 text-center border-0 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-[80px] opacity-50"></div>
                  <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 neon-glow-primary"><Zap size={48} /></div>
                  <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase mb-4">CFO INSIGHTS</h3>
                  <button onClick={handleGenerateReport} disabled={isReportLoading} className="w-full bg-primary text-white font-[900] py-6 rounded-[2rem] text-[11px] uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                      {isReportLoading ? <><Loader2 className="animate-spin" size={20} /> ĐANG ĐÁNH GIÁ...</> : 'BẮT ĐẦU PHÂN TÍCH'}
                  </button>
              </div>
          ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom duration-500 pb-10">
                  <div className="glass-card bg-gradient-to-br from-primary/10 via-surface to-background rounded-[3.5rem] p-10 text-center relative border-0 shadow-2xl">
                      <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.4em] mb-6">Financial Health Score</h3>
                      <div className="relative w-32 h-32 mx-auto flex items-center justify-center mb-6">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-foreground/5" />
                              <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className={report.healthScore > 75 ? "text-secondary" : "text-primary"} strokeDasharray={264} strokeDashoffset={264 - (264 * report.healthScore) / 100} strokeLinecap="round" />
                          </svg>
                          <span className="absolute text-4xl font-[1000] text-foreground tracking-tighter">{report.healthScore}</span>
                      </div>
                      <p className="text-xs font-[800] text-foreground/60 uppercase italic">"{report.healthAnalysis}"</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="glass-card p-6 rounded-[2.5rem] border-0 bg-surface/40 flex flex-col items-center text-center">
                          <Rocket size={20} className="text-secondary mb-2" />
                          <span className="text-[8px] font-black text-foreground/30 uppercase tracking-widest mb-1">Hiệu suất thu</span>
                          <span className="text-lg font-[1000] text-foreground tracking-tighter">{report.incomeEfficiency.score}%</span>
                      </div>
                      <div className="glass-card p-6 rounded-[2.5rem] border-0 bg-surface/40 flex flex-col items-center text-center">
                          <ShieldAlert size={20} className="text-danger mb-2" />
                          <span className="text-[8px] font-black text-foreground/30 uppercase tracking-widest mb-1">Kỷ luật chi</span>
                          <span className="text-lg font-[1000] text-foreground tracking-tighter truncate w-full">{report.budgetDiscipline.status}</span>
                      </div>
                  </div>
                  <div className="glass-card bg-foreground text-background p-8 rounded-[3.5rem] border-0 shadow-2xl relative overflow-hidden group">
                      <h4 className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em] mb-4">LỜI KHUYÊN CHIẾN LƯỢC</h4>
                      <p className="font-comic text-xl font-bold leading-snug">{report.cfoAdvice}</p>
                  </div>
                  <button onClick={() => setReport(null)} className="w-full py-6 text-foreground/30 font-black text-[11px] uppercase tracking-widest">LÀM MỚI BÁO CÁO</button>
              </div>
          )}
      </div>
  );

  return (
    <div className="p-6 pt-12 space-y-8 pb-32 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-[900] text-foreground tracking-tighter uppercase flex items-center gap-4"><Sparkles className="text-primary" size={32} />THU NHẬP</h2>
        {activeTab === 'planning' && (
            <button onClick={() => setIsAiModalOpen(true)} className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl neon-glow-primary active:scale-90 transition-all"><Sparkles size={24} /></button>
        )}
      </div>
      <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
          <div className="flex relative">
              <button onClick={() => setActiveTab('planning')} className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] ${activeTab === 'planning' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>KẾ HOẠCH</button>
              <button onClick={() => setActiveTab('report')} className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] ${activeTab === 'report' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>BÁO CÁO CFO</button>
          </div>
      </div>
      {activeTab === 'planning' ? renderPlanningTab() : renderReportTab()}

      {/* MODAL CHÚC MỪNG HOÀN THÀNH DỰ ÁN */}
      {celebratingProject && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 animate-in fade-in duration-500">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-[15%] left-[15%] w-48 h-48 bg-secondary/20 blur-[90px] animate-pulse"></div>
                  <div className="absolute bottom-[15%] right-[15%] w-48 h-48 bg-primary/20 blur-[90px] animate-pulse delay-700"></div>
                  <Star className="absolute top-20 right-20 text-gold/20 animate-spin" size={32} />
                  <Star className="absolute bottom-40 left-10 text-primary/20 animate-bounce" size={24} />
                  <Sparkles className="absolute top-1/2 left-1/4 text-secondary/20 animate-pulse" size={40} />
              </div>

              <div className="glass-card w-full max-w-sm rounded-[4.5rem] p-12 text-center border-0 shadow-2xl bg-gradient-to-br from-surface to-background relative overflow-hidden animate-in zoom-in-95 duration-500">
                  <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-primary via-secondary to-primary shadow-[0_0_20px_rgba(139,92,246,0.5)]"></div>
                  
                  <div className="relative z-10 space-y-10">
                      {/* 3 Icons trang trí sinh động theo yêu cầu */}
                      <div className="flex justify-center items-end gap-3 h-32 relative">
                          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-lg transform -rotate-12 animate-bounce">
                              <Trophy size={28} />
                          </div>
                          <div className="w-24 h-24 bg-secondary text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl neon-glow-secondary z-20 animate-[bounce_1s_infinite_200ms]">
                              <PartyPopper size={50} strokeWidth={2.5} />
                          </div>
                          <div className="w-18 h-18 bg-gold/10 text-gold rounded-2xl flex items-center justify-center shadow-lg transform rotate-12 animate-bounce delay-300">
                              <Coins size={36} />
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 border border-secondary/20 mb-2">
                             <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] animate-pulse">KẾ HOẠCH THÀNH CÔNG</h3>
                          </div>
                          <h4 className="text-3xl font-[1000] text-foreground tracking-tighter uppercase leading-tight drop-shadow-sm">{celebratingProject.name}</h4>
                          <div className="px-4">
                             {/* Câu chúc mừng khích lệ luân phiên */}
                             <p className="font-comic text-xl text-foreground font-bold leading-relaxed italic opacity-90">"{currentQuote}"</p>
                          </div>
                      </div>

                      <div className="glass-card bg-foreground/[0.04] p-8 rounded-[3rem] border-0 shadow-inner relative overflow-hidden">
                          <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1 relative z-10">THU NHẬP ĐÃ CHỐT</p>
                          <p className="text-4xl font-[1000] text-secondary tracking-tighter relative z-10 neon-glow-secondary-text">{formatVND(celebratingProject.expectedIncome)}</p>
                          <div className="absolute inset-0 bg-gradient-to-tr from-secondary/5 via-transparent to-primary/5"></div>
                      </div>

                      <div className="space-y-4">
                          <button 
                              onClick={handleCollectIncome}
                              className="w-full bg-secondary text-white font-[1000] py-6.5 rounded-[2.25rem] text-[12px] uppercase tracking-[0.4em] shadow-[0_25px_50px_rgba(16,185,129,0.5)] neon-glow-secondary active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20"
                          >
                             THU TIỀN VỀ VÍ <Coins size={22} />
                          </button>
                          <button 
                            onClick={() => {
                                StorageService.updateIncomeProject({...celebratingProject, status: 'completed'});
                                setCelebratingProject(null);
                                loadProjects();
                            }}
                            className="text-[9px] font-black text-foreground/20 uppercase tracking-widest hover:text-foreground/40 flex items-center justify-center gap-2 mx-auto pt-2"
                          >
                             BỎ QUA GIAO DỊCH <X size={12}/>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL AI */}
      {isAiModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 backdrop-blur-3xl px-6">
              <div className="glass-card w-full max-w-[340px] sm:max-w-md rounded-[3rem] p-10 border-0 shadow-2xl animate-in zoom-in-95 bg-surface relative overflow-hidden">
                  <div className="text-center mb-10">
                      <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-6 neon-glow-primary"><Sparkles size={36} /></div>
                      <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase">GỢI Ý KẾ HOẠCH</h3>
                  </div>
                  <div className="space-y-8">
                      <textarea 
                          className="w-full bg-foreground/5 border-0 rounded-[2rem] p-6 text-foreground font-bold focus:ring-2 focus:ring-primary focus:outline-none h-40 uppercase text-sm resize-none"
                          placeholder="VD: Mở khóa học Online, Bán đồ handmade..."
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                      />
                      <div className="flex gap-4">
                          <button onClick={() => setIsAiModalOpen(false)} className="flex-1 py-6 rounded-2xl font-black text-[11px] text-foreground/30 uppercase tracking-widest">HỦY</button>
                          <button onClick={handleGeneratePlan} disabled={isGenerating || !aiPrompt} className="flex-[2] py-6 rounded-2xl font-black text-[11px] text-white bg-primary shadow-2xl neon-glow-primary uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all">
                              {isGenerating ? 'ĐANG LẬP...' : 'LẬP KẾ HOẠCH'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4 sm:p-6 overflow-hidden">
              <div className="glass-card w-full max-w-md h-[92vh] flex flex-col rounded-[3.5rem] shadow-2xl border-0 bg-surface overflow-hidden relative">
                  <div className="flex justify-between items-center p-8 pb-4 shrink-0 bg-surface/80 backdrop-blur-md z-10 border-b border-foreground/5">
                      <h3 className="text-xl font-[1000] text-foreground tracking-tighter uppercase">CHI TIẾT DỰ ÁN</h3>
                      <button onClick={() => setIsEditOpen(false)} className="p-3 bg-foreground/5 rounded-2xl text-foreground hover:text-primary transition-all"><X size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-8 pb-80 space-y-6 no-scrollbar pt-6">
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Tên dự án</label>
                          <input className="w-full bg-foreground/5 text-foreground p-5 rounded-[1.5rem] font-[800] focus:ring-2 focus:ring-primary text-xs uppercase border-0 shadow-inner" value={editingProject.name} onChange={e => setEditingProject((prev: any) => ({...prev, name: e.target.value}))} />
                      </div>
                      
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Doanh thu kỳ vọng (VND)</label>
                          <input type="text" inputMode="numeric" className="w-full bg-foreground/5 text-secondary text-2xl font-[900] p-5 rounded-[1.5rem] focus:outline-none border-0 shadow-inner" value={editingProject.expectedIncome} onChange={e => setEditingProject((prev: any) => ({...prev, expectedIncome: formatNumberInput(e.target.value)}))} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Ngày bắt đầu</label>
                              <input type="date" className="w-full bg-foreground/5 text-foreground p-4 rounded-xl font-bold focus:outline-none text-xs border-0" value={editingProject.startDate} onChange={e => setEditingProject((prev: any) => ({...prev, startDate: e.target.value}))} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Ngày hoàn thành</label>
                              <input type="date" className="w-full bg-foreground/5 text-foreground p-4 rounded-xl font-bold focus:outline-none text-xs border-0" value={editingProject.endDate} onChange={e => setEditingProject((prev: any) => ({...prev, endDate: e.target.value}))} />
                          </div>
                      </div>

                      {/* Milestone list */}
                      <div className="space-y-4 pt-4 border-t border-foreground/5">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em]">CÁC BƯỚC THỰC HIỆN</h4>
                            <button onClick={() => setEditingProject((prev: any) => ({...prev, milestones: [...(prev.milestones || []), { id: `m_${Date.now()}`, title: '', startDate: new Date().toISOString().split('T')[0], date: new Date().toISOString().split('T')[0], isCompleted: false }] }))} className="text-primary text-[8px] font-black uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-xl">+ THÊM BƯỚC</button>
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
                                                setEditingProject({...editingProject, milestones: ms});
                                            }}
                                            className="w-5 h-5 rounded-lg border-2 border-primary/30 checked:bg-primary"
                                        />
                                        <input className="flex-1 bg-transparent border-0 focus:outline-none text-xs font-black uppercase placeholder:opacity-20" placeholder="Tên công việc..." value={m.title} onChange={e => {
                                            const ms = [...editingProject.milestones];
                                            ms[idx].title = e.target.value;
                                            setEditingProject({...editingProject, milestones: ms});
                                        }} />
                                        <button onClick={() => {
                                            const ms = [...editingProject.milestones];
                                            ms.splice(idx, 1);
                                            setEditingProject({...editingProject, milestones: ms});
                                        }} className="text-danger/40 hover:text-danger"><Trash2 size={16}/></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-foreground/5">
                                        <div className="space-y-1">
                                            <p className="text-[7px] font-black text-foreground/20 uppercase tracking-widest ml-1">Bắt đầu</p>
                                            <input type="date" className="w-full bg-foreground/5 p-2 rounded-lg text-[9px] font-bold border-0 focus:outline-none" value={m.startDate} onChange={e => {
                                                const ms = [...editingProject.milestones];
                                                ms[idx].startDate = e.target.value;
                                                setEditingProject({...editingProject, milestones: ms});
                                            }} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[7px] font-black text-foreground/20 uppercase tracking-widest ml-1">Hoàn thành</p>
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

                  {/* BOTTOM TOOLBAR */}
                  <div className="absolute bottom-[160px] left-0 right-0 px-8 z-[60] flex gap-4 pointer-events-none">
                      {editingProject.id && (
                        <button onClick={() => handleDelete(editingProject.id)} className="w-16 h-16 bg-danger/20 text-danger rounded-2xl flex items-center justify-center shadow-xl border border-danger/20 pointer-events-auto active:scale-95 transition-all">
                            <Trash2 size={24} />
                        </button>
                      )}
                      <button onClick={handleSaveProject} className="flex-1 bg-primary text-white font-[1000] py-5 rounded-[1.75rem] text-[11px] uppercase tracking-[0.4em] shadow-[0_15px_40px_rgba(139,92,246,0.6)] neon-glow-primary pointer-events-auto active:scale-95 transition-all flex items-center justify-center gap-3">
                        LƯU KẾ HOẠCH <CheckCircle size={22} />
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
