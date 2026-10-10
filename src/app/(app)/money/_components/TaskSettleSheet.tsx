/* ═══ TaskSettleSheet — Xong việc → Chờ thanh toán / Nhận được bao nhiêu? (mẫu D) ═══
 * Spec: docs/SPEC_DOT_1_THU_VIEN_MAU.md §3.3–3.4.
 *   mode 'done'       → hỏi "Khách trả tiền chưa?" → nhận luôn / chờ thanh toán
 *   mode 'receive'    → thẳng hộp "Nhận được bao nhiêu?"
 *   mode 'reschedule' → chỉ hẹn lại ngày khách trả
 * Sheet KHÔNG tự ghi dữ liệu: trả lựa chọn cho MoneyContent qua callback (để gắn toast hoàn tác).
 */
'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from '@/hooks/useIsClient';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Banknote, Hourglass } from 'lucide-react';
import type { EarningTask } from '@/types/task';
import { getTaskStage, PAYER_NAME_MAX } from '@/types/task';
import { INCOME_CATEGORIES } from '@/data/categories';
import { templateVisualForTask } from '@/data/earningTemplates';
import { incomeCategoryForTask } from '@/lib/tasks/receiveTaskPayment';
import { formatAmountInput, formatCurrency } from '@/utils/formatCurrency';
import './earningTheme.css';
import './TaskSettleSheet.css';

export type SettleMode = 'done' | 'receive' | 'reschedule';

export interface ReceiveChoice {
  amount: number;
  method: 'cash' | 'transfer';
  categoryId: string;
  receivedAt: Date;
}

export interface AwaitChoice {
  payerName: string;
  paymentDueDate?: string;
}

interface Props {
  task: EarningTask | null;
  mode: SettleMode;
  onClose: () => void;
  /** Trả thông báo lỗi (string) nếu ghi không được — sheet giữ nguyên để người dùng sửa. */
  onReceive: (task: EarningTask, choice: ReceiveChoice) => string | null;
  onAwait: (task: EarningTask, choice: AwaitChoice) => void;
  onReschedule: (task: EarningTask, choice: AwaitChoice) => void;
}

type Step = 'ask' | 'receive' | 'await' | 'reschedule';

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** "YYYY-MM-DD" → Date 12:00 giờ máy (tránh lệch ngày khi đổi sang UTC). Hôm nay → bây giờ. */
function dateFromKey(key: string): Date {
  const now = new Date();
  if (key === localKey(now)) return now;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export default function TaskSettleSheet(props: Props) {
  const mounted = useIsClient();
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {props.task && <SettleBody key={`${props.task.id}-${props.mode}`} {...props} task={props.task} />}
    </AnimatePresence>,
    document.body,
  );
}

