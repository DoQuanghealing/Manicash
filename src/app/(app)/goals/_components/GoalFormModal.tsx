/* ═══ GoalFormModal — Add/Edit Goal ═══ */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import './GoalFormModal.css';

const GOAL_ICONS = ['🏠', '🚗', '🛡️', '📈', '✈️', '💍', '🎓', '🏖️', '💻', '🎁'];
const GOAL_COLORS = ['#7C3AED', '#22C55E', '#3B82F6', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1'];

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; icon: string; targetAmount: number; deadline: string; color: string; currentAmount: number }) => void;
}

export default function GoalFormModal({ isOpen, onClose, onSubmit }: GoalFormModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏠');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('#7C3AED');

  const handleSubmit = () => {
    if (!name || !target || !deadline) return;
    onSubmit({
      name,
      icon,
      targetAmount: Number(target.replace(/\D/g, '')),
      deadline,
      color,
      currentAmount: 0,
    });
    setName(''); setTarget(''); setDeadline('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="gfm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="gfm-panel"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="gfm-top">
              <h3 className="gfm-title">Thêm mục tiêu mới</h3>
              <button className="gfm-close" onClick={onClose}><X size={18} /></button>
            </div>

            <div className="gfm-field">
              <label className="gfm-label">Tên mục tiêu</label>
              <input className="input" placeholder="VD: Mua nhà" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="gfm-field">
              <label className="gfm-label">Biểu tượng</label>
              <div className="gfm-icon-grid">
                {GOAL_ICONS.map((ic) => (
                  <button key={ic} className={`gfm-icon-btn ${icon === ic ? 'gfm-icon-btn--active' : ''}`} onClick={() => setIcon(ic)}>{ic}</button>
                ))}
              </div>
            </div>

            <div className="gfm-field">
              <label className="gfm-label">Số tiền mục tiêu (VNĐ)</label>
              <input className="input" placeholder="VD: 6000000000" type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>

            <div className="gfm-field">
              <label className="gfm-label">Deadline</label>
              <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>

            <div className="gfm-field">
              <label className="gfm-label">Màu sắc</label>
              <div className="gfm-color-grid">
                {GOAL_COLORS.map((c) => (
                  <button key={c} className={`gfm-color-btn ${color === c ? 'gfm-color-btn--active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>

            <button className="gfm-submit" onClick={handleSubmit} disabled={!name || !target || !deadline}>
              <Plus size={16} />
              <span>Tạo mục tiêu</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
