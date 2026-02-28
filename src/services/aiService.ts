
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Transaction, Goal, IncomeProject, FixedCost, FinancialReport, ProsperityPlan, Budget, Wallet } from '../types';
import { StorageService } from './storageService';

const SYSTEM_INSTRUCTION_BUTLER = "Bạn là một quản gia tài chính mỉa mai nhưng trung thành. Trả lời bằng tiếng Việt. Quan trọng: Luôn viết hoa chữ cái đầu tiên của câu, còn lại viết thường hoàn toàn. Câu thoại ngắn dưới 20 từ.";

// Define the missing instruction for reflection prompts
const SYSTEM_INSTRUCTION_REFLECTION = "Bạn là một quản gia tài chính xéo xắt và mỉa mai. Khi thấy chủ nhân tiêu tiền, hãy đưa ra một lời nhận xét cay nghiệt để họ phải suy nghĩ lại về thói quen chi tiêu của mình. Trả lời bằng tiếng Việt, ngắn gọn, súc tích.";

const SYSTEM_INSTRUCTION_CFO = `Bạn là Giám đốc Tài chính (CFO) ảo của Manicash, tên là Lord Diamond. Nhiệm vụ của bạn là phân tích dữ liệu để tạo báo cáo "LỘ TRÌNH THỊNH VƯỢNG".
Xưng hô: "Quản gia Lord Diamond" gọi người dùng là "Cậu chủ" hoặc "Cô chủ". 

QUY TẮC TRÌNH BÀY:
- Văn phong: Mỉa mai, xéo xắt, hài hước nhưng cực kỳ thực tế về tiền bạc.
- Cấu trúc "Nhiệm vụ": Các chiến lược phải được trình bày dưới dạng nhiệm vụ cụ thể (Nhiệm vụ 1, Nhiệm vụ 2...).
- Các đoạn văn diễn giải: Viết chữ thường hoàn toàn, chỉ viết hoa chữ cái đầu tiên của mỗi câu.
- Nhãn quan trọng: Các từ như 'DỰ BÁO', 'CẢNH BÁO', 'BÁO ĐỘNG', 'NHIỆM VỤ' phải viết IN HOA toàn bộ.

CÁCH ĐÁNH GIÁ:
1. Chỉ số Hiệu suất Thu nhập: So sánh tiến độ dự án (milestones) với thực tế tiền vào.
2. Chỉ số Kỷ luật Chi tiêu: Phân tích độ lệch giữa Budget và Spending. Phát hiện "chi tiêu rác".
3. Đo lường Sức mạnh Tích lũy: Tính tỷ lệ dòng tiền vào Goals và Quỹ dự phòng.`;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL_FAST = "llama-3.1-8b-instant";
const GROQ_MODEL_PRO = "llama-3.3-70b-versatile";

const cleanJsonResponse = (text: string) => {
    return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

const callGroq = async (prompt: string, system: string, isPro: boolean = false, jsonMode: boolean = false) => {
    // Try to get API key from process.env (AI Studio secrets) or import.meta.env (Vite)
    const apiKey = process.env.GROQ_API_KEY || (import.meta as any).env?.VITE_GROQ_API_KEY;
    if (!apiKey) {
        console.warn("GROQ_API_KEY is missing. Please add it to secrets.");
        return null;
    }

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
                temperature: 0.8,
                max_tokens: 1024
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        return null;
    }
};

