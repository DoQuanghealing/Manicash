import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Transaction, Budget, User, Goal, IncomeProject, FixedCost, FinancialReport, TransactionType } from '../types';

// 1. Lấy API Key an toàn (Ưu tiên Vite env, fallback sang process.env)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

// 2. Khởi tạo SDK (Dùng thư viện chuẩn GoogleGenerativeAI)
const genAI = new GoogleGenerativeAI(apiKey);

// 3. Dùng Model chuẩn, ổn định
const MODEL_NAME = 'gemini-1.5-flash'; 

// Hàm phụ trợ: Làm sạch chuỗi JSON do AI trả về (Xóa dấu ```json)
const cleanJsonString = (text: string) => {
  if (!text) return "{}";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

export const GeminiService = {
  // Checks if we can use AI
  isAvailable: () => !!apiKey,

  generateWeeklyInsight: async (transactions: Transaction[], users: User[]): Promise<string> => {
    if (!apiKey) return "AI Insights unavailable (Missing API Key).";

    const recentTx = transactions.slice(-15);
    const txString = recentTx.map(t => `${t.date}: ${t.amount} VND on ${t.category} (${t.description})`).join('\n');

    const prompt = `
      Analyze these recent financial transactions for a couple named ${users[0]?.name || 'User'} and ${users[1]?.name || 'Partner'}.
      Currency is Vietnamese Dong (VND). Note: 1 USD approx 25,000 VND.
      Transactions:
      ${txString}

      Act as a financial reflection assistant.
      Role: Observer and mirror. Not a teacher. Not a cheerleader. Not a judge.
      Tone: Mature, calm, witty, slightly sarcastic, respectful. Language: Vietnamese.
      
      Strict Rules:
      1. Maximum 2 sentences.
      2. NO advice.
      3. NO questions.
      4. NO emojis.
      5. NO exclamation marks.
      6. NO cliches.
      7. Focus on reflecting behavior honestly.
    `;

    try {
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || "Đã ghi nhận thói quen chi tiêu.";
    } catch (e) {
      console.error("Gemini Error:", e);
      return "AI đang quan sát trong im lặng (Lỗi kết nối).";
    }
  },

  generateReflectionPrompt: async (overspentCategory: string, amountOver: number): Promise<string> => {
    if (!apiKey) return `Cảnh báo: Bạn đã tiêu quá đà vào ${overspentCategory}.`;

    const prompt = `
      The user just went ${amountOver} VND over budget in the '${overspentCategory}' category.
      Generate a short reflection statement in Vietnamese.
      Tone: Mature, calm, slightly ironic.
      Rules: Max 20 words. NO questions. NO emojis. NO exclamation marks. NO advice.
    `;

    try {
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const result = await model.generateContent(prompt);
      return result.response.text() || "Đó là lựa chọn của bạn.";
    } catch (e) {
      return "Đó là lựa chọn của bạn.";
    }
  },

  generateTransactionComment: async (transaction: Transaction): Promise<string> => {
    if (!apiKey) return "";

    const prompt = `
      The user just spent ${transaction.amount} VND on ${transaction.category} (${transaction.description}).
      Generate a subtle, calm, slightly ironic, adult, one-sentence reflection in Vietnamese.
      Rules: NO emojis. NO questions. NO exclamation marks. Max 15 words.
    `;

    try {
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const result = await model.generateContent(prompt);
      return result.response.text() || "";
    } catch (e) {
      return "";
    }
  },

  generateBadge: async (transactions: Transaction[]): Promise<{title: string, description: string}> => {
     if (!apiKey) return { title: 'Tập sự', description: 'Bắt đầu theo dõi.' };

     const prompt = `
       Based on these transactions (in VND): ${JSON.stringify(transactions.slice(-10))}
       Invent a creative, sarcastic achievement badge title and short description (max 10 words) in Vietnamese.
       Tone: Dry humor.
       Rules: NO emojis. NO exclamation marks.
       Example: "Latte Legend: Funded the local cafe renovation."
       Return JSON format: { "title": "...", "description": "..." }
     `;

      try {
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" } // Ép kiểu JSON
        });
        const result = await model.generateContent(prompt);
        const text = cleanJsonString(result.response.text());
        return JSON.parse(text);
      } catch (e) {
        console.error(e);
        return { title: 'Người bí ẩn', description: 'Tiền đi đâu không ai biết.' };
      }
  },

  generateIncomePlan: async (idea: string): Promise<any> => {
      if (!apiKey) return null;

      const prompt = `
        The user wants to increase income by: "${idea}".
        Create a structured project plan for this.
        Currency: VND.
        Language: Vietnamese.
        
        Return valid JSON strictly matching this structure:
        {
            "name": "Project Name (Short & Catchy)",
            "description": "1 sentence description",
            "expectedIncome": number (estimate in VND),
            "milestones": [
                { "title": "Step 1", "daysFromNow": 1 },
                { "title": "Step 2", "daysFromNow": 3 },
                { "title": "Step 3", "daysFromNow": 7 }
            ]
        }
        Generate 3-5 milestones.
      `;

      try {
          const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
          });
          const result = await model.generateContent(prompt);
          const text = cleanJsonString(result.response.text());
          return JSON.parse(text);
      } catch (e) {
          console.error(e);
          return null;
      }
  },

  generateComprehensiveReport: async (
      transactions: Transaction[], 
      goals: Goal[], 
      projects: IncomeProject[], 
      fixedCosts: FixedCost[]
  ): Promise<FinancialReport | null> => {
      if (!apiKey) return null;

      const now = new Date();
      const currentMonth = now.getMonth();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;

      const thisMonthIncome = transactions
        .filter(t => t.type === TransactionType.INCOME && new Date(t.date).getMonth() === currentMonth)
        .reduce((sum, t) => sum + t.amount, 0);

      const lastMonthIncome = transactions
        .filter(t => t.type === TransactionType.INCOME && new Date(t.date).getMonth() === lastMonth)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const totalProjects = projects.length;

      const summary = {
          thisMonthIncome,
          lastMonthIncome,
          totalProjects,
          completedProjects,
          goals: goals.map(g => ({ name: g.name, current: g.currentAmount, target: g.targetAmount, deadline: g.deadline })),
          fixedCosts: fixedCosts.map(c => ({ name: c.title, amount: c.amount, allocated: c.allocatedAmount })),
          projectsSample: projects.slice(-5).map(p => ({ name: p.name, status: p.status, milestones: p.milestones.length }))
      };

      const prompt = `
        Act as a Senior Financial Analyst & Life Coach. Analyze this financial data for a user in Vietnam (VND).
        Data: ${JSON.stringify(summary)}

        Tasks:
        1. Calculate a "Health Score" (0-100) based on income stability, goal progress, and project execution.
        2. Analyze Income Trend (This month vs Last month).
        3. Evaluate Project Velocity.
        4. Forecast Goals.

        Output strictly JSON:
        {
            "healthScore": number,
            "incomeTrend": {
                "status": "higher" | "lower" | "stable",
                "percentage": number,
                "message": "Short 1 sentence comment in Vietnamese"
            },
            "projectVelocity": {
                "rating": "High" | "Medium" | "Low",
                "completedProjects": number,
                "message": "Short analysis in Vietnamese"
            },
            "goalForecast": {
                "canMeetFixedCosts": boolean,
                "majorGoalPrediction": "Prediction in Vietnamese",
                "advice": "1 sentence strategic advice in Vietnamese"
            }
        }
      `;

      try {
          const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
          });
          const result = await model.generateContent(prompt);
          const text = cleanJsonString(result.response.text());
          return JSON.parse(text);
      } catch (e) {
          console.error(e);
          return null;
      }
  }
};
