/* ═══ TaskFormModal — Add/Edit task with sub-tasks + live XP ═══ */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { calculateTaskXP } from '@/types/task';
import type { EarningTask } from '@/types/task';
import './TaskFormModal.css';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; expectedAmount: number; startDate: string; endDate: string; subTasks?: { name: string }[] }) => void;
  editTask?: EarningTask | null;
  onUpdate?: (id: string, data: Partial<Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'>>) => void;
}

export default function TaskFormModal({ isOpen, onClose, onSubmit, editTask, onUpdate }: TaskFormModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [subTasks, setSubTasks] = useState<string[]>([]);
  const [newSub, setNewSub] = useState('');

  const isEditMode = !!editTask;

  // Fill form in edit mode
  useEffect(() => {
    if (editTask) {
      setName(editTask.name);
      setAmount(String(editTask.expectedAmount));
      setStartDate(editTask.startDate.slice(0, 10));
      setEndDate(editTask.endDate.slice(0, 10));
      setSubTasks(editTask.subTasks.map((st) => st.name));
    } else {
      setName(''); setAmount(''); setStartDate(''); setEndDate(''); setSubTasks([]);
    }
  }, [editTask, isOpen]);

  // Live XP calculation
  const parsedAmount = Number(amount.replace(/\D/g, '')) || 0;
  const estimatedXP = calculateTaskXP(parsedAmount, subTasks.length);

  const addSubTask = () => {
    if (!newSub.trim()) return;
    setSubTasks([...subTasks, newSub.trim()]);
    setNewSub('');
  };

  const removeSubTask = (i: number) => {
    setSubTasks(subTasks.filter((_, idx) => idx !== i));
  };

  const handleSubmit = () => {
    if (!name || !amount || !startDate || !endDate) return;

    if (isEditMode && onUpdate && editTask) {
      onUpdate(editTask.id, {
        name,
        expectedAmount: parsedAmount,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
    } else {
      onSubmit({
        name,
        expectedAmount: parsedAmount,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        subTasks: subTasks.map((s) => ({ name: s })),
      });
    }

    setName(''); setAmount(''); setStartDate(''); setEndDate(''); setSubTasks([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="tfm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="tfm-panel"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="tfm-top">
              <h3 className="tfm-title">{isEditMode ? '✏️ Chỉnh sửa nhiệm vụ' : '💰 Thêm nhiệm vụ kiếm tiền'}</h3>
              <button className="tfm-close" onClick={onClose}><X size={18} /></button>
            </div>

            <div className="tfm-field">
              <label className="tfm-label">Tên nhiệm vụ</label>
              <input className="input" placeholder="VD: Freelance thiết kế" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="tfm-field">
              <label className="tfm-label">Tiền kỳ vọng (VNĐ)</label>
              <input className="input" placeholder="VD: 3000000" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="tfm-row">
              <div className="tfm-field tfm-field--half">
                <label className="tfm-label">Ngày bắt đầu</label>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="tfm-field tfm-field--half">
                <label className="tfm-label">Ngày kết thúc</label>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Sub-tasks section */}
            {!isEditMode && (
              <div className="tfm-field">
                <label className="tfm-label">📋 Checklist (Bước thực hiện)</label>
                {subTasks.map((st, i) => (
                  <div key={i} className="tfm-sub-item">
                    <span className="tfm-sub-num">{i + 1}</span>
                    <span className="tfm-sub-text">{st}</span>
                    <button className="tfm-sub-remove" onClick={() => removeSubTask(i)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <div className="tfm-sub-add">
                  <input
                    className="input"
                    placeholder="VD: Liên hệ khách hàng"
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSubTask()}
                  />
                  <button className="tfm-sub-add-btn" onClick={addSubTask} type="button">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Live XP estimation */}
            <div className="tfm-xp-estimate">
              <span className="tfm-xp-label">⚡ Ước tính XP:</span>
              <span className="tfm-xp-value">{estimatedXP} XP</span>
            </div>

            <button className="tfm-submit" onClick={handleSubmit} disabled={!name || !amount || !startDate || !endDate}>
              <Plus size={16} /> <span>{isEditMode ? 'Cập nhật' : 'Tạo nhiệm vụ'}</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
