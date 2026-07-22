/* ═══ FinancialDnaPanel — La Bàn Tài Chính Nội Tâm (PV-3) ═══
 * Đặt ở Profile. 3 trạng thái theo cấp hiệu lực:
 *  - Chưa đủ cấp 3: teaser 4 câu (0 token, deterministic) → persona SƠ BỘ + khoá FOMO.
 *  - Đủ cấp 3: bài đầy đủ 8 câu → phần chia sẻ (consent tách bạch, spec §4)
 *    → "Quản gia luận giải" (1 credit, post-payment) → báo cáo Oracle 4 phần.
 *  - Đã có báo cáo: hiện lại + nút "Xoá bản luận giải" (xoá server + local).
 * ⚠️ Phần viết tự do CHỈ nằm ở state component — không persist, không log.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFinancialDnaStore } from '@/stores/useFinancialDnaStore';
import { useEffectiveButlerLevel } from '@/hooks/useEffectiveButlerLevel';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { hasFeature } from '@/lib/monetization/butlerFeatures';
import {
  DNA_QUESTIONS,
  TEASER_QUESTIONS,
  type DnaAnswer,
  type DnaQuestion,
} from '@/lib/aiMoneyChat/prism/dna/dnaQuestions';
import {
  resolveDnaPersona,
  resolveTeaserPersona,
} from '@/lib/aiMoneyChat/prism/dna/personaEngine';
import { DNA_ORACLE_DISCLAIMER } from '@/lib/aiMoneyChat/prism/dna/dnaOracleSchema';
import { requestDnaOracle, requestDnaOracleDeletion } from '@/lib/aiMoneyChat/prism/dna/dnaOracleClient';
import './financial-dna.css';

/** 3 câu hỏi mở (spec §4) — BẢN NHÁP chờ PO duyệt. */
const REFLECTION_PROMPTS = [
  'Ký ức hoặc cảm xúc đầu tiên của ngài về tiền là gì?',
  'Điều gì về tiền bạc khiến ngài lo lắng nhất lúc này?',
  'Nếu tiền không còn là vấn đề, điều đầu tiên ngài làm là gì?',
];

type Stage = 'quiz' | 'reflect' | 'report';