function SettleBody({ task, mode, onClose, onReceive, onAwait, onReschedule }: Props & { task: EarningTask }) {
  const initialStep: Step = mode === 'receive' ? 'receive' : mode === 'reschedule' ? 'reschedule' : 'ask';
  const [step, setStep] = useState<Step>(initialStep);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const visual = templateVisualForTask(task.templateId);

  const today = useMemo(() => new Date(), []);
  const todayKey = localKey(today);
  const minReceiveKey = localKey(addDays(today, -30));

  // ── Nhận tiền ──
  const [amount, setAmount] = useState(formatAmountInput(String(task.expectedAmount || '')));
  const [method, setMethod] = useState<'transfer' | 'cash'>('transfer');
  const [categoryId, setCategoryId] = useState(incomeCategoryForTask(task));
  const [receivedKey, setReceivedKey] = useState(todayKey);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Chờ thanh toán / hẹn lại ──
  const [payer, setPayer] = useState(task.payerName ?? '');
  const [dueKey, setDueKey] = useState(task.paymentDueDate?.slice(0, 10) ?? localKey(addDays(today, 3)));

  const parsed = Number(amount.replace(/\D/g, '')) || 0;
  const expected = task.expectedAmount || 0;
  const gap = expected > 0 ? (parsed - expected) / expected : 0;
  const gapNote = parsed > 0 && expected > 0 && Math.abs(gap) >= 0.2
    ? gap < 0
      ? `Thấp hơn kỳ vọng ${Math.round(-gap * 100)}%. Lần sau báo giá cao hơn chút nhé.`
      : `Hơn kỳ vọng ${Math.round(gap * 100)}%. Khách trả hơn mong đợi 👏`
    : null;

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (step === 'receive') amountRef.current?.select();
  }, [step]);

  const submitReceive = () => {
    if (submitting) return;
    if (receivedKey < minReceiveKey || receivedKey > todayKey) {
      setError('Ngày nhận phải trong 30 ngày gần đây, không ở tương lai.');
      return;
    }
    setSubmitting(true);
    const err = onReceive(task, { amount: parsed, method, categoryId, receivedAt: dateFromKey(receivedKey) });
    if (err) { setError(err); setSubmitting(false); }
  };

  const awaitChoice = (): AwaitChoice => ({
    payerName: payer.trim(),
    paymentDueDate: dueKey || undefined,
  });

  const stage = getTaskStage(task);
  const title =
    step === 'ask' ? 'Xong việc rồi! Khách trả tiền chưa?'
    : step === 'receive' ? 'Nhận được bao nhiêu?'
    : step === 'await' ? 'Chờ khách thanh toán'
    : 'Hẹn lại ngày khách trả';

  return (
    <>
      <motion.div className="tss-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        ref={panelRef}
        className="tss-sheet"
        data-tid={visual.themeId ?? 'freelance'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <span className="tss-grab" aria-hidden="true" />
        <button type="button" className="tss-x" onClick={onClose} aria-label="Đóng"><X size={18} /></button>

        <div className="tss-task">
          <span className="tss-emo" aria-hidden="true">{visual.emoji}</span>
          <p className="tss-task-name">{task.name}</p>
          <p className="tss-task-sub">
            Kỳ vọng {formatCurrency(expected)}
            {stage === 'awaiting_payment' && task.payerName ? ` · Khách: ${task.payerName}` : ''}
          </p>
        </div>

        <h2 id={titleId} className="tss-title">{title}</h2>

        {step === 'ask' && (
          <div className="tss-choices">
            <button type="button" className="tss-choice tss-choice--paid" onClick={() => setStep('receive')}>
              <Banknote size={22} aria-hidden="true" />
              <span><b>Đã nhận tiền luôn</b><small>Ghi khoản thu vào ví ngay</small></span>
            </button>
            <button type="button" className="tss-choice tss-choice--wait" onClick={() => setStep('await')}>
              <Hourglass size={22} aria-hidden="true" />
              <span><b>Khách chưa trả</b><small>Chuyển sang Chờ thanh toán để khỏi quên</small></span>
            </button>
          </div>
        )}

        {step === 'receive' && (
          <form
            className="tss-recv"
            onSubmit={(e) => { e.preventDefault(); submitReceive(); }}
          >
            <label className="tss-money">
              <input
                ref={amountRef}
                value={amount}
                onChange={(e) => { setAmount(formatAmountInput(e.target.value)); setError(null); }}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label="Số tiền thực nhận"
                placeholder="0"
              />
              <span aria-hidden="true">đ</span>
            </label>
            {gapNote && <p className="tss-gap" role="status">{gapNote}</p>}
            {parsed === 0 && <p className="tss-hint">Nhập 0 nếu làm không công — việc vẫn được khép, không ghi khoản thu.</p>}

            <div className="tss-row" role="radiogroup" aria-label="Vào ví">
              <span className="tss-row-label">Vào ví</span>
              <button type="button" role="radio" aria-checked={method === 'transfer'} className={`tss-seg${method === 'transfer' ? ' is-on' : ''}`} onClick={() => setMethod('transfer')}>Ví chính</button>
              <button type="button" role="radio" aria-checked={method === 'cash'} className={`tss-seg${method === 'cash' ? ' is-on' : ''}`} onClick={() => setMethod('cash')}>Tiền mặt</button>
            </div>

            <div className="tss-field">
              <span className="tss-row-label">Danh mục</span>
              <div className="tss-cats" role="radiogroup" aria-label="Danh mục thu">
                {INCOME_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={categoryId === c.id}
                    className={`tss-cat${categoryId === c.id ? ' is-on' : ''}`}
                    onClick={() => setCategoryId(c.id)}
                  >
                    <span aria-hidden="true">{c.icon}</span> {c.name}
                  </button>
                ))}
              </div>
            </div>

            <label className="tss-field tss-date">
              <span className="tss-row-label">Ngày nhận</span>
              <input
                type="date"
                className="input"
                value={receivedKey}
                min={minReceiveKey}
                max={todayKey}
                onChange={(e) => { setReceivedKey(e.target.value || todayKey); setError(null); }}
              />
            </label>

            {error && <p className="tss-error" role="alert">{error}</p>}

            <button type="submit" className="tss-main" disabled={submitting}>
              {parsed > 0 ? `Ghi nhận +${formatCurrency(parsed)}` : 'Khép việc, không ghi thu'}
            </button>
            {mode === 'done' && (
              <button type="button" className="tss-back" onClick={() => setStep('ask')}>Quay lại</button>
            )}
          </form>
        )}

        {(step === 'await' || step === 'reschedule') && (
          <form
            className="tss-await"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 'await') onAwait(task, awaitChoice());
              else onReschedule(task, awaitChoice());
            }}
          >
            <label className="tss-field">
              <span className="tss-row-label">Khách / người trả <em>(không bắt buộc)</em></span>
              <input
                className="input"
                value={payer}
                maxLength={PAYER_NAME_MAX}
                onChange={(e) => setPayer(e.target.value)}
                placeholder="VD: Chị Lan"
                autoComplete="off"
              />
            </label>
            <label className="tss-field">
              <span className="tss-row-label">Hẹn ngày trả <em>(không bắt buộc)</em></span>
              <input
                type="date"
                className="input"
                value={dueKey}
                min={step === 'reschedule' ? todayKey : undefined}
                onChange={(e) => setDueKey(e.target.value)}
              />
            </label>
            <p className="tss-hint">Việc chờ thanh toán không bị tính trễ hạn. Khách trả thì bấm “Đã nhận tiền”.</p>
            <button type="submit" className="tss-main tss-main--wait">
              {step === 'await' ? 'Chuyển sang Chờ thanh toán' : 'Lưu hẹn mới'}
            </button>
            {mode === 'done' && (
              <button type="button" className="tss-back" onClick={() => setStep('ask')}>Quay lại</button>
            )}
          </form>
        )}
      </motion.div>
    </>
  );
}
