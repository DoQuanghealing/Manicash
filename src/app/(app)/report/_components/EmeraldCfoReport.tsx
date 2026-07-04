/* ═══ Emerald Editorial — CFO Report (3-panel pager) ═══
 * Thiết kế "Emerald Editorial" (handoff): nền xanh ngọc lục bảo + viền vàng
 * champagne, serif Lora, 3 tag Tiến bộ / Cảnh báo / Kế hoạch. Trong mobile shell
 * → tab là pager, mỗi lần hiện 1 panel. Số liệu lấy từ moneyBrain CFO context pack.
 */
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gem, Coffee, Clock, RefreshCw, Zap, Lock, Bell } from 'lucide-react';
import { useCFOSnapshot } from '@/hooks/useCFOSnapshot';
import { buildCFOContextPack } from '@/lib/moneyBrain';
import './emerald-cfo.css';

type TabId = 'progress' | 'warning' | 'plan';

const WEEKS_PER_MONTH = 4.345;

/** Định dạng "triệu" gọn: 80tr · 4,2tr · 1,4tr; nhỏ hơn 1tr → đ. */
function tr(n: number): string {
  const m = n / 1_000_000;
  if (Math.abs(m) >= 1) {
    const r = Math.round(m * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')) + 'tr';
  }
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

/** Làm tròn về đơn vị triệu đẹp (>=1tr) cho gợi ý khoá quỹ. */
function roundM(n: number): number {
  return Math.max(1_000_000, Math.round(n / 1_000_000) * 1_000_000);
}

/** Sparkline path từ chuỗi giá trị → area + line trên viewBox 90x26. */
function sparkPaths(values: number[]): { line: string; area: string } | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 88, H = 22, X0 = 2, Y0 = 2;
  const pts = values.map((v, i) => {
    const x = X0 + (i / (values.length - 1)) * W;
    const y = Y0 + (1 - (v - min) / span) * H;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0]},26 L${pts[0][0]},26 Z`;
  return { line, area };
}

export default function EmeraldCfoReport() {
  const { snapshot } = useCFOSnapshot();
  const ctx = useMemo(() => buildCFOContextPack(snapshot), [snapshot]);
  const [tab, setTab] = useState<TabId>('progress');

  // ── Số liệu từ context pack (mọi con số do engine tính) ──
  const d = useMemo(() => {
    const ex = ctx.executiveSummary;
    const hist = ctx.history.last3Months;
    const cur = hist[hist.length - 1];
    const prev = hist.length >= 2 ? hist[hist.length - 2] : undefined;

    const pctDelta = (now: number, before?: number): number | null =>
      before && before > 0 ? Math.round(((now - before) / before) * 100) : null;

    const leak = ctx.behavior.repeatedSmallLeaks[0] as
      | { categoryId: string; categoryName?: string; count: number; totalAmount: number }
      | undefined;

    const pocket = ctx.wallets.mainBalance;
    const monthlyExpense = ex.totalExpense;
    const runwayWeeks =
      monthlyExpense > 0 ? Math.round(pocket / (monthlyExpense / WEEKS_PER_MONTH)) : null;

    const lockSmall = roundM(ex.netCashflow > 0 ? ex.netCashflow * 0.4 : monthlyExpense * 0.2);
    const lockBig = roundM(pocket * 0.25);

    const reserveTarget = Math.round(3 * monthlyExpense);
    const reserveGap = Math.max(0, reserveTarget - ctx.wallets.emergencyBalance);
    const monthsToReserve =
      ex.netCashflow > 0 && reserveGap > 0 ? Math.ceil(reserveGap / ex.netCashflow) : null;

    return {
      income: ex.totalIncome,
      expense: ex.totalExpense,
      savings: ex.netCashflow,
      savingsUp: !!(cur && prev && cur.netCashflow > prev.netCashflow),
      incTrend: pctDelta(cur?.income ?? 0, prev?.income),
      expTrend: pctDelta(cur?.expense ?? 0, prev?.expense),
      spark: sparkPaths(hist.map((h) => h.netCashflow)),
      leakName: leak?.categoryName ?? leak?.categoryId,
      leakCount: leak?.count ?? 0,
      leakTotal: leak?.totalAmount ?? 0,
      pocket,
      runwayWeeks,
      runwayPct: runwayWeeks != null ? Math.min(100, Math.max(8, (runwayWeeks / 12) * 100)) : 58,
      mode: ctx.financialMode,
      lockSmall,
      lockBig,
      pocketAfterBig: pocket - lockBig,
      pipeline: ctx.earningTasks.expectedIncomePipeline,
      reserveTarget,
      monthsToReserve,
      hasData: ctx.history.availableMonths.length > 0 || ex.totalIncome > 0 || ex.totalExpense > 0,
    };
  }, [ctx]);

  const tabs: { id: TabId; step: number; title: string; sub: string }[] = [
    { id: 'progress', step: 1, title: 'Tiến bộ', sub: 'Tháng này của anh' },
    { id: 'warning', step: 2, title: 'Cảnh báo', sub: 'Nhắc riêng cho anh' },
    { id: 'plan', step: 3, title: 'Kế hoạch', sub: '3 việc đáng làm' },
  ];
  const active = tabs.find((t) => t.id === tab)!;

  return (
    <div className="ec-page">
      <div className="ec-nav">
        <Link href="/money" className="ec-back"><ArrowLeft size={17} /><span>Money</span></Link>
      </div>

      <div className="ec-frame">
        <div className="ec-glow" aria-hidden="true" />

        {/* Brand */}
        <div className="ec-brand">
          <span className="ec-gem"><Gem size={16} /></span>
          <span className="ec-wordmark">LORD DIAMOND <b>· CFO</b></span>
        </div>

        <h1 className="ec-title">Câu chuyện tiền của anh <i>— nhìn hết trong một khung.</i></h1>
        <p className="ec-sub">Ba màn: khen tiến bộ để dám nhìn, chỉ đúng cửa sổ nguy hiểm, rồi nói làm gì cho tháng sau nhẹ đầu.</p>

        {/* Tab-nav */}
        <div className="ec-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              className={`ec-tab ${t.id === tab ? 'is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="ec-tab-num">{t.step}</span>
              <span className="ec-tab-title">{t.title}</span>
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div className={`ec-ring tab-${tab}`}>
          <div className="ec-card" role="tabpanel">
            {/* Card header */}
            <div className="ec-ch">
              <span className="ec-gem sm"><Gem size={14} /></span>
              <div className="ec-ch-name"><b>Lord Diamond</b><i>{active.sub}</i></div>
              <div className="ec-dots">
                {tabs.map((t) => <i key={t.id} className={t.id === tab ? 'on' : ''} />)}
              </div>
            </div>

            {tab === 'progress' && (
              <>
                <p className="ec-eyebrow mint">THÁNG NÀY CỦA ANH</p>
                <h3 className="ec-head mint">{d.savingsUp ? 'Anh đang khá lên đấy.' : 'Nhìn lại một chút thôi.'}</h3>
                <div className="ec-stats">
                  <div className="ec-stat">
                    <span className="ec-num">{tr(d.income).replace('tr', '')}<i>{d.income >= 1e6 ? 'tr' : ''}</i></span>
                    <span className="ec-stat-lab">Kiếm</span>
                    {d.incTrend != null && <span className={`ec-delta ${d.incTrend >= 0 ? 'mint' : 'rose'}`}>{d.incTrend >= 0 ? '↑' : '↓'} {Math.abs(d.incTrend)}%</span>}
                  </div>
                  <div className="ec-stat">
                    <span className="ec-num">{tr(d.expense).replace('tr', '')}<i>{d.expense >= 1e6 ? 'tr' : ''}</i></span>
                    <span className="ec-stat-lab">Tiêu</span>
                    {d.expTrend != null && <span className={`ec-delta ${d.expTrend <= 0 ? 'mint' : 'rose'}`}>{d.expTrend <= 0 ? '↓' : '↑'} {Math.abs(d.expTrend)}%</span>}
                  </div>
                  <div className="ec-stat">
                    <span className="ec-num save">{tr(d.savings).replace('tr', '')}<i>{Math.abs(d.savings) >= 1e6 ? 'tr' : ''}</i></span>
                    <span className="ec-stat-lab">Để dành</span>
                    {d.spark ? (
                      <svg className="ec-spark" viewBox="0 0 90 26" preserveAspectRatio="none" aria-hidden="true">
                        <defs><linearGradient id="ecSpark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7ad9ae" stopOpacity=".35" /><stop offset="1" stopColor="#7ad9ae" stopOpacity="0" /></linearGradient></defs>
                        <path d={d.spark.area} fill="url(#ecSpark)" />
                        <path className="ec-spark-line" d={d.spark.line} fill="none" stroke="#7ad9ae" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : <span className="ec-delta mint">tháng đầu</span>}
                  </div>
                </div>
                <p className="ec-body">Giữ lại nhiều hơn, tiêu ít hơn tháng trước. <span className="dim">Không tệ như anh nghĩ đâu — mở lên xem có mất gì đâu.</span></p>
                {d.leakName && d.leakTotal > 0 && (
                  <div className="ec-inset">
                    <p className="ec-inset-h"><span className="ec-ic gold"><Coffee size={13} /></span> Điều anh không để ý</p>
                    <p className="ec-inset-b">{d.leakName}: <b className="gold">{tr(d.leakTotal)}</b> qua {d.leakCount} lần lẻ. Từng lần nhỏ nên không thấy — gom lại mới giật mình. Cắt 1/3 là <b className="mint">dư {tr(d.leakTotal / 3)}</b>.</p>
                  </div>
                )}
                <div className="ec-grow" />
                <button className="ec-cta mint">Khoá {tr(d.lockSmall)} vào Dự phòng</button>
              </>
            )}

            {tab === 'warning' && (
              <>
                <p className="ec-eyebrow gold">CỬA SỔ NGUY HIỂM</p>
                <h3 className="ec-head gold">Anh đang có {tr(d.pocket)}.</h3>
                <p className="ec-body ec-quote-soft">Và đây đúng lúc anh hay ngừng để ý rồi tiêu thả ga — “mình kiếm được mà”.</p>
                <div className="ec-inset">
                  <p className="ec-inset-h"><span className="ec-ic gold"><Clock size={13} /></span> Nếu ngừng kiếm từ hôm nay</p>
                  <div className="ec-runway"><div className="ec-runway-fill" style={{ width: `${d.runwayPct}%` }} /></div>
                  <div className="ec-runway-lab"><span>Hôm nay · {tr(d.pocket)}</span><b>{d.runwayWeeks != null ? `trụ ~${d.runwayWeeks} tuần` : 'chưa đủ dữ liệu'}</b></div>
                </div>
                <p className="ec-quote">Người kiếm giỏi mất tiền không phải lúc túng — mà <b>lúc rủng rỉnh.</b></p>
                <div className="ec-inset">
                  <p className="ec-inset-h"><span className="ec-ic rose"><RefreshCw size={13} /></span> Vòng lặp quen thuộc của anh</p>
                  <div className="ec-flow"><span className="ec-chip">Cạn &lt;1tr</span><span className="ec-ar">→</span><span className="ec-chip">Lao đi kiếm</span><span className="ec-ar">→</span><span className="ec-chip hot">Dư → lơ</span><span className="ec-ar">↺</span></div>
                </div>
                <div className="ec-grow" />
                <button className="ec-cta gold"><Lock size={13} /> Khoá {tr(d.lockBig)} — vẫn còn {tr(d.pocketAfterBig)} tiêu</button>
              </>
            )}

            {tab === 'plan' && (
              <>
                <p className="ec-eyebrow mint">TUẦN TỚI</p>
                <h3 className="ec-head">Làm 3 việc, tháng sau nhẹ đầu.</h3>
                <div className="ec-acts">
                  <div className="ec-act"><span className="ec-act-n">1</span><span className="ec-act-t">Khoá {tr(d.lockSmall)} vào Dự phòng ngay</span><span className="ec-act-m gold">runway<br />dài hơn</span></div>
                  <div className="ec-act"><span className="ec-act-n">2</span><span className="ec-act-t">Cắt 1/3 {d.leakName ?? 'chi lặt vặt'}</span><span className="ec-act-m mint">+{tr((d.leakTotal || d.expense * 0.05) / 3)}<br />/tháng</span></div>
                  <div className="ec-act"><span className="ec-act-n">3</span><span className="ec-act-t">Đặt ngưỡng chi tự do {tr(roundM(d.expense * 0.8))}</span><span className="ec-act-m dim">chạm mức<br />app nhắc</span></div>
                </div>
                {d.pipeline > 0 && (
                  <div className="ec-inset">
                    <p className="ec-inset-h"><span className="ec-ic aqua"><Zap size={13} /></span> Đang có sẵn cửa tăng thu</p>
                    <p className="ec-inset-b">Đầu việc đang mở → thêm khoảng <b className="aqua">{tr(d.pipeline)}</b>. Xong sớm, runway dài thêm.</p>
                  </div>
                )}
                <p className="ec-note">Giữ nhịp này, anh chạm <b>quỹ dự phòng 3 tháng ({tr(d.reserveTarget)})</b>{d.monthsToReserve != null ? ` sau ~${d.monthsToReserve} tháng` : ''}.</p>
                <div className="ec-grow" />
                <button className="ec-cta mint"><Bell size={13} /> Bật nhắc “Tổng kết tối” 21h</button>
              </>
            )}
          </div>
        </div>

        {!d.hasData && (
          <p className="ec-empty">Chưa có giao dịch tháng này — ghi vài khoản thu/chi để báo cáo có nội dung.</p>
        )}
      </div>

      <p className="ec-foot">Mọi con số tính từ dữ liệu app (moneyBrain). Nút hành động sẽ nối vào chuyển quỹ / đặt ngưỡng / bật nhắc.</p>
    </div>
  );
}
