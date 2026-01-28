
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Budget, User, Goal, IncomeProject, FixedCost, FinancialReport } from '../types';

// Initialization strictly follows system instructions
const FLASH_MODEL = 'gemini-3-flash-preview';
const PRO_MODEL = 'gemini-3-pro-preview';

export const GeminiService = {
  isAvailable: () => !!process.env.API_KEY,

  generateWeeklyInsight: async (transactions: Transaction[], users: User[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const recentTx = transactions.slice(-15);
      const prompt = `Phân tích các giao dịch gần đây của ${users.map(u => u.name).join(' & ')}. Ngôn ngữ: Tiếng Việt. Giọng điệu: Hơi mỉa mai nhưng thực tế. Tối đa 2 câu.`;
      const response = await ai.models.generateContent({ 
        model: FLASH_MODEL, 
        contents: prompt 
      });
      return response.text || "Đã ghi nhận thói quen chi tiêu.";
    } catch (e) {
      return "AI đang quan sát trong im lặng.";
    }
  },

  generateReflectionPrompt: async (overspentCategory: string, amountOver: number): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const prompt = `Người dùng đã chi quá tay ${amountOver} VND trong danh mục ${overspentCategory}. Viết 1 câu phản tư ngắn gọn, mỉa mai bằng tiếng Việt.`;
      const response = await ai.models.generateContent({ 
        model: FLASH_MODEL, 
        contents: prompt 
      });
      return response.text || "Đó là lựa chọn của bạn.";
    } catch (e) {
      return "Đó là lựa chọn của bạn.";
    }
  },

  generateTransactionComment: async (transaction: any): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const prompt = `Viết 1 câu mỉa mai ngắn bằng tiếng Việt về việc chi ${transaction.amount} cho ${transaction.category}.`;
      const response = await ai.models.generateContent({ 
        model: FLASH_MODEL, 
        contents: prompt 
      });
      return response.text || "";
    } catch (e) { return ""; }
  },

  generateBadge: async (transactions: Transaction[]): Promise<{title: string, description: string}> => {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     try {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: "Tạo một huy hiệu thành tích mỉa mai cho các giao dịch này. Trả về JSON {title, description}",
            config: { 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                    required: ['title', 'description']
                }
            }
        });
        return JSON.parse(response.text || '{}');
      } catch (e) {
        return { title: 'Người bí ẩn', description: 'Tiền đi đâu không ai biết.' };
      }
  },

  generateIncomePlan: async (idea: string): Promise<any> => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      try {
          const response = await ai.models.generateContent({
              model: PRO_MODEL,
              contents: `Lập kế hoạch thu nhập cho ý tưởng: "${idea}". Đơn vị: VND. Tiếng Việt. Trả về JSON.`,
              config: { 
                  responseMimeType: 'application/json',
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          name: { type: Type.STRING },
                          description: { type: Type.STRING },
                          expectedIncome: { type: Type.NUMBER },
                          milestones: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: { title: { type: Type.STRING }, daysFromNow: { type: Type.NUMBER } },
                                  required: ['title', 'daysFromNow']
                              }
                          }
                      },
                      required: ['name', 'description', 'expectedIncome', 'milestones']
                  }
              }
          });
          return JSON.parse(response.text || '{}');
      } catch (e) { return null; }
  },

  generateComprehensiveReport: async (transactions: Transaction[], goals: Goal[], projects: IncomeProject[], fixedCosts: FixedCost[]): Promise<FinancialReport | null> => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      try {
          const response = await ai.models.generateContent({
              model: PRO_MODEL,
              contents: "Phân tích sức khỏe tài chính dựa trên dữ liệu giao dịch, mục tiêu và hóa đơn. Trả về JSON chi tiết.",
              config: { 
                  responseMimeType: 'application/json',
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          healthScore: { type: Type.NUMBER },
                          incomeTrend: {
                              type: Type.OBJECT,
                              properties: { status: { type: Type.STRING }, percentage: { type: Type.NUMBER }, message: { type: Type.STRING } },
                              required: ['status', 'percentage', 'message']
                          },
                          projectVelocity: {
                              type: Type.OBJECT,
                              properties: { rating: { type: Type.STRING }, completedProjects: { type: Type.NUMBER }, message: { type: Type.STRING } },
                              required: ['rating', 'completedProjects', 'message']
                          },
                          goalForecast: {
                              type: Type.OBJECT,
                              properties: { canMeetFixedCosts: { type: Type.BOOLEAN }, majorGoalPrediction: { type: Type.STRING }, advice: { type: Type.STRING } },
                              required: ['canMeetFixedCosts', 'majorGoalPrediction', 'advice']
                          }
                      },
                      required: ['healthScore', 'incomeTrend', 'projectVelocity', 'goalForecast']
                  }
              }
          });
          return JSON.parse(response.text || '{}');
      } catch (e) { return null; }
  }
};