function QuizBlock({
  questions,
  answers,
  onPick,
}: {
  questions: DnaQuestion[];
  answers: DnaAnswer[];
  onPick: (questionId: string, optionId: string) => void;
}) {
  const picked = new Map(answers.map((a) => [a.questionId, a.optionId]));
  return (
    <div className="dna-quiz">
      {questions.map((q, qi) => (
        <div key={q.id} className="dna-q">
          <p className="dna-q-text">
            <span className="dna-q-num">{qi + 1}</span> {q.text}
          </p>
          <div className="dna-q-opts">
            {q.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`dna-opt ${picked.get(q.id) === o.id ? 'is-on' : ''}`}
                onClick={() => onPick(q.id, o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FinancialDnaPanel() {
  const { level } = useEffectiveButlerLevel();
  const honorific = useSettingsStore((s) => s.honorific) || 'chủ nhân';
  const unlocked = hasFeature(level, 'dna.oracle');

  const answers = useFinancialDnaStore((s) => s.answers);
  const analysis = useFinancialDnaStore((s) => s.analysis);
  const saveAnswers = useFinancialDnaStore((s) => s.saveAnswers);
  const saveAnalysis = useFinancialDnaStore((s) => s.saveAnalysis);
  const clearAnalysis = useFinancialDnaStore((s) => s.clearAnalysis);

  const [stage, setStage] = useState<Stage>(analysis ? 'report' : 'quiz');
  // ⚠️ Nhạy cảm: chỉ state, không persist. Rời trang = mất — đúng chủ đích.
  const [reflections, setReflections] = useState<string[]>(['', '', '']);
  const [consent, setConsent] = useState<'undecided' | 'granted' | 'skipped'>('undecided');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const questions = unlocked ? DNA_QUESTIONS : TEASER_QUESTIONS;
  const answeredAll = useMemo(() => {
    const got = new Set(answers.map((a) => a.questionId));
    return questions.every((q) => got.has(q.id));
  }, [answers, questions]);

  const teaserPersona = useMemo(() => resolveTeaserPersona(answers), [answers]);
  const fullPersona = useMemo(() => resolveDnaPersona(answers), [answers]);

  // Bản phân tích cũ vô hiệu ngay khi đổi câu trả lời (tránh header persona LIVE
  // lệch với body báo cáo ĐÓNG BĂNG). Xoá local; lần luận giải sau server ghi đè.
  function pick(questionId: string, optionId: string) {
    const next = answers.filter((a) => a.questionId !== questionId);
    next.push({ questionId, optionId });
    saveAnswers(next);
    if (analysis) clearAnalysis();
  }

  // Persist rehydrate có thể mang analysis tới SAU first render (lúc đó stage đã init
  // = 'quiz'). Nhảy sang 'report' ĐÚNG MỘT LẦN khi đó — sau đó không override nữa,
  // để "Làm lại bài test" (setStage 'quiz' dù analysis còn) không bị kéo ngược lại.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (analysis) {
      hydratedRef.current = true;
      setStage('report');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  async function analyze() {
    setLoading(true);
    setNotice(null);
    try {
      const shared =
        consent === 'granted'
          ? REFLECTION_PROMPTS.map((prompt, i) => ({ prompt, text: reflections[i]?.trim() ?? '' })).filter(
              (r) => r.text.length > 0,
            )
          : [];
      const out = await requestDnaOracle({ answers, reflections: shared });
      if (out.upgradeRequired) {
        setNotice(out.reason);
      } else if (out.report.personaReflection) {
        saveAnalysis({
          report: out.report,
          source: out.deterministicFallback ? 'deterministic' : 'ai',
          reflectionConsent: shared.length > 0 ? 'granted' : 'skipped',
          analyzedAt: new Date().toISOString(),
        });
        setStage('report');
        if (out.deterministicFallback) setNotice(out.reason);
      } else {
        setNotice(out.reason || 'Chưa luận giải được — thử lại sau nhé.');
      }
    } finally {
      // Dùng xong là quên — không giữ bản viết trong state lâu hơn cần thiết.
      setReflections(['', '', '']);
      setLoading(false);
    }
  }

  async function deleteAnalysis() {
    setLoading(true);
    try {
      await requestDnaOracleDeletion(); // best-effort server; local luôn xoá
      clearAnalysis();
      setStage('quiz');
      setConsent('undecided');
      setNotice('Đã xoá bản luận giải.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Chưa đủ cấp 3: teaser + khoá FOMO ── */
  if (!unlocked) {
    return (
      <section className="dna-card dna-card--locked">
        <header className="dna-head">
          <span className="dna-icon">🧬</span>
          <div>
            <h2 className="dna-title">La Bàn Tài Chính Nội Tâm</h2>
            <p className="dna-sub">4 câu nhanh — xem ngài thuộc &ldquo;nhóm người&rdquo; nào với tiền.</p>
          </div>
        </header>
        <QuizBlock questions={TEASER_QUESTIONS} answers={answers} onPick={pick} />
        {teaserPersona && (
          <div className="dna-teaser-result">
            <p>
              Thoáng nhìn, ngài nghiêng về{' '}
              <strong>
                {teaserPersona.primary.icon} {teaserPersona.primary.label}
              </strong>
              {teaserPersona.isHybrid && teaserPersona.secondary ? ` (pha nét ${teaserPersona.secondary.label})` : ''}.
            </p>
            <p className="dna-teaser-tagline">{teaserPersona.primary.tagline}</p>
            <p className="dna-locked-note">
              🔒 Bản luận giải đầy đủ — điểm mù, giải pháp hành vi và hướng nâng tầm tư duy — là đặc quyền{' '}
              <strong>🐉 Phú Vương</strong>. Tôi mới chỉ kể cho {honorific} một góc nhỏ thôi…
            </p>
          </div>
        )}
      </section>
    );
  }

  /* ── Đủ cấp 3 ── */
  return (
    <section className="dna-card">
      <header className="dna-head">
        <span className="dna-icon">🧬</span>
        <div>
          <h2 className="dna-title">La Bàn Tài Chính Nội Tâm</h2>
          <p className="dna-sub">Bài test tâm lý tiền — quản gia đọc vị để phò tá đúng cách.</p>
        </div>
      </header>

      {stage === 'quiz' && (
        <>
          <QuizBlock questions={DNA_QUESTIONS} answers={answers} onPick={pick} />
          <button className="dna-btn" disabled={!answeredAll} onClick={() => setStage('reflect')}>
            {answeredAll ? 'Tiếp tục →' : `Trả lời đủ ${questions.length} câu để tiếp tục`}
          </button>
        </>
      )}

      {stage === 'reflect' && (
        <div className="dna-reflect">
          {/* Câu chữ xin phép KHOÁ theo spec §4 — consent tách bạch, không ép. */}
          <p className="dna-consent-copy">
            Phần này {honorific} chia sẻ điều riêng tư hơn — cảm nhận về tiền. Tôi dùng nó chỉ để hiểu và đưa lời
            khuyên hợp với ngài. Không ai khác đọc, ngài xoá được bất cứ lúc nào.
          </p>
          {consent === 'undecided' && (
            <div className="dna-consent-actions">
              <button className="dna-btn" onClick={() => setConsent('granted')}>
                Tôi đồng ý chia sẻ
              </button>
              <button className="dna-btn dna-btn--ghost" onClick={() => setConsent('skipped')}>
                Bỏ qua phần này
              </button>
            </div>
          )}
          {consent === 'granted' && (
            <div className="dna-reflect-fields">
              {REFLECTION_PROMPTS.map((p, i) => (
                <label key={i} className="dna-reflect-field">
                  <span>{p}</span>
                  <textarea
                    value={reflections[i]}
                    maxLength={600}
                    rows={3}
                    placeholder="Vài dòng là đủ — hoặc để trống."
                    onChange={(e) =>
                      setReflections((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                    }
                  />
                </label>
              ))}
              <p className="dna-privacy-note">
                🔐 Phần viết chỉ dùng cho MỘT lần luận giải này rồi bỏ — không lưu lại ở bất cứ đâu.
              </p>
            </div>
          )}
          {consent !== 'undecided' && (
            <button className="dna-btn dna-btn--gold" disabled={loading} onClick={analyze}>
              {loading ? '⏳ Quản gia đang luận giải…' : '🔮 Quản gia luận giải (1 lượt)'}
            </button>
          )}
          {notice && <p className="dna-notice">{notice}</p>}
        </div>
      )}

      {stage === 'report' && analysis && (
        <div className="dna-report">
          {fullPersona && (
            <div className="dna-report-persona">
              <span className="dna-report-icon">{fullPersona.primary.icon}</span>
              <div>
                <strong>{fullPersona.isHybrid ? fullPersona.hybridLabel : fullPersona.primary.label}</strong>
                <span className="dna-report-meta">
                  {analysis.source === 'ai' ? 'Quản gia luận giải' : 'Bản cơ bản (0đ)'} ·{' '}
                  {new Date(analysis.analyzedAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          )}
          <p className="dna-report-reflection">{analysis.report.personaReflection}</p>

          {analysis.report.strengths.length > 0 && (
            <div className="dna-block">
              <span className="dna-block-title">💪 Điểm mạnh</span>
              <ul>{analysis.report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {analysis.report.blindspots.length > 0 && (
            <div className="dna-block dna-block--blind">
              <span className="dna-block-title">🕶️ Điểm mù</span>
              <ul>{analysis.report.blindspots.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {analysis.report.behaviorActions.length > 0 && (
            <div className="dna-block dna-block--action">
              <span className="dna-block-title">🎯 Giải pháp hành vi</span>
              <ul>{analysis.report.behaviorActions.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          <div className="dna-mindset">
            <span className="dna-block-title">🌱 Nâng tầm tư duy</span>
            <p>{analysis.report.mindsetShift}</p>
          </div>

          <p className="dna-disclaimer">{DNA_ORACLE_DISCLAIMER}</p>

          <div className="dna-report-actions">
            <button
              className="dna-btn dna-btn--ghost"
              disabled={loading}
              onClick={() => {
                // Reset consent để lần làm lại được chọn lại chia sẻ hay bỏ qua.
                setConsent('undecided');
                setStage('quiz');
              }}
            >
              Làm lại bài test
            </button>
            <button className="dna-btn dna-btn--danger" disabled={loading} onClick={deleteAnalysis}>
              Xoá bản luận giải
            </button>
          </div>
          {notice && <p className="dna-notice">{notice}</p>}
        </div>
      )}
    </section>
  );
}
