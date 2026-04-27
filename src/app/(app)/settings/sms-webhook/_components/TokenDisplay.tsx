/* ═══ TokenDisplay — Webhook URL + token + Copy/Regenerate ═══
 *
 * Read existing token từ Firestore client SDK; generate qua POST /api/webhook-token
 * với Firebase ID token. Demo mode (chưa Firebase auth) → "Tạo token" sẽ fail
 * graceful với error message.
 */
'use client';

import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Check, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDB, getFirebaseAuth } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/useAuthStore';
import type { WebhookToken } from '@/types/webhook';

const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/sms-webhook`;

export default function TokenDisplay() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [token, setToken] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [copyTarget, setCopyTarget] = useState<'url' | 'token' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing token (nếu có) qua client Firestore.
  useEffect(() => {
    if (!uid) {
      setHasLoaded(true);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseDB(), 'webhook_tokens', uid));
        if (snap.exists()) {
          setToken((snap.data() as WebhookToken).token);
        }
      } catch (e) {
        console.error('[TokenDisplay] load failed:', e);
      }
      setHasLoaded(true);
    })();
  }, [uid]);

  const generate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const idToken = await getFirebaseAuth().currentUser?.getIdToken();
      if (!idToken) {
        setError('Cần đăng nhập Firebase để tạo token (demo mode chưa hỗ trợ).');
        return;
      }
      const res = await fetch('/api/webhook-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setShowConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setIsGenerating(false);
    }
  };

  const copy = async (target: 'url' | 'token', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyTarget(target);
      setTimeout(() => setCopyTarget(null), 1500);
    } catch {
      // Clipboard API không available — silent
    }
  };

  const masked = token ? `${token.slice(0, 6)}${'•'.repeat(20)}${token.slice(-4)}` : '';

  return (
    <section className="sw-card">
      <h2 className="sw-card-title">🔐 Webhook URL & Token</h2>

      <div className="sw-row">
        <span className="sw-label">URL</span>
        <code className="sw-code">{WEBHOOK_URL}</code>
        <button
          className="sw-icon-btn"
          onClick={() => copy('url', WEBHOOK_URL)}
          title="Copy URL"
          type="button"
        >
          {copyTarget === 'url' ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="sw-row">
        <span className="sw-label">Token</span>
        {token ? (
          <>
            <code className="sw-code">{reveal ? token : masked}</code>
            <button
              className="sw-icon-btn"
              onClick={() => setReveal((v) => !v)}
              title={reveal ? 'Ẩn' : 'Hiện'}
              type="button"
            >
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              className="sw-icon-btn"
              onClick={() => copy('token', token)}
              title="Copy token"
              type="button"
            >
              {copyTarget === 'token' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </>
        ) : hasLoaded ? (
          <span className="sw-muted">(chưa tạo)</span>
        ) : (
          <span className="sw-muted">Đang tải...</span>
        )}
      </div>

      {hasLoaded && (
        <div className="sw-actions">
          {token ? (
            <button
              className="sw-btn-secondary"
              onClick={() => setShowConfirm(true)}
              disabled={isGenerating}
              type="button"
            >
              <RefreshCw size={14} /> Tạo lại token
            </button>
          ) : (
            <button
              className="sw-btn-primary"
              onClick={generate}
              disabled={isGenerating}
              type="button"
            >
              {isGenerating ? 'Đang tạo...' : '✨ Tạo token'}
            </button>
          )}
        </div>
      )}

      {error && <p className="sw-error">{error}</p>}

      {showConfirm && (
        <div className="sw-confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="sw-confirm-card" onClick={(e) => e.stopPropagation()}>
            <p className="sw-confirm-title">⚠️ Tạo lại token?</p>
            <p className="sw-confirm-body">
              Token hiện tại sẽ bị vô hiệu hóa. Bạn cần update setup MacroDroid/Shortcut
              với token mới — nếu không, webhook sẽ ngừng hoạt động.
            </p>
            <div className="sw-confirm-actions">
              <button
                className="sw-btn-cancel"
                onClick={() => setShowConfirm(false)}
                type="button"
              >
                Huỷ
              </button>
              <button
                className="sw-btn-primary"
                onClick={generate}
                disabled={isGenerating}
                type="button"
              >
                {isGenerating ? '...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
