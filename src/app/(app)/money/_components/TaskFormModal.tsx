/* ═══ TaskFormModal — Add/Edit task: 3 trường bắt buộc + "Thêm chi tiết" + live XP ═══
 * Đợt 1: bắt buộc chỉ Tên · Kỳ vọng · Hạn xong. Gập trong "Thêm chi tiết": khách, ngày bắt đầu,
 * hẹn ngày trả, checklist. Mở từ Thư viện mẫu → `draft` điền sẵn (mở sẵn "Thêm chi tiết" để thấy checklist).
 */
'use client';

import { useState } from 'react';
import { formatAmountInput } from '@/utils/formatCurrency';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { calculateTaskXP, PAYER_NAME_MAX } from '@/types/task';
import type { EarningTask } from '@/types/task';
import { getEarningTemplate } from '@/data/earningTemplates';
import './earningTheme.css';
import './TaskFormModal.css';

export interface TaskDraft {
  name: string;
  expectedAmount: number;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  templateId?: string;
  subTasks: { name: string }[];
}

export interface TaskFormSubmit {
  name: string;
  expectedAmount: number;
  startDate: string;
  endDate: string;
  subTasks?: { name: string }[];
  payerName?: string;
  paymentDueDate?: string;
  templateId?: string;
}

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormSubmit) => void;
  editTask?: EarningTask | null;
  /** Điền sẵn từ Thư viện mẫu. */
  draft?: TaskDraft | null;
  onUpdate?: (id: string, data: Partial<Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate' | 'payerName' | 'paymentDueDate'>>) => void;
}

/** Ngày lịch ĐỊA PHƯƠNG "YYYY-MM-DD" từ ISO hoặc date-only (không để UTC làm lệch 1 ngày). */
export function toLocalKey(value: string | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" → ISO của đầu ngày (start) hoặc cuối ngày (end) theo giờ máy. */
export function localKeyToIso(key: string, edge: 'start' | 'end'): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = edge === 'start' ? new Date(y, m - 1, d, 0, 0, 0) : new Date(y, m - 1, d, 23, 59, 59);
  return dt.toISOString();
}

function todayKey(): string {
  return toLocalKey(new Date().toISOString());
}

export default function TaskFormModal(props: TaskFormModalProps) {
  const { isOpen, editTask, draft } = props;
  // Remount thân form mỗi lần mở / đổi nguồn dữ liệu → state khởi tạo đúng, không cần effect nạp lại.
  const formKey = editTask ? `edit-${editTask.id}` : draft ? `draft-${draft.templateId ?? draft.name}` : 'new';
  return (
    <AnimatePresence>
      {isOpen && <FormBody key={formKey} {...props} />}
    </AnimatePresence>
  );
}

function initialState(editTask: EarningTask | null | undefined, draft: TaskDraft | null | undefined) {
  if (editTask) {
    return {
      name: editTask.name,
      // Nạp qua formatAmountInput để mở form SỬA cũng thấy dấu chấm, không phải chỉ lúc gõ tay.
      amount: formatAmountInput(String(editTask.expectedAmount)),
      startDate: toLocalKey(editTask.startDate),
      endDate: toLocalKey(editTask.endDate),
      payer: editTask.payerName ?? '',
      dueDate: toLocalKey(editTask.paymentDueDate),
      subTasks: editTask.subTasks.map((st) => st.name),
      moreOpen: !!(editTask.payerName || editTask.paymentDueDate),
    };
  }
  if (draft) {
    return {
      name: draft.name,
      amount: formatAmountInput(String(draft.expectedAmount)),
      startDate: draft.startDate,
      endDate: draft.endDate,
      payer: '',
      dueDate: '',
      subTasks: draft.subTasks.map((st) => st.name),
      moreOpen: true,
    };
  }
  return { name: '', amount: '', startDate: todayKey(), endDate: '', payer: '', dueDate: '', subTasks: [] as string[], moreOpen: false };
}

