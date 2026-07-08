/* ═══ Profile — Giới thiệu hệ sinh thái (deep-link Academy, mở tab mới) ═══ */
'use client';

import { ECOSYSTEM_FEATURED, resolveEcosystemHref } from '@/data/ecosystemLinks';
import './ecosystem.css';

export default function EcosystemSection() {
  return (
    <section className="eco-section">
      <h2 className="profile-section-title">Hệ sinh thái</h2>
      <p className="eco-intro">
        ManiCash là một phần của hệ sinh thái <strong>DuongQuang Academy</strong> — nơi bạn học cách
        quản lý tiền, thoát nợ và phát triển thu nhập. Khám phá nội dung miễn phí bên dưới.
      </p>
      <div className="eco-list">
        {ECOSYSTEM_FEATURED.map((link) => (
          <a
            key={link.id}
            className="eco-card"
            href={resolveEcosystemHref(link)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="eco-emoji">{link.emoji}</span>
            <span className="eco-body">
              <span className="eco-title">{link.title}</span>
              <span className="eco-desc">{link.desc}</span>
            </span>
            <span className="eco-arrow">↗</span>
          </a>
        ))}
      </div>
    </section>
  );
}
