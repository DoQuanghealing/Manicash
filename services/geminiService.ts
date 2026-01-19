import { GoogleGenAI } from "@google/genai";
import { Transaction, Budget, User, Goal, IncomeProject, FixedCost, FinancialReport, TransactionType } from '../types';

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-3-flash-preview';

export const GeminiService = {
  // Checks if we can use AI
  isAvailable: () => !!apiKey,

  generateWeeklyInsight: async (transactions: Transaction[], users: User[]): Promise<string> => {
    if (!apiKey) return "AI Insights unavailable (Missing API Key).";

    const recentTx = transactions.slice(-15);
    // Note: AI understands raw numbers, but we mention VND context in prompt
    const txString = recentTx.map(t => `${t.date}: ${t.amount} VND on ${t.category} (${t.description})`).join('\n');

    const prompt = `
      Analyze these recent financial transactions for a couple named ${users[0].name} and ${users[1].name}.
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
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      return response.text || "Đã ghi nhận thói quen chi tiêu.";
    } catch (e) {
      console.error(e);
      return "AI đang quan sát trong im lặng (Lỗi).";
    }
  },

  generateReflectionPrompt: async (overspentCategory: string, amountOver: number): Promise<string> => {
    if (!apiKey) return `Overspending detected in ${overspentCategory}.`;

    const prompt = `
      The user just went ${amountOver} VND over budget in the '${overspentCategory}' category.
      Generate a short reflection statement in Vietnamese.
      Tone: Mature, calm, slightly ironic.
      Rules: Max 20 words. NO questions. NO emojis. NO exclamation marks. NO advice.
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      return response.text || "Đó là lựa chọn của bạn.";
    } catch (e) {
      return "Đó là lựa chọn của bạn.";
    }
  },

  generateTransactionComment: async (transaction: any): Promise<string> => {
    if (!apiKey) return "";

    const prompt = `
      The user just spent ${transaction.amount} VND on ${transaction.category} (${transaction.description}).
      Generate a subtle, calm, slightly ironic, adult, one-sentence reflection in Vietnamese.
      Rules: NO emojis. NO questions. NO exclamation marks. Max 15 words.
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      return response.text || "";
    } catch (e) {
      return "";
    }
  },

  generateBadge: async (transactions: Transaction[]): Promise<{title: string, description: string}> => {
     if (!apiKey) return { title: 'Tập sự', description: 'Bắt đầu theo dõi.' };

     // Simple heuristic for demo
     const prompt = `
        Based on these transactions (in VND): ${JSON.stringify(transactions.slice(-10))}
        Invent a creative, sarcastic achievement badge title and short description (max 10 words) in Vietnamese.
        Tone: Dry humor.
        Rules: NO emojis. NO exclamation marks.
        Example: "Latte Legend: Funded the local cafe renovation."
        Return JSON format: { "title": "...", "description": "..." }
     `;

      try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        const text = response.text;
        return JSON.parse(text || '{}');
      } catch (e) {
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
          const response = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          return JSON.parse(response.text || '{}');
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

      // Prepare context data
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
        3. Evaluate Project Velocity (How well are they executing income plans?).
        4. Forecast Goals: Can they pay fixed costs? Are they on track for major goals (like buying a house)?

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
                "message": "Short analysis of their hustle capability in Vietnamese"
            },
            "goalForecast": {
                "canMeetFixedCosts": boolean,
                "majorGoalPrediction": "Prediction about their biggest goal in Vietnamese",
                "advice": "1 sentence strategic advice in Vietnamese"
            }
        }
      `;

      try {
          const response = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          return JSON.parse(response.text || '{}');
      } catch (e) {
          console.error(e);
          return null;
      }
  }
};