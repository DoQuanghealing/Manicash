/* ═══ FloatingButler — iPhone AssistiveTouch Clone ═══ */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useButlerContext } from '@/hooks/useButlerContext';
import ButlerDrawer from './ButlerDrawer';
import './FloatingButler.css';

const BTN = 50;           // Button size
const EDGE = 8;            // Edge margin
const TOP_SAFE = 52;       // Below header bar
const BOTTOM_SAFE = 76;    // Above bottom nav bar
const TAP_THRESHOLD = 5;   // px moved to distinguish tap vs drag

export default function FloatingButler() {
  const proactive = useButlerContext();
  const [showBubble, setShowBubble] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Position (top-left corner of button)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const posRef = useRef({ x: 0, y: 0 });

  // Drag state
  const dragging = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const totalMoved = useRef(0);

  // ── Get the mobile shell bounds ──
  const getBounds = useCallback(() => {
    // Try to find the mobile shell container
    const shell = document.querySelector('.mobile-shell') as HTMLElement | null;
    if (shell) {
      const rect = shell.getBoundingClientRect();
      return {
        left: rect.left + EDGE,
        right: rect.right - BTN - EDGE,
        top: rect.top + TOP_SAFE,
        bottom: rect.bottom - BOTTOM_SAFE - BTN,
        centerX: rect.left + rect.width / 2,
      };
    }
    // Fallback: viewport
    return {
      left: EDGE,
      right: window.innerWidth - BTN - EDGE,
      top: TOP_SAFE,
      bottom: window.innerHeight - BOTTOM_SAFE - BTN,
      centerX: window.innerWidth / 2,
    };
  }, []);

  // ── Snap to nearest horizontal edge ──
  const snapToEdge = useCallback((x: number, y: number) => {
    const b = getBounds();
    const clampedY = Math.max(b.top, Math.min(b.bottom, y));
    const midX = x + BTN / 2;
    const snappedX = midX < b.centerX ? b.left : b.right;
    return { x: snappedX, y: clampedY };
  }, [getBounds]);

  // ── Initialize position ──
  useEffect(() => {
    const saved = localStorage.getItem('fb-pos');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        const snapped = snapToEdge(p.x, p.y);
        setPos(snapped);
        posRef.current = snapped;
      } catch {
        const def = snapToEdge(9999, 400); // right side default
        setPos(def);
        posRef.current = def;
      }
    } else {
      const def = snapToEdge(9999, 400);
      setPos(def);
      posRef.current = def;
    }
  }, [snapToEdge]);

  // ── Save position ──
  useEffect(() => {
    if (pos) localStorage.setItem('fb-pos', JSON.stringify(pos));
  }, [pos]);

  // ── Proactive bubble ──
  useEffect(() => {
    if (dismissed || showDrawer) return;
    const t1 = setTimeout(() => setShowBubble(true), 3000);
    const t2 = setTimeout(() => setShowBubble(false), 11000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [proactive.text, dismissed, showDrawer]);

  // ── Pointer handlers ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    totalMoved.current = 0;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = {
      dx: e.clientX - posRef.current.x,
      dy: e.clientY - posRef.current.y,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();

    const b = getBounds();
    const rawX = e.clientX - dragOffset.current.dx;
    const rawY = e.clientY - dragOffset.current.dy;

    // Clamp within bounds (don't let it go outside)
    const cx = Math.max(b.left, Math.min(b.right, rawX));
    const cy = Math.max(b.top, Math.min(b.bottom, rawY));

    totalMoved.current += Math.abs(e.clientX - dragStart.current.x) + Math.abs(e.clientY - dragStart.current.y);
    dragStart.current = { x: e.clientX, y: e.clientY };

    posRef.current = { x: cx, y: cy };
    setPos({ x: cx, y: cy });
  }, [getBounds]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;

    // Snap to edge
    const snapped = snapToEdge(posRef.current.x, posRef.current.y);
    posRef.current = snapped;
    setPos(snapped);

    // If barely moved → treat as tap
    if (totalMoved.current < TAP_THRESHOLD) {
      if (showBubble) {
        setShowBubble(false);
        setDismissed(true);
      }
      setShowDrawer((prev) => !prev);
    }
  }, [snapToEdge, showBubble]);

  // ── Re-snap on resize ──
  useEffect(() => {
    const handleResize = () => {
      const snapped = snapToEdge(posRef.current.x, posRef.current.y);
      posRef.current = snapped;
      setPos(snapped);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [snapToEdge]);

  // Bubble direction
  const isLeftSide = pos ? pos.x < getBounds().centerX : false;

  if (!pos) return null;

  return (
    <>
      {/* ═══ Draggable Button ═══ */}
      <motion.div
        className="fb-container"
        style={{ left: pos.x, top: pos.y }}
        animate={!dragging.current ? { left: pos.x, top: pos.y } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Speech Bubble */}
        <AnimatePresence>
          {showBubble && !showDrawer && (
            <motion.div
              className={`fb-bubble fb-bubble--${proactive.priority} ${isLeftSide ? 'fb-bubble--left' : ''}`}
              initial={{ opacity: 0, scale: 0.7, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onPointerDown={(e) => { e.stopPropagation(); setShowBubble(false); setDismissed(true); }}
            >
              <p className="fb-bubble-text">{proactive.text}</p>
              <div className={`fb-bubble-arrow ${isLeftSide ? 'fb-bubble-arrow--left' : ''}`} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* AssistiveTouch Button */}
        <div className={`fb-button ${showDrawer ? 'active' : ''}`}>
          <span className="fb-emoji">{showDrawer ? '✕' : '🎩'}</span>
          {proactive.priority === 'high' && !showBubble && !showDrawer && (
            <span className="fb-badge-dot" />
          )}
        </div>
      </motion.div>

      {/* Butler Drawer */}
      <ButlerDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} />
    </>
  );
}