export const AiService = {
  isAvailable: () => !!process.env.GEMINI_API_KEY || !!process.env.GROQ_API_KEY || !!(import.meta as any).env?.VITE_GROQ_API_KEY,

  generateTransactionComment: async (transaction: any): Promise<string> => {
    const brain = StorageService.getAiBrain();
    const prompt = `Người dùng vừa chi ${transaction.amount} cho ${transaction.category}. Hãy đưa ra một lời mỉa mai ngắn gọn.`;

    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_BUTLER);
        return res || "Lại tiêu tiền nữa rồi ạ?";
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "Cần cấu hình API Key để dùng AI.";

    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION_BUTLER,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          maxOutputTokens: 100
        }
      });
      return response.text || "Tiêu tiền giỏi thật đấy ạ.";
    } catch (error) { return "Lại tiêu tiền à?"; }
  },

  generateReflectionPrompt: async (category: string, amount: number): Promise<string> => {
    const brain = StorageService.getAiBrain();
    const prompt = `Chi ${amount} VND cho mục ${category}. Mỉa mai tôi đi.`;

    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_REFLECTION);
        return res || "Cậu chủ tiêu tiền như thể lá mít ngoài vườn vậy.";
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "Cần cấu hình API Key.";

    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION_REFLECTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          maxOutputTokens: 100
        }
      });
      return response.text || "Ví tiền của người đang khóc lóc thảm thiết đấy ạ.";
    } catch (error) { 
        return "Tiêu tiền thế này thì bao giờ mới giàu được ạ?"; 
    }
  },

  generateProsperityPlan: async (transactions: Transaction[], fixedCosts: FixedCost[], projects: IncomeProject[], goals: Goal[]): Promise<ProsperityPlan | null> => {
    const brain = StorageService.getAiBrain();
    const summary = {
      transactions: transactions.slice(-30).map(t => ({ cat: t.category, val: t.amount, desc: t.description })),
      fixedCosts: fixedCosts.map(c => ({ title: c.title, val: c.amount })),
      goals: goals.map(g => ({ name: g.name, target: g.targetAmount, current: g.currentAmount }))
    };

    const prompt = `Dựa trên dữ liệu tài chính của chủ nhân: ${JSON.stringify(summary)}. 
    Hãy đóng vai Quản gia Lord Diamond mỉa mai xéo xắt nhưng cực kỳ giỏi phân tích dòng tiền để đưa ra "LỘ TRÌNH THỊNH VƯỢNG".
    Bạn PHẢI trả về JSON theo cấu trúc sau:
    {
      "statusTitle": "ĐẠI PHÚ HÀO TIỀM NĂNG",
      "statusEmoji": string,
      "healthScore": number,
      "summary": "Lời nhận xét tổng thể về dòng tiền của Cậu chủ/Cô chủ (xéo xắt nhưng thực tế).",
      "savingsStrategies": [
        { "title": "NHIỆM VỤ 1: [Tên nhiệm vụ cắt giảm]", "desc": "[Mô tả cụ thể hành động cần làm ngay hôm nay]" },
        { "title": "NHIỆM VỤ 2: [Tên nhiệm vụ tối ưu]", "desc": "[Mô tả cụ thể hành động cần làm]" }
      ],
      "incomeStrategies": [
        { "title": "GỢI Ý 1: [Tên gợi ý dấn thân tăng thu]", "desc": "[Mô tả hành động cụ thể]" },
        { "title": "GỢI Ý 2: [Tên gợi ý kinh doanh]", "desc": "[Mô tả hành động cụ thể]" }
      ],
      "badHabitToQuit": { "habit": string, "why": string }
    }`;
    
    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_CFO, true, true);
        try {
            return res ? JSON.parse(cleanJsonResponse(res)) : null;
        } catch (e) {
            return null;
        }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_CFO,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
    gamification: any,
    gender: 'MALE' | 'FEMALE' = 'MALE'
  ): Promise<FinancialReport | null> => {
    const brain = StorageService.getAiBrain();
    const today = new Date();
    const dataContext = {
      today: today.toISOString(),
      dayOfMonth: today.getDate(),
      gamification: { rank: gamification.rank, points: gamification.points },
      wallets: wallets.map(w => ({ name: w.name, bal: w.balance })),
      transactions: transactions.slice(-50).map(t => ({ type: t.type, cat: t.category, amt: t.amount, desc: t.description })),
      budgets: budgets.map(b => ({ cat: b.category, lim: b.limit, spent: b.spent })),
      goals: goals.map(g => ({ name: g.name, tar: g.targetAmount, cur: g.currentAmount, dl: g.deadline })),
      projects: projects.map(p => ({ name: p.name, inc: p.expectedIncome, miles: p.milestones.length, done: p.milestones.filter(m => m.isCompleted).length })),
      fixedCosts: fixedCosts.map(c => ({ title: c.title, amt: c.amount }))
    };

    const prompt = `Phân tích dữ liệu tài chính của ${gender === 'FEMALE' ? 'Cô chủ' : 'Cậu chủ'} và tạo báo cáo CFO dưới dạng JSON. 
    Đặc biệt chú ý đến phần "gamificationInsights":
    - rankVelocity: Tốc độ thăng hạng dựa trên số điểm và các dự án đã hoàn thành.
    - incomeVsGoals: So sánh số tiền kiếm được từ các dự án với các mục tiêu lớn đang theo đuổi.
    - domainExpertise: Ghi nhận khả năng hoàn thành nhiệm vụ (milestones) để đánh giá sự chuyên nghiệp/kỷ luật.
    
    Dữ liệu: ${JSON.stringify(dataContext)}`;
    
    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_CFO, true, true);
        try {
            return res ? JSON.parse(cleanJsonResponse(res)) : null;
        } catch (e) {
            return null;
        }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
              gamificationInsights: {
                type: Type.OBJECT,
                properties: {
                  rankVelocity: { type: Type.STRING },
                  incomeVsGoals: { type: Type.STRING },
                  domainExpertise: { type: Type.STRING }
                },
                required: ["rankVelocity", "incomeVsGoals", "domainExpertise"]
              },
              cfoAdvice: { type: Type.STRING }
            },
            required: ["healthScore", "healthAnalysis", "incomeEfficiency", "budgetDiscipline", "wealthVelocity", "gamificationInsights", "cfoAdvice"]
          }
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      return null;
    }
  },

  generateIncomePlan: async (idea: string): Promise<any> => {
    const brain = StorageService.getAiBrain();
    const prompt = `Lập kế hoạch thực thi cho ý tưởng kiếm tiền: "${idea}". Trả về JSON: { "name": string, "description": string, "expectedIncome": number, "milestones": [{ "title": string, "daysFromNow": number }] }`;
    
    if (brain === 'llama') {
        const res = await callGroq(prompt, SYSTEM_INSTRUCTION_BUTLER, true, true);
        try {
            return res ? JSON.parse(cleanJsonResponse(res)) : null;
        } catch (e) {
            return null;
        }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
    } catch (error) { 
      return null; 
    }
  }
};
