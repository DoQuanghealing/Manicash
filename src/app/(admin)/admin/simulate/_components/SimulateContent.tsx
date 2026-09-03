/* ═══ Admin — Chế độ giả lập: nạp file, bật, duyệt app để chụp ảnh ═══ */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { validateSimFile, type SimFile } from '@/lib/simulation/schema';
import { applySimulation, type ApplyResult } from '@/lib/simulation/apply';
import {
  activateSimulation,
  exitSimulation,
  isSimulationActive,
} from '@/stores/simulationStorage';
import { SAMPLE_SIM_FILE } from '@/lib/simulation/sample';
import './simulate.css';

export default function SimulateContent() {
  const [active, setActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<SimFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [shiftToToday, setShiftToToday] = useState(true);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    setActive(isSimulationActive());
  }, []);

  const readFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResult(null);
    setFatal(null);
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setParsed(null);
      setWarnings([]);
      setErrors(['File không phải JSON hợp lệ. Thường là thiếu/thừa dấu phẩy hoặc ngoặc.']);
      return;
    }
    const v = validateSimFile(raw);
    setErrors(v.errors);
    setWarnings(v.warnings);
    setParsed(v.data);
  }, []);

  function start() {
    if (!parsed) return;
    setFatal(null);
    // Bật cờ TRƯỚC khi nạp. Nếu trình duyệt chặn site data thì activate trả false
    // và ta DỪNG — nạp lúc đó là ghi số giả xuống dữ liệu thật.
    if (!activateSimulation()) {
      setFatal(
        'Không bật được chế độ giả lập (trình duyệt đang chặn lưu dữ liệu của trang). ' +
          'Đã DỪNG, chưa nạp gì — nạp khi chưa cách ly được sẽ ghi số giả vào dữ liệu thật của bạn.',
      );
      return;
    }
    try {
      setResult(applySimulation(parsed, shiftToToday));
      setActive(true);
    } catch (e) {
      exitSimulation();
      setActive(false);
      setFatal(e instanceof Error ? e.message : 'Nạp thất bại.');
    }
  }

  function stop() {
    exitSimulation();
    // Phải tải lại: store đang giữ số giả trong RAM, chỉ reload mới đọc lại
    // dữ liệu thật từ localStorage.
    window.location.reload();
  }

  function downloadSample() {
    const blob = new Blob([JSON.stringify(SAMPLE_SIM_FILE, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'manicash-gia-lap-mau.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="sim-wrap">
      <header>
        <h1 className="adm-page-title">Chế độ giả lập</h1>
        <p className="sim-sub">
          Nạp một file JSON số liệu ảo, bật lên rồi duyệt app như thật để chụp ảnh cho khách.
          Dữ liệu thật của bạn <strong>không bị chạm tới</strong>: khi đang giả lập, app đọc/ghi
          trong bộ nhớ tạm chứ không xuống ổ đĩa. Tắt hoặc đóng tab là hết.
        </p>
      </header>

      {active ? (
        <section className="sim-live">
          <div className="sim-live-badge">ĐANG GIẢ LẬP</div>
          <p>
            Mở app ở tab này và chụp màn nào cũng được — Tổng quan, Sổ sách, Mục tiêu, Money.
            Dải băng vàng sẽ theo bạn ở mọi màn để không bao giờ quên.
          </p>
          {result && (
            <ul className="sim-stats">
              <li><b>{result.transactions}</b> giao dịch</li>
              <li><b>{result.goals}</b> mục tiêu</li>
              <li><b>{result.tasks}</b> nhiệm vụ</li>
              <li><b>{result.bills}</b> hoá đơn</li>
              {result.shiftDays !== 0 && <li>đã dịch <b>{result.shiftDays}</b> ngày</li>}
            </ul>
          )}
          <div className="sim-actions">
            <a className="adm-btn adm-btn-primary" href="/overview">Mở app để chụp</a>
            <button className="adm-btn" onClick={stop}>Tắt giả lập</button>
          </div>
        </section>
      ) : (
        <>
          <section className="sim-card">
            <h2 className="sim-h2">1. Chọn file</h2>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
            <button className="sim-link" onClick={downloadSample}>
              Tải file mẫu để sửa lại
            </button>
            {fileName && <p className="sim-dim">Đã đọc: {fileName}</p>}
          </section>

          {errors.length > 0 && (
            <section className="sim-card sim-bad">
              <h2 className="sim-h2">File còn {errors.length} lỗi</h2>
              <ul className="sim-list">
                {errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              {errors.length > 20 && <p className="sim-dim">…và {errors.length - 20} lỗi nữa.</p>}
            </section>
          )}

          {warnings.length > 0 && (
            <section className="sim-card sim-warn">
              <h2 className="sim-h2">Lưu ý</h2>
              <ul className="sim-list">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </section>
          )}

          {parsed && errors.length === 0 && (
            <section className="sim-card">
              <h2 className="sim-h2">2. Bật</h2>
              <label className="sim-check">
                <input
                  type="checkbox"
                  checked={shiftToToday}
                  onChange={(e) => setShiftToToday(e.target.checked)}
                />
                <span>
                  <strong>Dịch mốc về hôm nay</strong>
                  <em>
                    Giữ nguyên khoảng cách giữa các ngày, chỉ dịch cả cụm sao cho ngày mới nhất
                    trong file rơi vào hôm nay. Tắt thì dùng đúng ngày ghi trong file — file để
                    lâu sẽ thành số liệu cũ.
                  </em>
                </span>
              </label>
              <button className="adm-btn adm-btn-primary" onClick={start}>
                Bật giả lập
              </button>
            </section>
          )}

          {fatal && <section className="sim-card sim-bad"><p>{fatal}</p></section>}
        </>
      )}
    </div>
  );
}
