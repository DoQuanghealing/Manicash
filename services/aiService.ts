import { GoogleGenerativeAI } from "@google/generative-ai";
import { Transaction, Goal, IncomeProject, FixedCost, FinancialReport, ProsperityPlan, Budget, Wallet } from '../types';
import { StorageService } from './storageService';

// --- CẤU HÌNH HỆ THỐNG ---
const SYSTEM_INSTRUCTION_BUTLER = "Bạn là một quản gia tài chính mỉa mai nhưng trung thành. Trả lời bằng tiếng Việt. Quan trọng: Luôn viết hoa chữ cái đầu tiên của câu, còn lại viết thường hoàn toàn. Câu thoại ngắn dưới 20 từ.";

const SYSTEM_INSTRUCTION_CFO = `Bạn là Giám đốc Tài chính (CFO) ảo của Manicash. Phân tích dữ liệu tạo báo cáo "Sức khỏe & Thịnh vượng".
Xưng hô: gọi người dùng là "Cậu chủ" hoặc "Cô chủ".

QUY TẮC TRÌNH BÀY:
- Các đoạn văn diễn giải: Viết chữ thường hoàn toàn, chỉ viết hoa chữ cái đầu tiên mỗi câu.
- Nhãn quan trọng: Các từ 'DỰ BÁO', 'CẢNH BÁO', 'BÁO ĐỘNG', 'NGUỒN TỐT NHẤT' phải viết IN HOA.`;

// Truy xuất API Keys an toàn qua Vite define
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY || "";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL_FAST = "llama-3.1-8b-instant";
const GROQ_MODEL_PRO = "llama-3.3-70b-versatile";

// --- HELPER FUNCTIONS ---

const callGroq = async (prompt: string, system: string, isPro: boolean = false, jsonMode: boolean = false) => {
    if (!GROQ_API_KEY) return null;

    try {
        const response = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: isPro ? GROQ_MODEL_PRO : GROQ_MODEL_FAST,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.6,
                max_tokens: 2048
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error("Groq AI Error:", error);
        return null;
    }
};

// Helper để parse JSON an toàn tránh crash app
const safeJsonParse = (str: string | null) => {
    if (!str) return null;
    try {
        // Loại bỏ Markdown nếu AI lỡ tay thêm vào
        const cleanJson = str.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("Lỗi Parse JSON AI:", e);
        return null;
    }
};

// --- SERVICE EXPORT ---

export const AiService = {
  isAvailable: () => !!GEMINI_API_KEY || !!GROQ_API_KEY,

  // 1. Phản hồi mỉa mai (Quản gia)
  generateTransactionComment: async (transaction: any): Promise<string> => {
    const brain = StorageService.getAiBrain();
    const prompt = `Mỉa mai cực ngắn việc chi ${transaction.amount} cho ${transaction.category}. 1 câu duy nhất.`;

    if (brain === 'llama') {
      return (await callGroq(prompt, SYSTEM_INSTRUCTION_BUTLER)) || "";
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION_BUTLER 
    });

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) { return ""; }
  },

  // 2. Kế hoạch thịnh vượng (CFO)
  generateProsperityPlan: async (transactions: Transaction[], fixedCosts: FixedCost[], goals: Goal[]): Promise<ProsperityPlan | null> => {
    const brain = StorageService.getAiBrain();
    const summary = {
      transactions: transactions.slice(-15).map(t => ({ cat: t.category, val: t.amount })),
      fixedCosts: fixedCosts.map(c => ({ title: c.title, val: c.amount })),
      goals: goals.map(g => ({ name: g.name, target: g.targetAmount, current: g.currentAmount }))
    };

    const prompt = `Dữ liệu tài chính: ${JSON.stringify(summary)}. Hãy phân tích và trả về JSON ProsperityPlan: statusTitle, statusEmoji, healthScore, summary, savingsStrategies, incomeStrategies, badHabitToQuit.`;

    if (brain === 'llama') {
      const res = await callGroq(prompt, SYSTEM_INSTRUCTION_CFO, true, true);
      return safeJsonParse(res);
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    try {
      const result = await model.generateContent(`${SYSTEM_INSTRUCTION_CFO}\n\n${prompt}`);
      return safeJsonParse(result.response.text());
    } catch (error) { return null; }
  },

  // 3. Báo cáo CFO toàn diện
  generateComprehensiveReport: async (
    transactions: Transaction[], 
    goals: Goal[], 
    budgets: Budget[],
    wallets: Wallet[],
    gender: 'MALE' | 'FEMALE' = 'MALE'
  ): Promise<FinancialReport | null> => {
    const brain = StorageService.getAiBrain();
    const dataContext = {
      wallets: wallets.map(w => ({ name: w.name, bal: w.balance })),
      transactions: transactions.slice(-30).map(t => ({ cat: t.category, amt: t.amount })),
      budgets: budgets.map(b => ({ cat: b.category, lim: b.limit, spent: b.spent })),
      goals: goals.map(g => ({ name: g.name, tar: g.targetAmount, cur: g.currentAmount }))
    };

    const prompt = `Phân tích dữ liệu cho ${gender === 'FEMALE' ? 'Cô chủ' : 'Cậu chủ'} và trả về JSON FinancialReport. Context: ${JSON.stringify(dataContext)}`;

    if (brain === 'llama') {
      const res = await callGroq(prompt, SYSTEM_INSTRUCTION_CFO, true, true);
      return safeJsonParse(res);
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: { responseMimeType: "application/json" }
    });

    try {
      const result = await model.generateContent(`${SYSTEM_INSTRUCTION_CFO}\n\n${prompt}`);
      return safeJsonParse(result.response.text());
    } catch (error) { return null; }
  }
};
