/* ═══ BatTuCard — Hiển thị lá số Bát Tự 4 trụ ═══
 *
 * 4 cột: Năm | Tháng | Ngày | Giờ
 * Mỗi cột: label, Can (trên), Chi (dưới), nạp âm + mệnh.
 * Trụ Giờ ẩn nếu user chưa nhập giờ sinh → hiện hint "Thêm giờ sinh".
 */
'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clock } from 'lucide-react';
import { calcBatTu, MENH_DESC, type Pillar } from '@/lib/batTu';
import './BatTuCard.css';

interface Props {
  birthDate?: string;
  birthTime?: string;
  onAddTime?: () => void;  // callback nếu user muốn nhập giờ sinh
}

export default function BatTuCard({ birthDate, birthTime, onAddTime }: Props) {
  const batTu = useMemo(() => calcBatTu(birthDate, birthTime), [birthDate, birthTime]);

  if (!batTu) {
    return null; // không có ngày sinh → không hiển thị
  }

  return (
    <motion.section
      className="bat-tu-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="bat-tu-header">
        <div className="bat-tu-header-icon">
          <Sparkles size={14} />
        </div>
        <div className="bat-tu-header-body">
          <p className="bat-tu-label">Lá Số Bát Tự</p>
          <h3 className="bat-tu-title">
            Mệnh {batTu.primaryMenh} {MENH_DESC[batTu.primaryMenh].emoji}
          </h3>
          <p className="bat-tu-trait">{MENH_DESC[batTu.primaryMenh].trait}</p>
        </div>
      </header>

      <div className="bat-tu-grid">
        <PillarCol pillar={batTu.year} />
        <PillarCol pillar={batTu.month} />
        <PillarCol pillar={batTu.day} highlight />
        {batTu.hour ? (
          <PillarCol pillar={batTu.hour} />
        ) : (
          <button
            type="button"
            className="bat-tu-col bat-tu-col--empty"
            onClick={onAddTime}
            aria-label="Thêm giờ sinh"
          >
            <div className="bat-tu-col-label">Trụ Giờ</div>
            <Clock size={20} className="bat-tu-empty-icon" />
            <span className="bat-tu-empty-hint">Thêm giờ sinh</span>
          </button>
        )}
      </div>

      <p className="bat-tu-footer">
        🔮 Bát Tự là khoa học cổ phương Đông luận đoán vận mệnh qua 4 trụ Can-Chi.
        Trụ Ngày là <strong>bản thân</strong>, là gốc rễ tính cách.
      </p>
    </motion.section>
  );
}

function PillarCol({ pillar, highlight }: { pillar: Pillar; highlight?: boolean }) {
  const menhMeta = MENH_DESC[pillar.menh];
  return (
    <div
      className={`bat-tu-col ${highlight ? 'bat-tu-col--highlight' : ''}`}
      style={{ '--menh-color': menhMeta.color } as React.CSSProperties}
    >
      <div className="bat-tu-col-label">{pillar.label.replace('Trụ ', '')}</div>
      <div className="bat-tu-can">{pillar.can}</div>
      <div className="bat-tu-chi">{pillar.chi}</div>
      <div className="bat-tu-menh">
        <span className="bat-tu-menh-emoji">{menhMeta.emoji}</span>
        <span className="bat-tu-menh-name">{pillar.menh}</span>
      </div>
      <div className="bat-tu-detail">{pillar.menhDetail}</div>
    </div>
  );
}
