import React, { useEffect, useState } from 'react';
import { Transaction, User, IncomeProject, Milestone, Category, TransactionType, FinancialReport } from '../types';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/storageService';
import { VI } from '../constants/vi';
import { formatVND } from '../utils/format';
import { Sparkles, Plus, Calendar, CheckSquare, Square, Trash2, ArrowRight, Wallet, CheckCircle, Save, TrendingUp, Activity, Target, Zap, BarChart2, AlertTriangle } from 'lucide-react';

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

  // Show all projects
  const userProjects = projects;

  const handleGenerateReport = async () => {
      setIsReportLoading(true);
      const goals = StorageService.getGoals();
      const fixedCosts = StorageService.getFixedCosts();
      const result = await GeminiService.generateComprehensiveReport(transactions, goals, projects, fixedCosts);
      setReport(result);
      setIsReportLoading(false);
  };

  // --- CRUD Logic (Same as before) ---
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
      if (!editingProject.name?.trim()) {
          alert("Vui lòng nhập tên Dự án / Công việc!");
          return;
      }
      if (!editingProject.startDate) {
          alert("Vui lòng chọn ngày bắt đầu!");
          return;
      }

      const projectToSave: IncomeProject = {
          id: editingProject.id || `p_${Date.now()}`,
          userId: editingProject.userId || activeUser.id,
          name: editingProject.name.trim(),
          description: editingProject.description || '',
          expectedIncome: Number(editingProject.expectedIncome) || 0,
          startDate: editingProject.startDate,
          endDate: editingProject.endDate || '',
          status: editingProject.status || 'planning',
          milestones: editingProject.milestones || []
      };

      if (editingProject.id) {
          StorageService.updateIncomeProject(projectToSave);
      } else {
          StorageService.addIncomeProject(projectToSave);
      }
      loadProjects();
      setIsEditOpen(false);
  };

  const handleAddMilestone = () => {
      const newM: Milestone = {
          id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: '',
          date: '',
          isCompleted: false
      };
      setEditingProject(prev => ({
          ...prev,
          milestones: [...(prev.milestones || []), newM]
      }));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: any) => {
      setEditingProject(prev => {
          const ms = [...(prev.milestones || [])];
          if (ms[index]) {
            ms[index] = { ...ms[index], [field]: value };
          }
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
      updatedProject.milestones = project.milestones.map((m, idx) => 
          idx === mIndex ? { ...m, isCompleted: !m.isCompleted } : m
      );
      
      const allDone = updatedProject.milestones.every(m => m.isCompleted);
      if (allDone && updatedProject.status !== 'completed') {
          updatedProject.status = 'completed';
      } else if (!allDone && updatedProject.status === 'completed') {
          updatedProject.status = 'in_progress';
      }

      StorageService.updateIncomeProject(updatedProject);
      loadProjects();
  };

  const handleGeneratePlan = async () => {
      if (!aiPrompt) return;
      setIsGenerating(true);
      const plan = await GeminiService.generateIncomePlan(aiPrompt);
      setIsGenerating(false);

      if (plan) {
          setIsAiModalOpen(false);
          const today = new Date();
          
          const newMilestones: Milestone[] = plan.milestones.map((m: any, idx: number) => {
               const d = new Date(today);
               d.setDate(d.getDate() + (m.daysFromNow || idx));
               return {
                   id: `m_ai_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                   title: m.title,
                   date: d.toISOString().split('T')[0],
                   isCompleted: false
               };
          });

          setEditingProject({
              id: '',
              userId: activeUser.id,
              name: plan.name,
              description: plan.description,
              expectedIncome: plan.expectedIncome,
              startDate: today.toISOString().split('T')[0],
              endDate: '',
              status: 'planning',
              milestones: newMilestones
          });
          setIsEditOpen(true);
      }
  };

  const handleCollectMoney = (project: IncomeProject) => {
      const amount = project.expectedIncome;
      if (amount <= 0) return;

      const confirmMsg = `Hoàn thành dự án "${project.name}" và nạp ${formatVND(amount)} vào ví của ${activeUser?.name}?`;
      if (confirm(confirmMsg)) {
          const allWallets = StorageService.getWallets();
          const targetWallet = allWallets.find(w => w.userId === project.userId) || allWallets[0];
          
          StorageService.addTransaction({
              id: `tx_inc_${Date.now()}`,
              date: new Date().toISOString(),
              amount: amount,
              type: TransactionType.INCOME,
              category: Category.INCOME,
              walletId: targetWallet.id,
              description: `Thu nhập: ${project.name}`,
              timestamp: Date.now()
          });
          
          alert("Đã cộng tiền thành công! 🎉");
          loadProjects();
      }
  };

  const renderPlanningTab = () => (
      <>
        {userProjects.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 bg-surface rounded-3xl border border-white/5 border-dashed">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>Chưa có kế hoạch nào.</p>
                <button onClick={handleOpenCreate} className="mt-4 text-primary font-bold">{VI.insights.createBtn}</button>
            </div>
        ) : (
            <div className="space-y-4">
                {userProjects.map(project => {
                    const completedCount = project.milestones.filter(m => m.isCompleted).length;
                    const totalCount = project.milestones.length;
                    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    
                    return (
                        <div key={project.id} className="bg-surface border border-white/10 rounded-3xl p-5 shadow-lg relative overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-lg font-bold text-white cursor-pointer hover:text-primary transition-colors" onClick={() => handleOpenEdit(project)}>
                                        {project.name}
                                    </h3>
                                    <p className="text-xs text-zinc-400">{project.description}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-emerald-400 font-bold block">{formatVND(project.expectedIncome)}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${project.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-zinc-400'}`}>
                                        {VI.insights.project.status[project.status]}
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-2 w-full bg-black/40 rounded-full mt-3 mb-4 overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
                            </div>

                            {/* Milestones Preview */}
                            <div className="space-y-2">
                                {project.milestones.map((m, idx) => (
                                    <div key={m.id} className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                                        <button onClick={() => toggleMilestoneInView(project, idx)}>
                                            {m.isCompleted ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} className="text-zinc-600" />}
                                        </button>
                                        <div className="flex-1">
                                            <p className={`text-sm ${m.isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{m.title}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                                <button onClick={() => handleDelete(project.id)} className="text-zinc-600 hover:text-red-400 p-2">
                                    <Trash2 size={18} />
                                </button>
                                {project.status === 'completed' ? (
                                    <button onClick={() => handleCollectMoney(project)} className="flex items-center space-x-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl font-bold hover:bg-emerald-500/30">
                                        <Wallet size={16} /> <span>{VI.insights.project.collect}</span>
                                    </button>
                                ) : (
                                    <button onClick={() => handleOpenEdit(project)} className="flex items-center space-x-2 text-zinc-400 hover:text-white px-2">
                                        <span className="text-xs">Chi tiết</span> <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                <button onClick={handleOpenCreate} className="w-full py-4 border border-dashed border-white/20 rounded-3xl text-zinc-400 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center space-x-2">
                    <Plus size={20} /> <span>{VI.insights.createBtn}</span>
                </button>
            </div>
        )}
      </>
  );

  const renderReportTab = () => (
      <div className="space-y-6">
          {!report ? (
              <div className="text-center py-10 bg-surface rounded-3xl border border-white/5">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Sparkles size={32} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">AI Phân tích Toàn diện</h3>
                  <p className="text-zinc-400 text-sm mb-6 max-w-[250px] mx-auto">
                      Đánh giá sức khỏe tài chính, tốc độ hoàn thành dự án và khả năng đạt mục tiêu.
                  </p>
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isReportLoading}
                    className="bg-white text-black font-bold py-3 px-8 rounded-full shadow-lg shadow-white/10 active:scale-95 transition-all"
                  >
                      {isReportLoading ? VI.insights.report.generating : VI.insights.report.btnGenerate}
                  </button>
              </div>
          ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Scorecard */}
                  <div className="bg-gradient-to-br from-surfaceHighlight to-surface border border-white/5 rounded-3xl p-6 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">{VI.insights.report.healthScore}</h3>
                      <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                          {/* Simple CSS Circle */}
                          <svg className="w-full h-full transform -rotate-90">
                              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className={report.healthScore > 70 ? "text-emerald-500" : report.healthScore > 40 ? "text-amber-500" : "text-red-500"} strokeDasharray={351} strokeDashoffset={351 - (351 * report.healthScore) / 100} />
                          </svg>
                          <span className="absolute text-4xl font-black text-white">{report.healthScore}</span>
                      </div>
                  </div>

                  {/* Income Trend */}
                  <div className="bg-surface border border-white/10 rounded-3xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-xl ${report.incomeTrend.status === 'higher' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              <TrendingUp size={20} />
                          </div>
                          <h4 className="font-bold text-white">{VI.insights.report.incomeTrend}</h4>
                      </div>
                      <div className="flex items-end gap-2 h-24 mt-4 px-4 pb-2 border-b border-white/5 relative">
                          <div className="w-1/2 bg-white/10 rounded-t-lg h-[60%] relative group">
                             <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-zinc-500">Tháng trước</span>
                          </div>
                          <div className={`w-1/2 rounded-t-lg relative group transition-all h-[${Math.min(100, 60 + (report.incomeTrend.status === 'higher' ? 20 : -20))}%] ${report.incomeTrend.status === 'higher' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                             <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white">Tháng này</span>
                          </div>
                      </div>
                      <p className="text-sm text-zinc-400 mt-3 italic">"{report.incomeTrend.message}"</p>
                  </div>

                  {/* Project Velocity */}
                  <div className="bg-surface border border-white/10 rounded-3xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                           <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                              <Activity size={20} />
                          </div>
                          <h4 className="font-bold text-white">{VI.insights.report.projectVelocity}</h4>
                      </div>
                      <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl mb-3">
                          <span className="text-zinc-400 text-sm">Đánh giá:</span>
                          <span className={`font-bold ${report.projectVelocity.rating === 'High' ? 'text-emerald-400' : 'text-amber-400'}`}>{report.projectVelocity.rating}</span>
                      </div>
                      <p className="text-sm text-zinc-400 italic">"{report.projectVelocity.message}"</p>
                  </div>

                  {/* Goal Forecast */}
                  <div className="bg-surface border border-white/10 rounded-3xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                           <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                              <Target size={20} />
                          </div>
                          <h4 className="font-bold text-white">{VI.insights.report.goalForecast}</h4>
                      </div>
                      <div className="space-y-3">
                          <div className="flex items-center gap-2">
                              {report.goalForecast.canMeetFixedCosts ? <CheckCircle size={16} className="text-emerald-500"/> : <AlertTriangle size={16} className="text-red-500"/>}
                              <span className="text-sm text-zinc-300">{VI.insights.report.fixedCostStatus}: <span className={report.goalForecast.canMeetFixedCosts ? "text-emerald-400" : "text-red-400"}>{report.goalForecast.canMeetFixedCosts ? "Ổn định" : "Rủi ro"}</span></span>
                          </div>
                          <div className="bg-white/5 p-3 rounded-xl border-l-2 border-indigo-500">
                              <p className="text-sm text-white font-medium mb-1">{report.goalForecast.majorGoalPrediction}</p>
                              <p className="text-xs text-zinc-500">{VI.insights.report.advice}: {report.goalForecast.advice}</p>
                          </div>
                      </div>
                  </div>
                  
                  <button onClick={handleGenerateReport} className="w-full py-3 text-sm text-zinc-500 hover:text-white transition-colors">
                      <Zap size={14} className="inline mr-1" /> Làm mới phân tích
                  </button>
              </div>
          )}
      </div>
  );

  return (
    <div className="p-4 pt-8 space-y-6 pb-24">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Sparkles className="mr-2 text-primary" />
          {VI.insights.title}
        </h2>
        {activeTab === 'planning' && (
            <button 
                onClick={() => setIsAiModalOpen(true)}
                className="flex items-center space-x-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform"
            >
                <Sparkles size={14} />
                <span>{VI.insights.aiSuggestBtn}</span>
            </button>
        )}
      </div>

      {/* TABS */}
      <div className="flex p-1 bg-black/30 rounded-xl border border-white/5">
          <button 
            onClick={() => setActiveTab('planning')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'planning' ? 'bg-surfaceHighlight text-white shadow' : 'text-zinc-500'}`}
          >
              {VI.insights.tabs.planning}
          </button>
          <button 
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'report' ? 'bg-surfaceHighlight text-white shadow' : 'text-zinc-500'}`}
          >
              {VI.insights.tabs.report}
          </button>
      </div>

      {activeTab === 'planning' ? renderPlanningTab() : renderReportTab()}

      {/* EDIT/CREATE PROJECT MODAL */}
      {isEditOpen && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="bg-surface w-full max-w-md h-[90vh] sm:h-auto overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white">{editingProject.id ? 'Chi tiết kế hoạch' : 'Tạo kế hoạch mới'}</h3>
                      <button onClick={() => setIsEditOpen(false)} className="p-2 bg-white/5 rounded-full"><Trash2 size={20} className="opacity-0" /></button>
                  </div>
                  
                  <div className="space-y-4">
                      {/* Name & Desc */}
                      <div>
                          <label className="text-xs text-zinc-400 ml-1">{VI.insights.project.name} <span className="text-danger">*</span></label>
                          <input 
                              autoFocus={!editingProject.id}
                              className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-primary focus:outline-none font-bold placeholder:font-normal"
                              placeholder={VI.insights.project.placeholderName}
                              value={editingProject.name}
                              onChange={e => setEditingProject(prev => ({...prev, name: e.target.value}))}
                          />
                      </div>
                      <div>
                          <label className="text-xs text-zinc-400 ml-1">{VI.insights.project.expected}</label>
                          <input 
                              type="number"
                              className="w-full bg-black/20 text-emerald-400 p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none font-bold"
                              value={editingProject.expectedIncome}
                              onChange={e => setEditingProject(prev => ({...prev, expectedIncome: Number(e.target.value)}))}
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-xs text-zinc-400 ml-1">{VI.insights.project.start} <span className="text-danger">*</span></label>
                              <input 
                                  type="date"
                                  className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-primary focus:outline-none"
                                  value={editingProject.startDate}
                                  onChange={e => setEditingProject(prev => ({...prev, startDate: e.target.value}))}
                              />
                          </div>
                          <div>
                              <label className="text-xs text-zinc-400 ml-1">{VI.insights.project.end}</label>
                              <input 
                                  type="date"
                                  className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-primary focus:outline-none"
                                  value={editingProject.endDate}
                                  onChange={e => setEditingProject(prev => ({...prev, endDate: e.target.value}))}
                              />
                          </div>
                      </div>

                      {/* Milestones Editor */}
                      <div className="pt-4 border-t border-white/10">
                          <div className="flex justify-between items-center mb-2">
                               <h4 className="text-sm font-bold text-white">{VI.insights.project.milestones}</h4>
                               <button 
                                 type="button"
                                 onClick={handleAddMilestone} 
                                 className="text-primary text-xs font-bold flex items-center bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
                               >
                                   <Plus size={12} className="mr-1" /> {VI.insights.project.addMilestone}
                               </button>
                          </div>
                          <div className="space-y-3">
                              {editingProject.milestones?.length === 0 && (
                                  <p className="text-xs text-zinc-600 text-center py-2 italic">Chưa có nhiệm vụ nào.</p>
                              )}
                              {editingProject.milestones?.map((m, idx) => (
                                  <div key={m.id} className="bg-white/5 p-3 rounded-xl space-y-2 border border-white/5">
                                      <div className="flex items-center gap-2">
                                          <input 
                                              className="flex-1 bg-transparent border-b border-white/10 focus:border-primary focus:outline-none text-sm text-white placeholder:text-zinc-600"
                                              placeholder={VI.insights.project.placeholderMilestone}
                                              value={m.title}
                                              onChange={e => updateMilestone(idx, 'title', e.target.value)}
                                          />
                                          <button onClick={() => removeMilestone(idx)} className="text-red-500/50 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <Calendar size={14} className="text-zinc-500" />
                                          <input 
                                              type="date"
                                              className="bg-transparent text-xs text-zinc-400 focus:text-white focus:outline-none"
                                              value={m.date}
                                              onChange={e => updateMilestone(idx, 'date', e.target.value)}
                                          />
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex gap-3 pt-4 pb-4">
                          <button onClick={() => setIsEditOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-zinc-400 bg-white/5 hover:bg-white/10">{VI.settings.cancel}</button>
                          <button 
                            onClick={handleSaveProject} 
                            className="flex-1 py-3 rounded-xl font-bold text-white bg-primary shadow-lg shadow-violet-500/20 active:scale-95 transition-all flex items-center justify-center"
                          >
                              <Save size={18} className="mr-2" />
                              {VI.settings.save}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* AI SUGGESTION MODAL */}
      {isAiModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md px-4">
              <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-indigo-500/30 shadow-2xl animate-in zoom-in-95">
                  <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Sparkles size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-white">{VI.insights.aiModal.title}</h3>
                  </div>
                  
                  <div className="space-y-4">
                      <label className="text-xs text-zinc-400 block">{VI.insights.aiModal.inputLabel}</label>
                      <textarea 
                          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none resize-none h-24"
                          placeholder={VI.insights.aiModal.inputPlaceholder}
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                      />
                      
                      <div className="flex gap-3">
                          <button onClick={() => setIsAiModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-zinc-400 bg-white/5">{VI.settings.cancel}</button>
                          <button 
                              onClick={handleGeneratePlan}
                              disabled={isGenerating || !aiPrompt}
                              className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                              {isGenerating ? VI.insights.aiModal.generating : VI.insights.aiModal.generate}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};