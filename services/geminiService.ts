import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"; // Đã sửa tên thư viện và SchemaType
import { Transaction, Budget, User, Goal, IncomeProject, Milestone, FixedCost, FinancialReport, TransactionType } from '../types';

// Sử dụng biến môi trường chuẩn của Vite hoặc process.env tùy cấu hình
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");
const ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Cập nhật model name chuẩn

export const GeminiService = {
  isAvailable: () => !!apiKey,

  generateWeeklyInsight: async (transactions: Transaction[], users: User[]): Promise<string> => {
    if (!apiKey) return "AI Insights unavailable (Missing API Key).";

    const recentTx = transactions.slice(-15);
    const txString = recentTx.map(t => `${t.date}: ${t.amount} VND on ${t.category} (${t.description})`).join('\n');

    const prompt = `
      Analyze these recent financial transactions for a couple named ${users[0]?.name} and ${users[1]?.name}.
      Transactions:
      ${txString}
      ... (giữ nguyên phần prompt của bạn)
    `;

    try {
      const result = await ai.generateContent(prompt);
      const response = await result.response;
      return response.text() || "Đã ghi nhận thói quen chi tiêu.";
    } catch (e) {
      console.error(e);
      return "AI đang quan sát trong im lặng (Lỗi).";
    }
  },

  // ... Các hàm khác bạn cũng sửa cấu trúc gọi tương tự: 
  // const result = await ai.generateContent(prompt);
  // const response = await result.response;
};
