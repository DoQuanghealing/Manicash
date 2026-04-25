/* ═══ useCFOReport — Fetch AI insight with 2-layer cache ═══
 *
 * Layer 1: in-memory Map (module-scope) — survive tab session, lost on reload.
 * Layer 2: localStorage — survive page reload, TTL 1h.
 *
 * Memory cache không có max size — entries auto-expire lazy qua TTL mỗi lần
 * read. Nếu 1 tab session sinh nhiều cacheKey (data đổi liên tục), Map có thể
 * grow. Future có thể thêm LRU eviction; hiện chưa cần vì cacheKey đổi chậm
 * (theo ngày + các con số tháng).
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import type { CFOInsight, CFOPayload } from '@/lib/groqClient';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const STORAGE_PREFIX = 'manicash:cfo:';

interface CacheEntry {
  insight: CFOInsight;
  expiresAt: number; // epoch ms
}

/** Module-scope in-memory cache — shared across mọi consumer của useCFOReport. */
const memoryCache = new Map<string, CacheEntry>();

interface FetchOptions {
  cacheKey: string;
  forceRefresh?: boolean;
}

export interface UseCFOReportReturn {
  insight: CFOInsight | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  fetchInsight: (payload: CFOPayload, options: FetchOptions) => Promise<void>;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function storageKey(cacheKey: string): string {
  return `${STORAGE_PREFIX}${cacheKey}`;
}

/** Shape guard — tránh dùng data corrupt từ localStorage. */
function isValidEntry(v: unknown): v is CacheEntry {
  if (!v || typeof v !== 'object') return false;
  const entry = v as Record<string, unknown>;
  if (typeof entry.expiresAt !== 'number') return false;
  const insight = entry.insight as Record<string, unknown> | undefined;
  if (!insight || typeof insight !== 'object') return false;
  if (typeof insight.summary !== 'string') return false;
  if (!Array.isArray(insight.suggestions)) return false;
  if (typeof insight.healthScore !== 'number') return false;
  if (insight.source !== 'ai' && insight.source !== 'quick') return false;
  return true;
}

function readFromStorage(cacheKey: string): CacheEntry | null {
  if (!isBrowser()) return null;
  const key = storageKey(cacheKey);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidEntry(parsed)) {
      removeFromStorage(cacheKey);
      return null;
    }
    return parsed;
  } catch {
    removeFromStorage(cacheKey);
    return null;
  }
}

function writeToStorage(cacheKey: string, entry: CacheEntry): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey(cacheKey), JSON.stringify(entry));
  } catch {
    // QuotaExceeded / private mode / disabled — silent, memory cache vẫn chạy.
  }
}

function removeFromStorage(cacheKey: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(storageKey(cacheKey));
  } catch {
    // ignore
  }
}

/** Đọc 2 layer (memory trước, storage sau), lazy-expire entry quá hạn. */
function readCache(cacheKey: string, now: number): CacheEntry | null {
  const mem = memoryCache.get(cacheKey);
  if (mem) {
    if (mem.expiresAt > now) return mem;
    memoryCache.delete(cacheKey);
  }
  const disk = readFromStorage(cacheKey);
  if (disk) {
    if (disk.expiresAt > now) {
      memoryCache.set(cacheKey, disk); // warm memory layer
      return disk;
    }
    removeFromStorage(cacheKey);
  }
  return null;
}

/** Ghi đồng thời 2 layer. Storage fail không chặn memory. */
function writeCache(cacheKey: string, insight: CFOInsight, writtenAt: number): void {
  const entry: CacheEntry = { insight, expiresAt: writtenAt + CACHE_TTL_MS };
  memoryCache.set(cacheKey, entry);
  writeToStorage(cacheKey, entry);
}

export function useCFOReport(): UseCFOReportReturn {
  const [insight, setInsight] = useState<CFOInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const requestIdRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);

  /**
   * Race-safe: nếu cacheKey đổi giữa lúc đang fetch, response cũ sẽ bị discard
   * (requestIdRef là monotonic counter, mọi setState sau await đều check id).
   * Caller nên gọi lại trong useEffect khi cacheKey thay đổi.
   *
   * Dedupe: cùng cacheKey + đang in-flight + không forceRefresh → no-op.
   * Cache hit (không forceRefresh): hydrate state ngay, huỷ mọi request cũ còn
   * đang chạy để insight mới không bị overwrite.
   */
  const fetchInsight = useCallback(
    async (payload: CFOPayload, options: FetchOptions) => {
      const { cacheKey, forceRefresh = false } = options;
      const now = Date.now();

      // === Dedupe: cùng key đang fetch + không force → bỏ qua ===
      if (!forceRefresh && inFlightKeyRef.current === cacheKey) return;

      // === Cache hit (chỉ khi không force) ===
      if (!forceRefresh) {
        const cached = readCache(cacheKey, now);
        if (cached) {
          // Huỷ mọi in-flight request cũ — cache hit là state mới nhất.
          requestIdRef.current += 1;
          inFlightKeyRef.current = null;
          setInsight(cached.insight);
          setError(null);
          setLastUpdated(cached.expiresAt - CACHE_TTL_MS);
          setIsLoading(false);
          return;
        }
      }

      const myId = ++requestIdRef.current;
      inFlightKeyRef.current = cacheKey;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/cfo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // Stale check #1 — sau fetch response.
        if (myId !== requestIdRef.current) return;

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const result = (await res.json()) as CFOInsight;

        // Stale check #2 — sau JSON parse (await đã yield control).
        if (myId !== requestIdRef.current) return;

        const writtenAt = Date.now();
        writeCache(cacheKey, result, writtenAt);
        setInsight(result);
        setError(null);
        setLastUpdated(writtenAt);
      } catch (err) {
        if (myId !== requestIdRef.current) return;
        // Network fail → giữ insight cũ, chỉ set error message.
        setError(err instanceof Error ? err.message : 'Lỗi kết nối AI');
      } finally {
        if (myId === requestIdRef.current) {
          setIsLoading(false);
          inFlightKeyRef.current = null;
        }
      }
    },
    [],
  );

  return { insight, isLoading, error, lastUpdated, fetchInsight };
}
