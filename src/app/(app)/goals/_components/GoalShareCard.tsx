/* ═══ GoalShareCard — Xuất story image cho IG/Facebook ═══
 *
 * Dùng canvas vẽ card 1080×1920 (IG story).
 * Click "Tải ảnh" → download PNG.
 *
 * Không cần backend — vẽ client-side bằng canvas API.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Goal } from '@/types/budget';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './GoalShareCard.css';

interface Props {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
}

const SHARE_QUOTES = [
  'Hành trình ngàn dặm bắt đầu từ bước chân đầu tiên.',
  'Người giàu không kiếm nhiều — họ quản lý giỏi.',
  'Tài sản lớn nhất: thói quen tốt với tiền.',
  'Mỗi đồng có địa chỉ = phong thủy tài chính.',
  'Tâm thức người giàu: đầu tư trước, tiêu sau.',
];

async function drawShareCard(canvas: HTMLCanvasElement, goal: Goal) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;

  // Background gradient (theo goal color)
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, goal.color);
  grad.addColorStop(0.5, '#1A1A2E');
  grad.addColorStop(1, '#0A0A12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative blobs
  const blob = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, 600);
  blob.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
  blob.addColorStop(1, 'transparent');
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, W, H);

  // Branding top
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🧧 ManiCash', 80, 140);

  // Icon huge
  ctx.font = '320px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(goal.icon, W / 2, 720);

  // Goal name
  ctx.fillStyle = 'white';
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(goal.name, W / 2, 900);

  // Progress label
  const progress = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;

  ctx.fillStyle = goal.color;
  ctx.font = 'bold 220px sans-serif';
  ctx.fillText(`${progress}%`, W / 2, 1180);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '52px sans-serif';
  ctx.fillText(
    `${formatCurrencyShort(goal.currentAmount)} / ${formatCurrencyShort(goal.targetAmount)}`,
    W / 2,
    1260
  );

  // Progress bar
  const barX = 200;
  const barY = 1340;
  const barW = W - 400;
  const barH = 24;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, barX, barY, barW, barH, 12);
  ctx.fill();
  ctx.fillStyle = goal.color;
  roundRect(ctx, barX, barY, (barW * progress) / 100, barH, 12);
  ctx.fill();

  // Quote
  const quoteIdx = (goal.id.length + goal.name.length) % SHARE_QUOTES.length;
  const quote = SHARE_QUOTES[quoteIdx];
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'italic 42px sans-serif';
  wrapText(ctx, `"${quote}"`, W / 2, 1560, W - 200, 60);

  // Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '32px sans-serif';
  ctx.fillText('Đang trên hành trình tự do tài chính', W / 2, 1820);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, curY);
      line = word + ' ';
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, curY);
}

export default function GoalShareCard({ goal, isOpen, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !goal || !canvasRef.current) return;
    drawShareCard(canvasRef.current, goal).then(() => {
      if (canvasRef.current) {
        setDataUrl(canvasRef.current.toDataURL('image/png'));
      }
    });
  }, [isOpen, goal]);

  const handleDownload = () => {
    if (!dataUrl || !goal) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `manicash-${goal.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  if (!goal) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="gsc-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="gsc-panel"
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="gsc-close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>

            <h2 className="gsc-title">Chia sẻ tiến độ</h2>
            <p className="gsc-sub">Story 1080×1920 — IG, Facebook, Threads</p>

            <div className="gsc-preview">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt="Share preview" className="gsc-preview-img" />
              ) : (
                <div className="gsc-preview-placeholder">Đang tạo ảnh...</div>
              )}
              {/* Canvas ẩn để render */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            <button className="gsc-download" onClick={handleDownload} disabled={!dataUrl}>
              <Download size={16} />
              <span>Tải ảnh story</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
