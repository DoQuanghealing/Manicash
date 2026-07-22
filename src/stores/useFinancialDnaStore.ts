/* ═══ Financial DNA — Store (PV-3 · B2/B4) ═══
 * Lưu local: câu trả lời trắc nghiệm + persona + BÁO CÁO đã phân tích + consent flag.
 * ⚠️ KHÔNG BAO GIỜ lưu raw phần viết tự do (quyết định PO 2026-07-22 — dữ liệu
 * nhạy cảm nhất chỉ sống trong request LLM rồi bỏ). Xóa khi logout (account boundary).
 */
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DnaAnswer } from '@/lib/aiMoneyChat/prism/dna/dnaQuestions';
import { sanitizeDnaAnswers } from '@/lib/aiMoneyChat/prism/dna/dnaQuestions';
import type { DnaOracleReport } from '@/lib/aiMoneyChat/prism/dna/dnaOracleSchema';

export const FINANCIAL_DNA_STORAGE_KEY = 'manicash.prism.dna.v1';

export type DnaReflectionConsent = 'granted' | 'skipped';

export interface StoredDnaAnalysis {
  report: DnaOracleReport;
  /** 'ai' = LLM thật (đã trừ credit) · 'deterministic' = bản cơ bản 0đ. */
  source: 'ai' | 'deterministic';
  /** User có chia sẻ phần viết tự do khi phân tích không (CHỈ flag, không nội dung). */
  reflectionConsent: DnaReflectionConsent;
  analyzedAt: string;
}

interface FinancialDnaState {
  /** Câu trả lời trắc nghiệm (id-based). Teaser dùng chung bộ này. */
  answers: DnaAnswer[];
  analysis: StoredDnaAnalysis | null;
  saveAnswers: (answers: DnaAnswer[]) => void;
  saveAnalysis: (a: StoredDnaAnalysis) => void;
  /** Xoá riêng bản phân tích (giữ câu trả lời) — nút "Xoá bản luận giải". */
  clearAnalysis: () => void;
  clearAll: () => void;
}

export const useFinancialDnaStore = create<FinancialDnaState>()(
  persist(
    (set) => ({
      answers: [],
      analysis: null,
      saveAnswers: (answers) => set({ answers: sanitizeDnaAnswers(answers) }),
      saveAnalysis: (analysis) => set({ analysis }),
      clearAnalysis: () => set({ analysis: null }),
      clearAll: () => set({ answers: [], analysis: null }),
    }),
    {
      name: FINANCIAL_DNA_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
