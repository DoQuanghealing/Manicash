import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Transaction, Budget, User, Goal, IncomeProject, Milestone, FixedCost, FinancialReport, TransactionType } from '../types';

// Ưu tiên dùng import.meta.env cho Vite
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

// Sử dụng model 1.5-flash để tốc độ phản hồi nhanh và ổn định
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const GeminiService = {
  isAvailable: () => !!apiKey,

  generateWeeklyInsight: async (transactions: Transaction[], users: User[]): Promise<string> => {
    if (!apiKey) return "AI Insights unavailable (Missing API Key).";

    const recentTx = transactions.slice(-15);
    const txString = recentTx.map(t => `${t.date}: ${t.amount} VND on ${t.category} (${t.description})`).join('\n');

    const prompt = `
      Phân tích các giao dịch gần đây của cặp đôi ${users[0]?.name} và ${users[1]?.name}.
      Đơn vị tiền tệ: VND.
      Giao dịch:
      ${txString}

      Vai trò: Trợ lý phản hồi tài chính trung lập.
      Giọng điệu: Trưởng thành, điềm tĩnh, hóm hỉnh nhẹ nhàng. 
      Quy tắc: Tối đa 2 câu. Không đưa lời khuyên. Không dùng emoji. Không dùng dấu chấm than.
    `;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text() || "Đã ghi nhận thói quen chi tiêu.";
    } catch (e) {
      console.error(e);
      return "AI đang quan sát trong im lặng.";
    }
  },

  generateBadge: async (transactions: Transaction[]): Promise<{title: string, description: string}> => {
    if (!apiKey) return { title: 'Tập sự', description: 'Bắt đầu theo dõi.' };

    const prompt = `Dựa trên giao dịch này: ${JSON.stringify(transactions.slice(-10))}. Tạo 1 danh hiệu hài hước (badge) bằng tiếng Việt. Trả về JSON format: {"title": "...", "description": "..."}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
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
    if (!apiKey) return null;

    const summary = {
      income: transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0),
      goals: goals.map(g => ({ name: g.name, current: g.currentAmount, target: g.targetAmount })),
      projects: projects.length
    };

    const prompt = `Hãy phân tích dữ liệu tài chính sau và trả về báo cáo chi tiết dạng JSON tiếng Việt: ${JSON.stringify(summary)}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(result.response.text());
    } catch (e) {
      console.error("Report Error:", e);
      return null;
    }
  }
};
