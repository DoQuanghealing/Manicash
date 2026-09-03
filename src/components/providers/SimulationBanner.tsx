/* ═══ Dải băng "ĐANG GIẢ LẬP" — hiện ở MỌI màn trong app ═══
 *
 * VÌ SAO PHẢI CÓ:
 * PO nói thẳng nỗi lo: "quên xóa là người dùng phải bị thấy". Cách chắc nhất để
 * không quên là làm cho việc quên trở nên KHÔNG THỂ — dải băng nằm trên mọi màn,
 * không tắt được, và bấm một lần là thoát.
 *
 * Cố ý KHÔNG cho đóng dải băng. Một dải băng đóng được là một dải băng sẽ bị đóng.
 */
'use client';

import { useEffect, useState } from 'react';
import { exitSimulation, isSimulationActive } from '@/stores/simulationStorage';
import './simulation-banner.css';

export default function SimulationBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Đọc sau khi mount: sessionStorage không có ở phía server, đọc lúc render
    // đầu sẽ lệch giữa server và client (hydration mismatch).
    setActive(isSimulationActive());
  }, []);

  if (!active) return null;

  return (
    <div className="sim-banner" role="status">
      <span className="sim-banner-dot" aria-hidden />
      <span className="sim-banner-text">
        <strong>ĐANG GIẢ LẬP</strong>
        <span>Số liệu ảo — dữ liệu thật của bạn không bị chạm tới</span>
      </span>
      <button
        type="button"
        className="sim-banner-exit"
        onClick={() => {
          exitSimulation();
          // Bắt buộc tải lại: store đang giữ số ảo trong RAM.
          window.location.reload();
        }}
      >
        Thoát
      </button>
    </div>
  );
}
