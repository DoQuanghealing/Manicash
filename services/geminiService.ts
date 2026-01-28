// 1. Sửa lại import đúng thư viện
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Transaction, User, Goal, IncomeProject, FixedCost, FinancialReport } from '../types';

// 2. Sửa lại tên Model chuẩn
const FLASH_MODEL = 'gemini-1.5-flash';
const PRO_MODEL = 'gemini-1.5-pro';

// 3. Lấy API Key từ đúng nguồn của Vite
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export const GeminiService = {
  isAvailable: () => !!API_KEY,

  generateWeeklyInsight: async (transactions: Transaction[], users: User[]): Promise<string> => {
    try {
      const model = genAI.getGenerativeModel({ model: FLASH_MODEL });
      const recentTx = transactions.slice(-15);
      const prompt = `Phân tích các giao dịch gần đây của ${users.map(u => u.name).join(' & ')}. Ngôn ngữ: Tiếng Việt. Giọng điệu: Hơi mỉa mai nhưng thực tế. Tối đa 2 câu. Dữ liệu: ${JSON.stringify(recentTx)}`;
      
      const result = await model.generateContent(prompt);
      return result.response.text() || "Đã ghi nhận thói quen chi tiêu.";
    } catch (e) {
      console.error("Gemini Error:", e);
      return "AI đang quan sát trong im lặng.";
    }
  },

  generateBadge: async (transactions: Transaction[]): Promise<{title: string, description: string}> => {
     try {
        const model = genAI.getGenerativeModel({
            model: FLASH_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        title: { type: SchemaType.STRING },
                        description: { type: SchemaType.STRING }
                    },
                    required: ["title", "description"]
                },
            },
        });

        const result = await model.generateContent("Tạo một huy hiệu thành tích mỉa mai cho các giao dịch này.");
        return JSON.parse(result.response.text());
      } catch (e) {
        return { title: 'Người bí ẩn', description: 'Tiền đi đâu không ai biết.' };
      }
  },

  // ... Các hàm khác (generateIncomePlan, generateComprehensiveReport) 
  // hãy áp dụng cấu trúc getGenerativeModel tương tự như trên
};