function FormBody({ onClose, onSubmit, editTask, draft, onUpdate }: TaskFormModalProps) {
  const [init] = useState(() => initialState(editTask, draft));
  const [name, setName] = useState(init.name);
  const [amount, setAmount] = useState(init.amount);
  const [startDate, setStartDate] = useState(init.startDate);
  const [endDate, setEndDate] = useState(init.endDate);
  const [payer, setPayer] = useState(init.payer);
  const [dueDate, setDueDate] = useState(init.dueDate);
  const [subTasks, setSubTasks] = useState<string[]>(init.subTasks);
  const [newSub, setNewSub] = useState('');
  const [moreOpen, setMoreOpen] = useState(init.moreOpen);

  const isEditMode = !!editTask;
  const tpl = !isEditMode && draft?.templateId ? getEarningTemplate(draft.templateId) : undefined;

  // Live XP calculation
  const parsedAmount = Number(amount.replace(/\D/g, '')) || 0;
  const estimatedXP = calculateTaskXP(parsedAmount, subTasks.length);
  const effectiveStart = startDate || todayKey();
  const dateError = endDate && endDate < effectiveStart ? 'Hạn xong phải sau ngày bắt đầu.' : null;
  const canSubmit = !!name.trim() && parsedAmount > 0 && !!endDate && !dateError;

  const addSubTask = () => {
    if (!newSub.trim()) return;
    setSubTasks([...subTasks, newSub.trim()]);
    setNewSub('');
  };

  const removeSubTask = (i: number) => {
    setSubTasks(subTasks.filter((_, idx) => idx !== i));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const base = {
      name: name.trim(),
      expectedAmount: parsedAmount,
      startDate: localKeyToIso(effectiveStart, 'start'),
      endDate: localKeyToIso(endDate, 'end'),
      payerName: payer.trim() || undefined,
      paymentDueDate: dueDate || undefined,
    };

    if (isEditMode && onUpdate && editTask) {
      onUpdate(editTask.id, base);
    } else {
      onSubmit({
        ...base,
        subTasks: subTasks.map((s) => ({ name: s })),
        templateId: draft?.templateId,
      });
    }
    onClose();
  };

  return (
        <>
          <motion.div className="tfm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="tfm-panel"
            data-tid={tpl?.themeId ?? 'freelance'}
            role="dialog"
            aria-modal="true"
            aria-label={isEditMode ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ kiếm tiền'}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="tfm-top">
              <h3 className="tfm-title">
                {isEditMode ? '✏️ Chỉnh sửa nhiệm vụ' : tpl ? `${tpl.emoji} Bắt đầu việc này` : '💰 Thêm nhiệm vụ kiếm tiền'}
              </h3>
              <button type="button" className="tfm-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
            </div>

            {tpl && (
              <p className="tfm-tpl-note">Đã điền sẵn từ mẫu — sửa tên, tiền, hạn cho đúng việc của bạn.</p>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="tfm-field">
                <label className="tfm-label" htmlFor="tfm-name">Tên việc</label>
                <input id="tfm-name" className="input" placeholder="VD: Thiết kế banner cho shop" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>

              <div className="tfm-row">
                <div className="tfm-field tfm-field--half">
                  <label className="tfm-label" htmlFor="tfm-amount">Kỳ vọng nhận (đ)</label>
                  <input
                    id="tfm-amount"
                    className="input"
                    placeholder="VD: 300.000"
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  />
                </div>
                <div className="tfm-field tfm-field--half">
                  <label className="tfm-label" htmlFor="tfm-end">Hạn xong</label>
                  <input id="tfm-end" className="input" type="date" value={endDate} min={effectiveStart} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              {dateError && <p className="tfm-error" role="alert">{dateError}</p>}

              <button
                type="button"
                className="tfm-more"
                onClick={() => setMoreOpen(!moreOpen)}
                aria-expanded={moreOpen}
                aria-controls="tfm-more-body"
              >
                <span>Thêm chi tiết</span>
                <small>khách · ngày bắt đầu · hẹn trả{!isEditMode ? ' · checklist' : ''}</small>
                <ChevronDown size={16} className={moreOpen ? 'tfm-more-ico is-open' : 'tfm-more-ico'} aria-hidden="true" />
              </button>

              {moreOpen && (
                <div id="tfm-more-body" className="tfm-more-body">
                  <div className="tfm-field">
                    <label className="tfm-label" htmlFor="tfm-payer">Khách / người trả</label>
                    <input id="tfm-payer" className="input" placeholder="VD: Chị Lan" value={payer} maxLength={PAYER_NAME_MAX} onChange={(e) => setPayer(e.target.value)} autoComplete="off" />
                  </div>

                  <div className="tfm-row">
                    <div className="tfm-field tfm-field--half">
                      <label className="tfm-label" htmlFor="tfm-start">Ngày bắt đầu</label>
                      <input id="tfm-start" className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="tfm-field tfm-field--half">
                      <label className="tfm-label" htmlFor="tfm-due">Hẹn ngày trả</label>
                      <input id="tfm-due" className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>

                  {!isEditMode && (
                    <div className="tfm-field">
                      <span className="tfm-label">📋 Checklist (các bước)</span>
                      {subTasks.map((st, i) => (
                        <div key={`${i}-${st}`} className="tfm-sub-item">
                          <span className="tfm-sub-num">{i + 1}</span>
                          <span className="tfm-sub-text">{st}</span>
                          <button type="button" className="tfm-sub-remove" onClick={() => removeSubTask(i)} aria-label={`Xoá bước ${st}`}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <div className="tfm-sub-add">
                        <input
                          className="input"
                          placeholder="VD: Liên hệ khách hàng"
                          value={newSub}
                          aria-label="Thêm bước"
                          onChange={(e) => setNewSub(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubTask(); } }}
                        />
                        <button className="tfm-sub-add-btn" onClick={addSubTask} type="button" aria-label="Thêm bước">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live XP estimation */}
              <div className="tfm-xp-estimate">
                <span className="tfm-xp-label">⚡ Ước tính XP:</span>
                <span className="tfm-xp-value">{estimatedXP} XP</span>
              </div>

              <button type="submit" className="tfm-submit" disabled={!canSubmit}>
                <Plus size={16} /> <span>{isEditMode ? 'Cập nhật' : 'Tạo nhiệm vụ'}</span>
              </button>
            </form>
          </motion.div>
        </>
  );
}
