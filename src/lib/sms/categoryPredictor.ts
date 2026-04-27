/* ═══ Category Predictor — Keyword-based merchant → category ═══
 *
 * Pure function — input ParsedTransaction, output { categoryId, confidence }.
 * Match keyword trong description (lowercase). Rule confidence cao nhất thắng.
 * No match → { categoryId: null, confidence: 0 } (UI để user pick lúc confirm).
 *
 * categoryId tham chiếu `src/data/categories.ts` (12 expense + 7 income IDs).
 */

import type { ParsedTransaction } from '@/lib/sms/parsers/types';

interface CategoryRule {
  /** Lowercase keywords — match nếu description includes BẤT KỲ keyword nào. */
  keywords: string[];
  categoryId: string;
  /** 0-1. Rule có confidence cao hơn thắng khi nhiều rule match cùng SMS. */
  confidence: number;
}

const EXPENSE_RULES: CategoryRule[] = [
  // === Food delivery ===
  { keywords: ['grabfood', 'grab food', 'shopeefood', 'shopee food', 'gofood', 'baemin', 'foody', 'loship', 'befood', 'be food'], categoryId: 'food', confidence: 0.95 },
  // === Restaurant chains ===
  { keywords: ['kfc', 'mcdonald', 'jollibee', 'lotteria', 'pizza hut', 'dominos', 'bbq chicken', 'texas chicken'], categoryId: 'food', confidence: 0.9 },
  // === Supermarket / convenience ===
  { keywords: ['vinmart', 'winmart', 'bach hoa xanh', 'bhx', 'co.opmart', 'lotte mart', 'big c', 'mega market', 'circle k', 'familymart', 'gs25'], categoryId: 'food', confidence: 0.85 },

  // === Coffee chains ===
  { keywords: ['highland', 'highlands coffee', 'starbucks', 'phuc long', 'phuclong', 'the coffee house', 'cong caphe', 'trung nguyen', 'katinat'], categoryId: 'coffee', confidence: 0.95 },

  // === Ride-hailing ===
  { keywords: ['grab*', 'grab transport', 'gojek', 'xanh sm', 'mai linh', 'vinasun', 'uber', 'betaxi', 'be taxi'], categoryId: 'transport', confidence: 0.9 },
  // === Gas stations ===
  { keywords: ['petrolimex', 'caltex', 'shell', 'esso', 'xang dau', 'xangdau', 'pvoil'], categoryId: 'transport', confidence: 0.95 },
  // === Parking / public transit ===
  { keywords: ['gui xe', 'guixe', 'parking', 'metro hcm', 'tau dien'], categoryId: 'transport', confidence: 0.85 },

  // === E-commerce ===
  { keywords: ['shopee', 'lazada', 'tiki', 'sendo'], categoryId: 'shopping', confidence: 0.95 },
  // === Apparel ===
  { keywords: ['uniqlo', 'h&m', 'zara', 'nike', 'adidas', 'puma', 'fila', 'mango'], categoryId: 'shopping', confidence: 0.9 },

  // === Streaming / cinema ===
  { keywords: ['netflix', 'spotify', 'youtube premium', 'disney+', 'cgv', 'galaxy cinema', 'lotte cinema', 'bhd star'], categoryId: 'entertain', confidence: 0.95 },
  // === Gaming / app stores ===
  { keywords: ['steam', 'playstation', 'nintendo', 'xbox', 'app store', 'google play', 'apple.com/bill'], categoryId: 'entertain', confidence: 0.85 },

  // === Pharmacy / health ===
  { keywords: ['pharmacity', 'long chau', 'longchau', 'medicare', 'guardian', 'watson'], categoryId: 'health', confidence: 0.9 },
  { keywords: ['benh vien', 'benhvien', 'phong kham', 'phongkham', 'clinic', 'hospital'], categoryId: 'health', confidence: 0.85 },

  // === Education ===
  { keywords: ['hoc phi', 'hocphi', 'tuition', 'duolingo', 'coursera', 'udemy'], categoryId: 'education', confidence: 0.9 },

  // === Utility bills ===
  { keywords: ['evn', 'tien dien', 'tiendien'], categoryId: 'bills', confidence: 0.95 },
  { keywords: ['saigon water', 'tien nuoc', 'tiennuoc', 'sawaco'], categoryId: 'bills', confidence: 0.95 },
  { keywords: ['vnpt', 'fpt internet', 'fpt telecom', 'viettel', 'mobifone', 'vinaphone', 'cuoc dien thoai'], categoryId: 'bills', confidence: 0.85 },

  // === Rent ===
  { keywords: ['tien nha', 'tiennha', 'thue nha', 'thuenha'], categoryId: 'rent', confidence: 0.9 },

  // === Pet ===
  { keywords: ['pet shop', 'petshop', 'thu cung', 'thucung', 'kingpetcare'], categoryId: 'pet', confidence: 0.85 },
];

const INCOME_RULES: CategoryRule[] = [
  { keywords: ['luong', 'salary', 'tien luong', 'tienluong'], categoryId: 'salary', confidence: 0.95 },
  { keywords: ['freelance', 'tu do'], categoryId: 'freelance', confidence: 0.85 },
  { keywords: ['thuong', 'bonus'], categoryId: 'bonus', confidence: 0.9 },
  { keywords: ['co tuc', 'cotuc', 'dividend', 'lai tiet kiem', 'laitietkiem'], categoryId: 'investment', confidence: 0.9 },
];

export interface PredictionResult {
  categoryId: string | null;
  confidence: number;
}

/**
 * Predict category từ parsed transaction.
 * Pure: cùng input → cùng output, không side effect, không I/O.
 */
export function predictCategory(parsed: ParsedTransaction): PredictionResult {
  const rules = parsed.type === 'income' ? INCOME_RULES : EXPENSE_RULES;
  const haystack = parsed.description.toLowerCase();

  let best: PredictionResult | null = null;

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (haystack.includes(kw)) {
        if (!best || rule.confidence > best.confidence) {
          best = { categoryId: rule.categoryId, confidence: rule.confidence };
        }
        break; // Match 1 keyword đủ — sang rule kế.
      }
    }
  }

  return best ?? { categoryId: null, confidence: 0 };
}
