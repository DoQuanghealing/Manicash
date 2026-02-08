
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Goal, IncomeProject, FixedCost, FinancialReport, ProsperityPlan, Budget, Wallet } from '../types';
import { StorageService } from './storageService';

const SYSTEM_INSTRUCTION_BUTLER = "Bạn là một quản gia tài chính mỉa mai nhưng trung thành. Trả lời bằng tiếng Việt. Quan trọng: Luôn viết hoa chữ cái đầu tiên của câu, còn lại viết thường hoàn toàn. Câu thoại ngắn dưới 20 từ.";

const SYSTEM_INSTRUCTION_CFO = `Bạn là Giám đốc Tài chính (CFO) ảo của Manicash. Nhiệm vụ của bạn là phân tích dữ liệu để tạo báo cáo "Sức khỏe & Thịnh vượng".
Xưng hô: "Quản gia tài chính" gọi người dùng là "Cậu chủ" hoặc "Cô chủ". 

QUY TẮC TRÌNH BÀY:
- Các đoạn văn diễn giải: Viết chữ thường hoàn toàn, chỉ viết hoa chữ cái đầu tiên của mỗi câu.
- Nhãn quan trọng: Các từ như 'DỰ BÁO', 'CẢNH BÁO', 'BÁO ĐỘNG', 'NGUỒN TỐT NHẤT' phải viết IN HOA toàn bộ.
- Ngôn ngữ: Sắc sảo, mang tính hành động cao.

CÁCH ĐÁNH GIÁ:
1. Chỉ số Hiệu suất Thu nhập: So sánh tiến độ dự án (milestones) với thực tế tiền vào.
2. Chỉ số Kỷ luật Chi tiêu: Phân tích độ lệch giữa Budget và Spending. Phát hiện "chi tiêu rác".
3. Đo lường Sức mạnh Tích lũy: Tính tỷ lệ dòng tiền vào Goals và Quỹ dự phòng. Dự báo "Ngày cán đích".
4. Chẩn đoán Sức khỏe (1-100): Điểm = (Thu nhập - Chi tiêu) + (Dự phòng / Chi tiêu 6 tháng) + (Tiến độ mục tiêu).`;

// GROQ Configuration
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL_FAST = "llama-3.1-8b-instant";
const GROQ_MODEL_PRO = "llama-3.3-70b-versatile";

const callGroq = async (prompt: string, system: string, isPro: boolean = false, jsonMode: boolean = false) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;

    try {
        const response = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: isPro ? GROQ_MODEL_PRO : GROQ_MODEL_FAST,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error("Groq AI Error:", error);
        return null;
    }
};

