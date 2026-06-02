'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeMoneyTextForMemory } from '@/lib/aiMoneyChat/parser';
import type { ParsedMoneyIntent } from '@/lib/aiMoneyChat/types';
import type { TxnType } from '@/stores/useFinanceStore';
import {
  getCategoryDisplayName,
  isKnownAppCategory,
  isKnownTaxonomyCategory,
} from '@/lib/aiMoneyChat/taxonomy';

export type MemoryRuleSource = 'user_confirmed' | 'seed' | 'ai_suggested';

export interface AiMoneyMemoryRule {
  id: string;
  keyword: string;
  normalizedKeyword: string;
  categoryId: string;
  type: Exclude<TxnType, 'transfer'>;
  confidence: number;
  source: MemoryRuleSource;
  hitCount: number;
  createdAt: string;
  lastUsedAt: string;
}

interface AddCorrectionInput {
  rawText: string;
  type: Exclude<TxnType, 'transfer'>;
  categoryId: string;
}

interface AiMoneyMemoryState {
  rules: AiMoneyMemoryRule[];
  addCorrection: (input: AddCorrectionInput) => AiMoneyMemoryRule | null;
  findBestRule: (rawText: string, type?: TxnType) => AiMoneyMemoryRule | null;
  applyMemoryToIntent: (intent: ParsedMoneyIntent) => ParsedMoneyIntent;
  clearMemory: () => void;
}

const MAX_RULES = 200;
const STOP_WORDS = new Set([
  'an',
  'chi',
  'dong',
  'het',
  'mua',
  'nhan',
  'thu',
  'tien',
  'tra',
]);

function makeRuleId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripAmountTokens(text: string): string {
  return text
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:k|nghin|ngan|tr|trieu)\b/g, ' ')
    .replace(/\b\d{1,3}(?:[.,]\d{3}){1,3}\b/g, ' ')
    .replace(/\b\d{5,12}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeyword(rawText: string): string {
  const normalized = normalizeMoneyTextForMemory(rawText);
  const withoutAmount = stripAmountTokens(normalized);
  const tokens = withoutAmount
    .split(' ')
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  if (tokens.length === 0) return withoutAmount || normalized;

  return tokens.slice(0, 4).join(' ');
}

function includesKeyword(text: string, keyword: string): boolean {
  if (!keyword) return false;
  return ` ${text} `.includes(` ${keyword} `) || text.includes(keyword);
}

function isValidMemoryCategory(categoryId: string): boolean {
  return isKnownTaxonomyCategory(categoryId) && isKnownAppCategory(categoryId);
}

export const useAiMoneyMemoryStore = create<AiMoneyMemoryState>()(
  persist(
    (set, get) => ({
      rules: [],

      addCorrection: ({ rawText, type, categoryId }) => {
        if (!rawText.trim() || !isValidMemoryCategory(categoryId)) return null;

        const keyword = extractKeyword(rawText);
        const normalizedKeyword = normalizeMoneyTextForMemory(keyword);
        if (!normalizedKeyword) return null;

        const now = new Date().toISOString();
        let savedRule: AiMoneyMemoryRule | null = null;

        set((state) => {
          const existing = state.rules.find(
            (rule) => rule.normalizedKeyword === normalizedKeyword && rule.type === type,
          );

          if (existing) {
            savedRule = {
              ...existing,
              categoryId,
              confidence: Math.min(1, existing.confidence + 0.12),
              hitCount: existing.hitCount + 1,
              lastUsedAt: now,
            };
            return {
              rules: [
                savedRule,
                ...state.rules.filter((rule) => rule.id !== existing.id),
              ].slice(0, MAX_RULES),
            };
          }

          savedRule = {
            id: makeRuleId(),
            keyword,
            normalizedKeyword,
            categoryId,
            type,
            confidence: 0.72,
            source: 'user_confirmed',
            hitCount: 1,
            createdAt: now,
            lastUsedAt: now,
          };

          return {
            rules: [savedRule, ...state.rules].slice(0, MAX_RULES),
          };
        });

        return savedRule;
      },

      findBestRule: (rawText, type) => {
        const normalized = normalizeMoneyTextForMemory(rawText);
        const candidates = get().rules
          .filter((rule) => (!type || rule.type === type) && includesKeyword(normalized, rule.normalizedKeyword))
          .sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
            return b.normalizedKeyword.length - a.normalizedKeyword.length;
          });

        return candidates[0] ?? null;
      },

      applyMemoryToIntent: (intent) => {
        if (!intent.type || intent.type === 'transfer') return intent;

        const rule = get().findBestRule(intent.rawText, intent.type);
        if (!rule || rule.confidence < 0.7) return intent;

        return {
          ...intent,
          source: 'memory',
          confidence: rule.confidence >= 0.86 ? 'high' : 'medium',
          needsConfirmation: rule.confidence < 0.86,
          category: {
            categoryId: rule.categoryId,
            categoryName: getCategoryDisplayName(rule.categoryId),
            confidence: rule.confidence >= 0.86 ? 'high' : 'medium',
            alternatives: intent.category?.categoryId && intent.category.categoryId !== rule.categoryId
              ? [
                  {
                    categoryId: intent.category.categoryId,
                    categoryName: intent.category.categoryName,
                    reason: 'Parser keyword suggestion before memory override.',
                  },
                  ...(intent.category.alternatives ?? []),
                ].slice(0, 3)
              : intent.category?.alternatives,
          },
          reasons: [
            ...intent.reasons,
            `Memory matched "${rule.keyword}" -> ${rule.categoryId}.`,
          ],
        };
      },

      clearMemory: () => set({ rules: [] }),
    }),
    {
      name: 'manicash-ai-money-memory',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

