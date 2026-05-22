/* ═══ IOSTimePicker — 2 cột wheel (Giờ : Phút) ═══
 *
 * Format input/output: HH:mm (24h). Empty value cho phép — chưa chọn.
 * Mỗi cột tự snap, hiển thị 5 items, item giữa = selected.
 */
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './IOSDatePicker.css'; // share styles

interface Props {
  value: string;       // HH:mm hoặc empty
  onChange: (newTime: string) => void;
  /** Bước phút — default 1 (00..59). Có thể chỉnh 5 để gọn hơn. */
  minuteStep?: number;
}

const ITEM_HEIGHT = 40;

function parseTime(s: string | undefined): { h: number; m: number } | null {
  if (!s || !/^\d{2}:\d{2}$/.test(s)) return null;
  const h = parseInt(s.slice(0, 2), 10);
  const m = parseInt(s.slice(3, 5), 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function toHHmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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

  useEffect(() => {
    if (!ref.current || selectedIndex < 0) return;
    isSettingRef.current = true;
    ref.current.scrollTo({ top: selectedIndex * ITEM_HEIGHT, behavior: 'smooth' });
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
      <div className="iosp-pad" aria-hidden="true" />
    </div>
  );
}

export default function IOSTimePicker({ value, onChange, minuteStep = 1 }: Props) {
  const [internal, setInternal] = useState(() => parseTime(value) || { h: 0, m: 0 });

  useEffect(() => {
    const parsed = parseTime(value);
    if (!parsed) return;
    queueMicrotask(() => setInternal(parsed));
  }, [value]);

  const hours = useMemo(() => {
    const arr: Array<{ value: number; label: string }> = [];
    for (let h = 0; h <= 23; h++) arr.push({ value: h, label: String(h).padStart(2, '0') });
    return arr;
  }, []);

  const minutes = useMemo(() => {
    const arr: Array<{ value: number; label: string }> = [];
    for (let m = 0; m <= 59; m += minuteStep) arr.push({ value: m, label: String(m).padStart(2, '0') });
    return arr;
  }, [minuteStep]);

  const commit = useCallback((next: { h: number; m: number }) => {
    setInternal(next);
    onChange(toHHmm(next.h, next.m));
  }, [onChange]);

  return (
    <div className="iosp-wrap iosp-wrap--time" role="group" aria-label="Chọn giờ sinh">
      <div className="iosp-highlight" aria-hidden="true" />
      <div className="iosp-cols iosp-cols--time">
        <WheelColumn
          items={hours}
          value={internal.h}
          onChange={(h) => commit({ ...internal, h })}
          ariaLabel="Giờ"
        />
        <WheelColumn
          items={minutes}
          value={internal.m}
          onChange={(m) => commit({ ...internal, m })}
          ariaLabel="Phút"
        />
      </div>
      <div className="iosp-time-sep" aria-hidden="true">:</div>
    </div>
  );
}
