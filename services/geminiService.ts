import { GoogleGenAI, SchemaType } from "@google/genai";
import { Transaction, User, Goal, IncomeProject, FixedCost, FinancialReport, TransactionType } from '../types';

// Trong Vite, sử dụng import.meta.env thay vì process.env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenAI(API_KEY);

const FLASH_MODEL = 'gemini-1.5-flash';
const PRO_MODEL = 'gemini-1.5-pro';

export const GeminiService = {
  // Kiểm tra sự sẵn sàng của AI
  isAvailable: () => !!API_KEY,

  generateWeeklyInsight: async (transactions: Transaction[], users: User[]): Promise<string> => {
    if (!API_KEY) return "AI Insights unavailable (Missing API Key).";

    const recentTx = transactions.slice(-15);
    const txString = recentTx.map(t => `${t.date}: ${t.amount} VND - ${t.category} (${t.description})`).join('\n');

    const prompt = `
      Phân tích các giao dịch gần đây của cặp đôi ${users[0]?.name} và ${users[1]?.name}.
      Đơn vị: VND. 
      Giao dịch:
      ${txString}

      Đóng vai: Trợ lý tài chính trầm tính, trưởng thành nhưng có chút mỉa mai (sarcastic). 
      Nhiệm vụ: Phản chiếu hành vi tiêu dùng một cách trung thực nhất.
      Quy tắc cực nghiêm ngặt:
      1. Tối đa 2 câu.
      2. KHÔNG đưa lời khuyên, KHÔNG hỏi, KHÔNG dùng emoji, KHÔNG dùng dấu chấm than.
      3. Ngôn ngữ: Tiếng Việt, sắc sảo, không dùng từ ngữ sáo rỗng.
    `;

    try {
      const model = genAI.getGenerativeModel({ model: FLASH_MODEL });
      const result = await model.generateContent(prompt);
      return result.response.text() || "Đã ghi nhận thói quen chi tiêu.";
    } catch (e) {
      console.error("AI Error:", e);
      return "AI đang quan sát trong im lặng.";
    }
  },

  generateBadge: async (transactions: Transaction[]): Promise<{title: string, description: string}> => {
    if (!API_KEY) return { title: 'Tập sự', description: 'Bắt đầu hành trình.' };

    const prompt = `
      Dựa trên danh sách chi tiêu này: ${JSON.stringify(transactions.slice(-10))}
      Hãy tạo một "Danh hiệu" mang tính mỉa mai, hài hước khô khan về thói quen của họ.
      Yêu cầu: Tiếng Việt, không emoji, không dấu chấm than.
    `;

    try {
      const model = genAI.getGenerativeModel({ 
        model: FLASH_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      // Sử dụng prompt trực tiếp với hướng dẫn JSON
      const result = await model.generateContent(prompt + ' Trả về JSON: {"title": "...", "description": "..."}');
      return JSON.parse(result.response.text());
    } catch (e) {
      return { title: 'Người bí ẩn', description: 'Tiền đi đâu không ai biết.' };
    }
  },

  generateComprehensiveReport: async (
    transactions: Transaction[], 
    goals: Goal[], 
    projects: IncomeProject[], 
    fixedCosts: FixedCost[]
  ): Promise<FinancialReport | null> => {
    if (!API_KEY) return null;

    const summary = {
      incomeThisMonth: transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0),
      goals: goals.map(g => ({ name: g.name, progress: (g.currentAmount/g.targetAmount)*100 })),
      projects: projects.length,
      fixedCosts: fixedCosts.reduce((sum, c) => sum + (c.amount || 0), 0)
    };

    const prompt = `Phân tích dữ liệu tài chính Việt Nam: ${JSON.stringify(summary)}. 
    Tính điểm sức khỏe (0-100) và dự báo khả năng đạt mục tiêu. 
    Trả về định dạng JSON theo đúng schema yêu cầu.`;

    try {
      const model = genAI.getGenerativeModel({ 
        model: PRO_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
          // Bạn có thể định nghĩa responseSchema ở đây nếu muốn cực kỳ chặt chẽ
        }
      });

      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      console.error("Report Error:", e);
      return null;
    }
  }
};
