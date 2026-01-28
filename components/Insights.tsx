
import React, { useEffect, useState } from 'react';
import { Transaction, User, IncomeProject, Milestone, Category, TransactionType, FinancialReport } from '../types';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/storageService';
import { VI } from '../constants/vi';
import { formatVND } from '../utils/format';
import { Sparkles, Plus, Calendar, CheckSquare, Square, Trash2, ArrowRight, Wallet, CheckCircle, Save, TrendingUp, Activity, Target, Zap, BarChart2, AlertTriangle, X, PartyPopper } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  users: User[];
}

export const Insights: React.FC<Props> = ({ transactions, users }) => {
  const [activeTab, setActiveTab] = useState<'planning' | 'report'>('planning');
  const [projects, setProjects] = useState<IncomeProject[]>([]);
  
  // Report State
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  // Modal States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [celebrationProject, setCelebrationProject] = useState<string | null>(null);
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Edit/Create State
  const [editingProject, setEditingProject] = useState<Partial<IncomeProject>>({
      milestones: []
  });

  useEffect(() => {
    loadProjects();
  }, [users]);

  const loadProjects = () => {
    setProjects(StorageService.getIncomeProjects());
  };

  const activeUser = users[0];

  const handleGenerateReport = async () => {
      setIsReportLoading(true);
      const goals = StorageService.getGoals();
      const fixedCosts = StorageService.getFixedCosts();
      const result = await GeminiService.generateComprehensiveReport(transactions, goals, projects, fixedCosts);
      setReport(result);
      setIsReportLoading(false);
  };

  const handleOpenCreate = () => {
    setEditingProject({
        id: '',
        userId: activeUser.id,
        name: '',
        description: '',
        expectedIncome: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        status: 'planning',
        milestones: []
    });
    setIsEditOpen(true);
  };

  const handleOpenEdit = (project: IncomeProject) => {
      setEditingProject(JSON.parse(JSON.stringify(project)));
      setIsEditOpen(true);
  };

  const handleDelete = (id: string) => {
      if (confirm('Xóa kế hoạch này?')) {
          StorageService.deleteIncomeProject(id);
          loadProjects();
      }
  };

  const handleSaveProject = () => {
      if (!editingProject.name?.trim()) return;
      const projectToSave: IncomeProject = {
          id: editingProject.id || `p_${Date.now()}`,
          userId: editingProject.userId || activeUser.id,
          name: editingProject.name.trim(),
          description: editingProject.description || '',
          expectedIncome: Number(editingProject.expectedIncome) || 0,
          startDate: editingProject.startDate || new Date().toISOString().split('T')[0],
          endDate: editingProject.endDate || '',
          status: editingProject.status || 'planning',
          milestones: editingProject.milestones || []
      };
      if (editingProject.id) StorageService.updateIncomeProject(projectToSave);
      else StorageService.addIncomeProject(projectToSave);
      loadProjects();
      setIsEditOpen(false);
  };

  const handleAddMilestone = () => {
      const newM: Milestone = {
          id: `m_${Date.now()}`,
          title: '',
          startDate: new Date().toISOString().split('T')[0],
          date: '',
          isCompleted: false
      };
      setEditingProject(prev => ({ ...prev, milestones: [...(prev.milestones || []), newM] }));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: any) => {
      setEditingProject(prev => {
          const ms = [...(prev.milestones || [])];
          if (ms[index]) ms[index] = { ...ms[index], [field]: value };
          return { ...prev, milestones: ms };
      });
  };

  const removeMilestone = (index: number) => {
      setEditingProject(prev => {
          const ms = [...(prev.milestones || [])];
          ms.splice(index, 1);
          return { ...prev, milestones: ms };
      });
  };

  const toggleMilestoneInView = (project: IncomeProject, mIndex: number) => {
      const updatedProject = { ...project };
      const wasAllCompletedBefore = project.milestones.every(m => m.isCompleted);
      
      updatedProject.milestones = project.milestones.map((m, idx) => {
          if (idx === mIndex) {
              const newStatus = !m.isCompleted;
              return { 
                ...m, 
                isCompleted: newStatus,
                completedAt: newStatus ? new Date().toLocaleDateString('vi-VN') : undefined
              };
          }
          return m;
      });

      const isAllCompletedNow = updatedProject.milestones.length > 0 && updatedProject.milestones.every(m => m.isCompleted);
      
      if (isAllCompletedNow) {
          updatedProject.status = 'completed';
      } else if (updatedProject.milestones.some(m => m.isCompleted)) {
          updatedProject.status = 'in_progress';
      } else {
          updatedProject.status = 'planning';
      }

      StorageService.updateIncomeProject(updatedProject);
      loadProjects();

      if (isAllCompletedNow && !wasAllCompletedBefore) {
          setCelebrationProject(project.name);
      }
  };

  const handleGeneratePlan = async () => {
      if (!aiPrompt) return;
      setIsGenerating(true);
      const plan = await GeminiService.generateIncomePlan(aiPrompt);
      setIsGenerating(false);
      if (plan) {
          setIsAiModalOpen(false);
          setEditingProject({
              id: '',
              userId: activeUser.id,
              name: plan.name,
              description: plan.description,
              expectedIncome: plan.expectedIncome,
              startDate: new Date().toISOString().split('T')[0],
              endDate: '',
              status: 'planning',
              milestones: plan.milestones.map((m: any, idx: number) => ({
                   id: `m_ai_${idx}_${Date.now()}`,
                   title: m.title,
                   startDate: new Date().toISOString().split('T')[0],
                   date: '',
                   isCompleted: false
              }))
          });
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
            <div className="space-y-4">
                {projects.map(project => {
                    const completedCount = project.milestones.filter(m => m.isCompleted).length;
                    const totalCount = project.milestones.length;
                    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    
                    return (
                        <div key={project.id} className="glass-card liquid-glass rounded-[3rem] p-8 border-0 relative group shadow-2xl bg-gradient-to-br from-surface/80 to-background">
                            <div className="flex justify-between items-start mb-6">
                                <div className="max-w-[70%]">
                                    <h3 className="text-xl font-[900] text-foreground uppercase tracking-tighter leading-tight cursor-pointer hover:text-primary transition-colors" onClick={() => handleOpenEdit(project)}>
                                        {project.name}
                                    </h3>
                                    <p className="text-[11px] font-bold text-foreground/40 mt-1 uppercase tracking-widest">{project.description}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-secondary text-lg font-[900] block tracking-tighter">{formatVND(project.expectedIncome)}</span>
                                    <span className={`text-[9px] px-3 py-1.5 rounded-full uppercase font-black mt-3 inline-block tracking-widest ${project.status === 'completed' ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'bg-foreground/5 text-foreground/40'}`}>
                                        {VI.insights.project.status[project.status]}
                                    </span>
                                </div>
                            </div>

                            <div className="h-2.5 w-full bg-foreground/5 rounded-full mb-8 overflow-hidden shadow-inner">
                                <div className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-700 neon-glow-primary" style={{ width: `${progress}%` }}></div>
                            </div>

                            <div className="space-y-3">
                                {project.milestones.map((m, idx) => (
                                    <div key={m.id} className="flex flex-col p-4 glass-card bg-foreground/[0.03] rounded-[1.5rem] border-0 transition-all hover:bg-foreground/[0.06]">
                                        <div className="flex items-center space-x-4">
                                            <button onClick={() => toggleMilestoneInView(project, idx)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${m.isCompleted ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'border-2 border-foreground/10 text-transparent'}`}>
                                                <CheckCircle size={22} strokeWidth={4} />
                                            </button>
                                            <div className="flex-1">
                                                <p className={`text-[15px] font-[800] tracking-tight ${m.isCompleted ? 'text-foreground/30 line-through' : 'text-foreground/80'} uppercase`}>{m.title}</p>
                                                <div className="flex items-center gap-4 mt-1">
                                                    {m.startDate && <span className="text-[9px] font-black text-foreground/25 uppercase tracking-widest">Từ: {new Date(m.startDate).toLocaleDateString('vi-VN')}</span>}
                                                    {m.date && <span className="text-[9px] font-black text-foreground/25 uppercase tracking-widest">Hạn: {new Date(m.date).toLocaleDateString('vi-VN')}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center mt-8 pt-6 border-t border-foreground/5">
                                <button onClick={() => handleDelete(project.id)} className="p-3 text-foreground/10 hover:text-danger hover:bg-danger/5 rounded-2xl transition-all"><Trash2 size={22} /></button>
                                <button onClick={() => handleOpenEdit(project)} className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40 flex items-center hover:text-primary transition-colors bg-foreground/5 px-6 py-3 rounded-2xl">
                                    CHI TIẾT <ArrowRight size={16} className="ml-2" />
                                </button>
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
                  <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 neon-glow-primary">
                      <Sparkles size={48} />
                  </div>
                  <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase mb-6">Hệ Thống Phân Tích</h3>
                  <p className="text-foreground/40 text-[14px] font-bold mb-12 max-w-[300px] mx-auto leading-relaxed uppercase tracking-tight">AI sẽ dựa trên dữ liệu thu chi để đánh giá sức khỏe tài chính và dự báo tương lai của bạn.</p>
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isReportLoading}
                    className="w-full bg-primary text-white font-[900] py-6 rounded-[2rem] text-[11px] uppercase tracking-[0.3em] shadow-2xl neon-glow-primary active:scale-95 transition-all"
                  >
                      {isReportLoading ? 'ĐANG ĐÁNH GIÁ...' : 'BẮT ĐẦU PHÂN TÍCH'}
                  </button>
              </div>
          ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                  <div className="glass-card liquid-glass bg-gradient-to-br from-primary/10 via-surface to-background rounded-[3.5rem] p-12 text-center relative border-0 shadow-2xl">
                      <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.4em] mb-10">Financial Health Score</h3>
                      <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                              <circle cx="96" cy="96" r="85" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-foreground/5" />
                              <circle cx="96" cy="96" r="85" stroke="currentColor" strokeWidth="14" fill="transparent" className={report.healthScore > 70 ? "text-secondary" : "text-primary"} strokeDasharray={534} strokeDashoffset={534 - (534 * report.healthScore) / 100} strokeLinecap="round" />
                          </svg>
                          <span className="absolute text-6xl font-[900] text-foreground tracking-tighter">{report.healthScore}</span>
                      </div>
                  </div>

                  <div className="glass-card liquid-glass p-8 rounded-[3rem] border-0 space-y-8 shadow-2xl bg-surface/40">
                      <div className="flex items-center gap-6">
                          <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center ${report.incomeTrend.status === 'higher' ? 'bg-secondary text-white neon-glow-secondary' : 'bg-danger text-white'}`}>
                              <TrendingUp size={28} />
                          </div>
                          <div>
                            <h4 className="font-[900] text-foreground text-sm uppercase tracking-tight">Xu hướng thu nhập</h4>
                            <p className="text-[11px] font-black text-foreground/40 uppercase tracking-[0.2em]">{report.incomeTrend.status === 'higher' ? 'ĐANG TĂNG TRƯỞNG' : 'CẦN CẢI THIỆN'}</p>
                          </div>
                      </div>
                      <div className="glass-card bg-foreground/[0.03] p-6 rounded-[1.75rem] border-0">
                          <p className="text-[15px] font-bold text-foreground/90 italic leading-relaxed uppercase tracking-tight">"{report.incomeTrend.message}"</p>
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
          <Sparkles className="text-primary" size={32} />
          THU NHẬP
        </h2>
        {activeTab === 'planning' && (
            <button onClick={() => setIsAiModalOpen(true)} className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl neon-glow-primary active:scale-90 transition-all">
                <Sparkles size={24} />
            </button>
        )}
      </div>

      <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
          <div className="flex relative">
              <button onClick={() => setActiveTab('planning')} className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] ${activeTab === 'planning' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>KẾ HOẠCH</button>
              <button onClick={() => setActiveTab('report')} className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] ${activeTab === 'report' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>BÁO CÁO AI</button>
          </div>
      </div>

      {activeTab === 'planning' ? renderPlanningTab() : renderReportTab()}

      {/* CELEBRATION MODAL */}
      {celebrationProject && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-3xl px-8 animate-in zoom-in duration-500">
              <div className="text-center space-y-12 max-w-sm">
                  <div className="relative">
                      <div className="absolute inset-0 animate-ping bg-secondary/30 rounded-full blur-3xl scale-150"></div>
                      <div className="w-44 h-44 bg-secondary text-white rounded-[4rem] flex items-center justify-center mx-auto shadow-[0_0_80px_rgba(16,185,129,0.8)] relative z-10 animate-bounce">
                          <PartyPopper size={88} />
                      </div>
                  </div>
                  <div className="space-y-8">
                      <h2 className="text-5xl font-[1000] text-white tracking-tighter uppercase leading-[0.8]">YAHOOO!</h2>
                      <div className="glass-card bg-white/10 p-8 rounded-[2.5rem] border-white/20 shadow-2xl">
                        <p className="text-xl font-[900] text-secondary uppercase tracking-tight mb-4">"{celebrationProject}"</p>
                        <p className="text-[18px] font-black text-white leading-relaxed uppercase tracking-widest text-center">
                          chúc mừng bạn đã hoàn thành nhiệm vụ.<br/>
                          <span className="text-secondary">Tiền về tiền về yahooo</span>
                        </p>
                      </div>
                  </div>
                  <button 
                    onClick={() => setCelebrationProject(null)}
                    className="w-full bg-white text-secondary py-7 rounded-[2.5rem] font-[1000] text-[14px] uppercase tracking-[0.5em] shadow-2xl active:scale-95 transition-all hover:bg-secondary hover:text-white"
                  >
                    NHẬN THƯỞNG
                  </button>
              </div>
          </div>
      )}

      {/* AI SUGGESTION MODAL */}
      {isAiModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-3xl px-6">
              <div className="glass-card w-full max-w-sm rounded-[3rem] p-10 border-0 shadow-2xl animate-in zoom-in-95 bg-gradient-to-br from-surface to-background">
                  <div className="text-center mb-10">
                      <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-6 neon-glow-primary">
                          <Sparkles size={36} />
                      </div>
                      <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase">AI SUGGESTION</h3>
                  </div>
                  <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Ý tưởng kiếm tiền</label>
                        <textarea 
                            className="w-full bg-foreground/5 border-0 rounded-[2rem] p-6 text-foreground font-bold focus:ring-2 focus:ring-primary focus:outline-none resize-none h-40 text-sm leading-relaxed uppercase tracking-tight"
                            placeholder="VD: Mở khóa học Online, Bán đồ handmade..."
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-4">
                          <button onClick={() => setIsAiModalOpen(false)} className="flex-1 py-6 rounded-2xl font-black text-[11px] text-foreground/30 uppercase tracking-widest hover:text-foreground transition-all">HỦY</button>
                          <button 
                              onClick={handleGeneratePlan}
                              disabled={isGenerating || !aiPrompt}
                              className="flex-[2] py-6 rounded-2xl font-black text-[11px] text-white bg-primary shadow-2xl neon-glow-primary uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all"
                          >
                              {isGenerating ? 'ĐANG LẬP...' : 'LẬP KẾ HOẠCH'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT MODAL - FIXED SCROLLING ISSUE */}
      {isEditOpen && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-3xl p-4 sm:p-6">
              <div className="glass-card w-full max-w-md max-h-[92vh] flex flex-col rounded-[3rem] shadow-2xl border-0 bg-surface/95 overflow-hidden">
                  
                  {/* Fixed Header */}
                  <div className="flex justify-between items-center p-8 pb-4 shrink-0">
                      <h3 className="text-xl font-[1000] text-foreground tracking-tighter uppercase">CHI TIẾT DỰ ÁN</h3>
                      <button onClick={() => setIsEditOpen(false)} className="p-2 bg-foreground/5 rounded-2xl text-foreground hover:text-primary transition-all"><X size={20} /></button>
                  </div>

                  {/* Scrollable Content Area */}
                  <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6 no-scrollbar">
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Tên dự án</label>
                          <input 
                              className="w-full bg-foreground/5 text-foreground p-4 rounded-[1.5rem] font-[800] focus:ring-2 focus:ring-primary focus:outline-none text-xs uppercase tracking-tight"
                              value={editingProject.name}
                              onChange={e => setEditingProject(prev => ({...prev, name: e.target.value}))}
                          />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Kỳ vọng doanh thu (VND)</label>
                          <input 
                              type="number"
                              className="w-full bg-foreground/5 text-secondary text-2xl font-[900] p-4 rounded-[1.5rem] focus:outline-none tracking-tighter"
                              value={editingProject.expectedIncome}
                              onChange={e => setEditingProject(prev => ({...prev, expectedIncome: Number(e.target.value)}))}
                          />
                      </div>

                      {/* Milestones Area */}
                      <div className="space-y-4 pt-4 border-t border-foreground/5">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[9px] font-black text-foreground/40 uppercase tracking-[0.2em]">Các bước thực hiện</h4>
                            <button onClick={handleAddMilestone} className="text-primary text-[8px] font-black uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-xl active:scale-95 transition-all">+ THÊM BƯỚC</button>
                        </div>
                        <div className="space-y-3">
                            {editingProject.milestones?.map((m, idx) => (
                                <div key={m.id} className="glass-card bg-foreground/5 p-4 rounded-[1.75rem] space-y-3 border-0 shadow-inner">
                                    <div className="flex items-center gap-3">
                                        <input 
                                            className="flex-1 bg-transparent border-0 focus:outline-none text-xs font-bold text-foreground uppercase tracking-tight"
                                            placeholder="Tên công việc..."
                                            value={m.title}
                                            onChange={e => updateMilestone(idx, 'title', e.target.value)}
                                        />
                                        <button onClick={() => removeMilestone(idx)} className="text-danger/40 hover:text-danger transition-all p-1.5"><Trash2 size={16} /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[7px] font-black text-foreground/20 uppercase tracking-widest ml-1">Bắt đầu</label>
                                            <input 
                                                type="date"
                                                className="w-full bg-foreground/5 border-0 rounded-lg p-2 text-[9px] font-black text-foreground focus:outline-none"
                                                value={m.startDate}
                                                onChange={e => updateMilestone(idx, 'startDate', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[7px] font-black text-foreground/20 uppercase tracking-widest ml-1">Hạn chót</label>
                                            <input 
                                                type="date"
                                                className="w-full bg-foreground/5 border-0 rounded-lg p-2 text-[9px] font-black text-foreground focus:outline-none"
                                                value={m.date}
                                                onChange={e => updateMilestone(idx, 'date', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                      </div>

                      {/* Fixed Button within scrollable to ensure visibility */}
                      <button onClick={handleSaveProject} className="w-full bg-primary text-white font-[900] py-5 rounded-[1.75rem] text-[10px] uppercase tracking-[0.3em] shadow-2xl neon-glow-primary mt-4 active:scale-95 transition-all flex items-center justify-center gap-2">
                        LƯU KẾ HOẠCH <CheckCircle size={16} />
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