export const GeminiService = {
  isAvailable: () => !!process.env.API_KEY,

  generateTransactionComment: async (transaction: any): Promise<string> => {
    const brain = StorageService.getAiBrain();
    const prompt = `Mỉa mai cực ngắn việc chi ${transaction.amount} cho ${transaction.category}. 1 câu duy nhất.`;

    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_BUTLER);
        return res || "";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION_BUTLER,
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 100
        }
      });
      return response.text || "";
    } catch (error) { return ""; }
  },

  generateReflectionPrompt: async (overspentCategory: string, amountOver: number): Promise<string> => {
    const brain = StorageService.getAiBrain();
    const prompt = `Người dùng đã chi lố ${amountOver} cho ${overspentCategory}. Hãy viết 1 câu mỉa mai thức tỉnh.`;

    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_BUTLER);
        return res || "Tiền không tự sinh ra từ hư vô đâu ạ.";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION_BUTLER,
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 100
        }
      });
      return response.text || "Tiền không tự sinh ra từ hư vô đâu ạ.";
    } catch (error) { return "Hệ thống phản tư đang bận."; }
  },

  generateProsperityPlan: async (transactions: Transaction[], fixedCosts: FixedCost[], projects: IncomeProject[], goals: Goal[]): Promise<ProsperityPlan | null> => {
    const brain = StorageService.getAiBrain();
    const summary = {
      transactions: transactions.slice(-20).map(t => ({ cat: t.category, val: t.amount })),
      fixedCosts: fixedCosts.map(c => ({ title: c.title, val: c.amount })),
      goals: goals.map(g => ({ name: g.name, target: g.targetAmount, current: g.currentAmount }))
    };

    const prompt = `Dựa trên dữ liệu tài chính sau: ${JSON.stringify(summary)}. Hãy phân tích và trả về một ProsperityPlan chi tiết dưới dạng JSON:
    {
      "statusTitle": string,
      "statusEmoji": string,
      "healthScore": number,
      "summary": string,
      "savingsStrategies": [{ "title": string, "desc": string }],
      "incomeStrategies": [{ "title": string, "desc": string }],
      "badHabitToQuit": { "habit": string, "why": string }
    }`;
    
    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_CFO, true, true);
        return res ? JSON.parse(res) : null;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_CFO,
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              statusTitle: { type: Type.STRING },
              statusEmoji: { type: Type.STRING },
              healthScore: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              savingsStrategies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, desc: { type: Type.STRING } }
                }
              },
              incomeStrategies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, desc: { type: Type.STRING } }
                }
              },
              badHabitToQuit: {
                type: Type.OBJECT,
                properties: { habit: { type: Type.STRING }, why: { type: Type.STRING } }
              }
            },
            required: ["statusTitle", "statusEmoji", "healthScore", "summary", "savingsStrategies", "incomeStrategies", "badHabitToQuit"]
          }
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) { 
      console.error("Prosperity Plan AI Error:", error);
      return null; 
    }
  },

  generateComprehensiveReport: async (
    transactions: Transaction[], 
    goals: Goal[], 
    projects: IncomeProject[], 
    fixedCosts: FixedCost[],
    budgets: Budget[],
    wallets: Wallet[],
    gender: 'MALE' | 'FEMALE' = 'MALE'
  ): Promise<FinancialReport | null> => {
    const brain = StorageService.getAiBrain();
    const today = new Date();
    const dataContext = {
      today: today.toISOString(),
      dayOfMonth: today.getDate(),
      wallets: wallets.map(w => ({ name: w.name, bal: w.balance })),
      transactions: transactions.slice(-50).map(t => ({ type: t.type, cat: t.category, amt: t.amount, desc: t.description })),
      budgets: budgets.map(b => ({ cat: b.category, lim: b.limit, spent: b.spent })),
      goals: goals.map(g => ({ name: g.name, tar: g.targetAmount, cur: g.currentAmount, dl: g.deadline })),
      projects: projects.map(p => ({ name: p.name, inc: p.expectedIncome, miles: p.milestones.length, done: p.milestones.filter(m => m.isCompleted).length })),
      fixedCosts: fixedCosts.map(c => ({ title: c.title, amt: c.amount }))
    };

    const prompt = `Phân tích dữ liệu tài chính của ${gender === 'FEMALE' ? 'Cô chủ' : 'Cậu chủ'} và tạo báo cáo CFO dưới dạng JSON. Dữ liệu: ${JSON.stringify(dataContext)}`;
    
    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_CFO, true, true);
        return res ? JSON.parse(res) : null;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_CFO,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              healthScore: { type: Type.NUMBER },
              healthAnalysis: { type: Type.STRING },
              incomeEfficiency: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER },
                  bestSource: { type: Type.STRING },
                  forecast: { type: Type.STRING },
                  analysis: { type: Type.STRING }
                },
                required: ["score", "bestSource", "forecast", "analysis"]
              },
              budgetDiscipline: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  trashSpending: { type: Type.ARRAY, items: { type: Type.STRING } },
                  varianceAnalysis: { type: Type.STRING },
                  warningMessage: { type: Type.STRING }
                },
                required: ["status", "trashSpending", "varianceAnalysis"]
              },
              wealthVelocity: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  goalForecasts: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { name: { type: Type.STRING }, estimatedDate: { type: Type.STRING } }
                    }
                  },
                  cutSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["status", "goalForecasts", "cutSuggestions"]
              },
              cfoAdvice: { type: Type.STRING }
            },
            required: ["healthScore", "healthAnalysis", "incomeEfficiency", "budgetDiscipline", "wealthVelocity", "cfoAdvice"]
          }
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("CFO Report Error:", error);
      return null;
    }
  },

  generateIncomePlan: async (idea: string): Promise<any> => {
    const brain = StorageService.getAiBrain();
    const prompt = `Lập kế hoạch thực thi cho ý tưởng: "${idea}". Trả về JSON: { "name": string, "description": string, "expectedIncome": number, "milestones": [{ "title": string, "daysFromNow": number }] }`;
    
    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_BUTLER, true, true);
        return res ? JSON.parse(res) : null;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BUTLER,
          responseMimeType: "application/json",
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
                  properties: { title: { type: Type.STRING }, daysFromNow: { type: Type.NUMBER } }
                }
              }
            },
            required: ["name", "description", "expectedIncome", "milestones"]
          }
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) { return null; }
  }
};
