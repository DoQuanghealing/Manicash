/* ═══ useCFOReport — Fetch AI insight from /api/cfo ═══ */
'use client';

import { useState, useCallback } from 'react';
import type { CFOInsight } from '@/lib/groqClient';

export function useCFOReport() {
  const [insight, setInsight] = useState<CFOInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = useCallback(async (data?: {
    transactions?: unknown[];
    totalIncome?: number;
    totalExpense?: number;
    savingsRate?: number;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/cfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: CFOInsight = await res.json();
      setInsight(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối AI');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { insight, isLoading, error, fetchInsight };
}
