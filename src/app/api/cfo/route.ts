/* ═══ CFO API Route — AI Financial Analysis ═══ */
import { NextRequest, NextResponse } from 'next/server';
import { getCFOInsight, type CFOInsight } from '@/lib/groqClient';

// Fallback insight nếu không có API key
const FALLBACK_INSIGHT: CFOInsight = {
  summary:
    'Tháng này bạn chi 4.8 triệu cho ăn uống — cao hơn 20% so với tháng trước. ' +
    'Tiết kiệm đạt 8% thu nhập, thấp hơn mục tiêu 20%. ' +
    'Nếu giảm chi ăn uống 15%, bạn sẽ thêm 720k/tháng cho quỹ mua nhà.',
  suggestions: [
    'Giảm chi cà phê ngoài: tự pha tại nhà tiết kiệm ~400k/tháng',
    'Đặt mục tiêu tiết kiệm tự động 20% mỗi khi nhận lương',
  ],
  healthScore: 62,
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      // Return demo insight
      return NextResponse.json(FALLBACK_INSIGHT);
    }

    const body = await req.json();
    const { transactions, totalIncome, totalExpense, savingsRate } = body;

    const prompt = `Phân tích tài chính tháng này:
- Thu nhập: ${totalIncome?.toLocaleString() || 0}đ
- Chi tiêu: ${totalExpense?.toLocaleString() || 0}đ  
- Tỷ lệ tiết kiệm: ${savingsRate || 0}%
- Số giao dịch: ${transactions?.length || 0}

Trả về JSON với format:
{
  "summary": "Nhận xét ngắn gọn 2-3 câu",
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "healthScore": 0-100
}`;

    const insight = await getCFOInsight(apiKey, prompt);
    return NextResponse.json(insight);
  } catch (error) {
    console.error('CFO API error:', error);
    return NextResponse.json(FALLBACK_INSIGHT);
  }
}
