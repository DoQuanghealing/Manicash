/* ═══ Groq Client — Llama 70B Integration ═══ */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `Bạn là ManiCash CFO — một chuyên gia tài chính cá nhân cho người Việt Nam.
Bạn phân tích data thu chi và đưa ra nhận xét ngắn gọn, thực tiễn.
Luôn trả lời bằng tiếng Việt. Giữ tone thân thiện nhưng chuyên nghiệp.
Đưa ra 1-2 gợi ý hành động cụ thể, có thể thực hiện ngay.
Giới hạn 150 từ.`;

export interface CFOInsight {
  summary: string;
  suggestions: string[];
  healthScore: number; // 0-100
}

export async function getCFOInsight(
  apiKey: string,
  prompt: string,
): Promise<CFOInsight> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || 'Không có dữ liệu để phân tích.',
      suggestions: parsed.suggestions || [],
      healthScore: parsed.healthScore || 50,
    };
  } catch {
    return {
      summary: content,
      suggestions: [],
      healthScore: 50,
    };
  }
}
