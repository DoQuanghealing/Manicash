/* ═══ PRISM — Store khảo sát năng lực (P6a) ═══
 * Lưu câu trả lời khảo sát (kỹ năng + thời gian rảnh) vào localStorage để bổ
 * sung độ chính xác cho La Bàn Năng Lực. Xóa khi logout (account boundary).
 */
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  EMPTY_SURVEY,
  sanitizeSkills,
  type CapacitySurveyAnswers,
} from '@/lib/aiMoneyChat/prism/capacity/capacitySurvey';

export const CAPACITY_SURVEY_STORAGE_KEY = 'manicash.prism.survey.v1';

interface CapacitySurveyState {
  answers: CapacitySurveyAnswers;
  save: (input: { skills: string[]; freeTimeHoursPerWeek: number }) => void;
  clearAll: () => void;
}

export const useCapacitySurveyStore = create<CapacitySurveyState>()(
  persist(
    (set) => ({
      answers: EMPTY_SURVEY,
      save: ({ skills, freeTimeHoursPerWeek }) =>
        set({
          answers: {
            skills: sanitizeSkills(skills),
            freeTimeHoursPerWeek,
            completedAt: new Date().toISOString(),
          },
        }),
      clearAll: () => set({ answers: EMPTY_SURVEY }),
    }),
    {
      name: CAPACITY_SURVEY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
