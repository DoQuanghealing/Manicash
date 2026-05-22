/* ═══ IOSDatePicker — Wheel picker kiểu iOS (3 cột trượt) ═══
 *
 * Hiển thị: Ngày | Tháng | Năm — mỗi cột là 1 wheel scroll dọc.
 * Item ở giữa được highlight bằng 2 đường ngang (iOS native style).
 * Snap-to-item bằng CSS scroll-snap.
 *
 * Props:
 *   value     — YYYY-MM-DD (controlled). Nếu rỗng → default hôm nay.
 *   onChange  — callback (newDate: YYYY-MM-DD).
 *   minDate / maxDate — YYYY-MM-DD (optional).
 *
 * Lưu ý: ngày tự cap khi đổi tháng/năm (vd 31/2 → 28 hoặc 29 nếu nhuận).
 */
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './IOSDatePicker.css';

interface Props {
  value: string;       // YYYY-MM-DD
  onChange: (newDate: string) => void;
  minDate?: string;    // default 1900-01-01
  maxDate?: string;    // default today
}

const ITEM_HEIGHT = 40;

const MONTH_LABELS = [
  'Th 1', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6',
  'Th 7', 'Th 8', 'Th 9', 'Th 10', 'Th 11', 'Th 12',
];

/** Số ngày trong tháng (1-12), năm. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Parse YYYY-MM-DD → { y, m, d }. Trả về null nếu invalid. */
function parseISO(s: string | undefined): { y: number; m: number; d: number } | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = parseInt(s.slice(0, 4), 10);
  const m = parseInt(s.slice(5, 7), 10);
  const d = parseInt(s.slice(8, 10), 10);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** WheelColumn — 1 cột scroll wheel. */
interface WheelProps {
  items: Array<{ value: number; label: string }>;
  value: number;
  onChange: (newValue: number) => void;
  ariaLabel: string;
}

function WheelColumn({ items, value, onChange, ariaLabel }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettingRef = useRef(false);

  const selectedIndex = items.findIndex((it) => it.value === value);

  // Scroll to selected index khi value đổi từ ngoài (vd ngày cap theo tháng)
  useEffect(() => {
    if (!ref.current || selectedIndex < 0) return;
    isSettingRef.current = true;
    ref.current.scrollTo({ top: selectedIndex * ITEM_HEIGHT, behavior: 'smooth' });
    // Reset flag sau khi scroll xong
    const t = setTimeout(() => { isSettingRef.current = false; }, 400);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (isSettingRef.current) return;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const item = items[clamped];
      if (item && item.value !== value) {
        onChange(item.value);
      }
    }, 80);
  }, [items, value, onChange]);

  return (
    <div
      className="iosp-col"
      ref={ref}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
    >
      {/* Padding top */}
      <div className="iosp-pad" aria-hidden="true" />
      {items.map((it) => (
        <div
          key={it.value}
          className={`iosp-item ${it.value === value ? 'iosp-item--selected' : ''}`}
          role="option"
          aria-selected={it.value === value}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </div>
      ))}
      {/* Padding bottom */}
      <div className="iosp-pad" aria-hidden="true" />
    </div>
  );
}

export default function IOSDatePicker({ value, onChange, minDate, maxDate }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const min = parseISO(minDate) || { y: 1900, m: 1, d: 1 };
  const max = parseISO(maxDate) || parseISO(today)!;

  // State nội bộ — derive từ value hoặc default tới max (hôm nay)
  const [internal, setInternal] = useState(() => parseISO(value) || max);

  // Sync khi value props đổi từ ngoài — defer setState ngoài effect
  useEffect(() => {
    const parsed = parseISO(value);
    if (!parsed) return;
    queueMicrotask(() => setInternal(parsed));
  }, [value]);

  // Items cho 3 cột
  const years = useMemo(() => {
    const arr: Array<{ value: number; label: string }> = [];
    for (let y = max.y; y >= min.y; y--) {
      arr.push({ value: y, label: String(y) });
    }
    return arr;
  }, [min.y, max.y]);

  const months = useMemo(() => {
    return MONTH_LABELS.map((label, i) => ({ value: i + 1, label }));
  }, []);

  const days = useMemo(() => {
    const max_d = daysInMonth(internal.y, internal.m);
    const arr: Array<{ value: number; label: string }> = [];
    for (let d = 1; d <= max_d; d++) {
      arr.push({ value: d, label: String(d) });
    }
    return arr;
  }, [internal.y, internal.m]);

  // Khi user thay đổi 1 cột — cap ngày + emit
  const commit = useCallback((next: { y: number; m: number; d: number }) => {
    const cappedDay = Math.min(next.d, daysInMonth(next.y, next.m));
    const finalDate = { ...next, d: cappedDay };
    setInternal(finalDate);
    onChange(toISO(finalDate.y, finalDate.m, finalDate.d));
  }, [onChange]);

  return (
    <div className="iosp-wrap" role="group" aria-label="Chọn ngày sinh">
      {/* 2 đường ngang highlight giữa */}
      <div className="iosp-highlight" aria-hidden="true" />

      <div className="iosp-cols">
        <WheelColumn
          items={days}
          value={internal.d}
          onChange={(d) => commit({ ...internal, d })}
          ariaLabel="Ngày"
        />
        <WheelColumn
          items={months}
          value={internal.m}
          onChange={(m) => commit({ ...internal, m })}
          ariaLabel="Tháng"
        />
        <WheelColumn
          items={years}
          value={internal.y}
          onChange={(y) => commit({ ...internal, y })}
          ariaLabel="Năm"
        />
      </div>
    </div>
  );
}
