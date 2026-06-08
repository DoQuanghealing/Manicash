/* Phase 2 — Intent Router V2: phân loại 40+ câu hỏi tiếng Việt */
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import type { ChatIntentType } from '@/lib/aiMoneyChat/intent/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function expectType(text: string, expected: ChatIntentType): void {
  const t = routeIntent(text).type;
  if (t !== expected) throw new Error(`"${text}" expected ${expected}, got ${t}`);
}
function expectOneOf(text: string, allowed: ChatIntentType[]): void {
  const t = routeIntent(text).type;
  if (!allowed.includes(t)) throw new Error(`"${text}" expected one of [${allowed.join(',')}], got ${t}`);
}

function main() {
  console.log('\nIntent Router V2 — deterministic queries');

  // Balance
  it('ví chính còn bao nhiêu', () => expectType('ví chính còn bao nhiêu', 'QUERY_BALANCE'));
  it('tôi còn bao nhiêu tiền', () => expectType('tôi còn bao nhiêu tiền', 'QUERY_BALANCE'));
  it('số dư của tôi', () => expectType('số dư của tôi', 'QUERY_BALANCE'));

  // Income
  it('tháng này tôi thu bao nhiêu', () => expectType('tháng này tôi thu bao nhiêu', 'QUERY_INCOME'));
  it('tháng này tôi kiếm được bao nhiêu', () => expectType('tháng này tôi kiếm được bao nhiêu', 'QUERY_INCOME'));
  it('thu nhập tháng này', () => expectType('thu nhập tháng này bao nhiêu', 'QUERY_INCOME'));

  // Spending
  it('hôm nay tôi chi bao nhiêu', () => expectType('hôm nay tôi chi bao nhiêu', 'QUERY_SPENDING'));
  it('tháng này tôi đã chi bao nhiêu', () => expectType('tháng này tôi đã chi bao nhiêu', 'QUERY_SPENDING'));

  // Bills (status / upcoming / coverage -> đều thuộc nhóm bill)
  it('bill nào chưa đóng', () => expectType('bill nào chưa đóng', 'QUERY_BILL_STATUS'));
  it('tiền điện đóng chưa', () => expectType('tiền điện đóng chưa', 'QUERY_BILL_STATUS'));
  it('7 ngày tới có bill nào', () =>
    expectOneOf('7 ngày tới có bill nào', ['QUERY_BILL_STATUS', 'QUERY_UPCOMING_BILLS']));
  it('quỹ bill có đủ trả bill không', () =>
    expectOneOf('quỹ bill có đủ trả bill không', ['QUERY_BILL_STATUS', 'QUERY_BILL_COVERAGE']));

  // Budget / category
  it('danh mục nào vượt ngân sách', () => expectType('danh mục nào vượt ngân sách', 'QUERY_BUDGET_STATUS'));
  it('còn bao nhiêu ngân sách', () => expectType('còn bao nhiêu ngân sách', 'QUERY_BUDGET_STATUS'));
  it('ăn uống tháng này xài bao nhiêu', () =>
    expectType('ăn uống tháng này xài bao nhiêu', 'QUERY_CATEGORY_SPENDING'));
  it('cà phê tháng này hết bao nhiêu', () =>
    expectType('cà phê tháng này hết bao nhiêu', 'QUERY_CATEGORY_SPENDING'));

  // Safe to spend
  it('tháng này còn bao nhiêu để xài', () =>
    expectType('tháng này còn bao nhiêu để xài', 'QUERY_SAFE_TO_SPEND'));
  it('còn tiêu an toàn bao nhiêu', () => expectType('còn tiêu an toàn bao nhiêu', 'QUERY_SAFE_TO_SPEND'));
  it('mỗi ngày nên tiêu bao nhiêu', () => expectType('mỗi ngày nên tiêu bao nhiêu', 'QUERY_SAFE_TO_SPEND'));

  // Savings
  it('tiết kiệm tháng này được bao nhiêu', () =>
    expectType('tiết kiệm tháng này được bao nhiêu', 'QUERY_SAVINGS'));

  // Goals
  it('mục tiêu mua nhà còn thiếu bao nhiêu', () =>
    expectType('mục tiêu mua nhà còn thiếu bao nhiêu', 'QUERY_GOAL_PROGRESS'));
  it('quỹ khẩn cấp đạt bao nhiêu phần trăm', () =>
    expectType('quỹ khẩn cấp đạt bao nhiêu phần trăm', 'QUERY_GOAL_PROGRESS'));
  it('mục tiêu mua xe tới đâu rồi', () => expectType('mục tiêu mua xe tới đâu rồi', 'QUERY_GOAL_PROGRESS'));

  // Tasks / pipeline
  it('hôm nay tôi có việc gì', () => expectType('hôm nay tôi có việc gì', 'QUERY_TASKS_TODAY'));
  it('task nào trễ hạn', () => expectType('task nào trễ hạn', 'QUERY_TASKS_TODAY'));
  it('nếu làm hết task thì có thêm bao nhiêu', () =>
    expectOneOf('nếu làm hết task thì có thêm bao nhiêu', ['QUERY_TASKS_TODAY', 'QUERY_EARNING_PIPELINE']));

  // Health / streak
  it('điểm sức khỏe tài chính', () => expectType('điểm sức khỏe tài chính', 'QUERY_HEALTH_SCORE'));
  it('streak của tôi bao nhiêu', () => expectType('streak của tôi bao nhiêu', 'QUERY_STREAK'));

  // Log transaction
  it('mua trứng 30k', () => expectType('mua trứng 30k', 'LOG_TRANSACTION'));
  it('nhận lương 20tr', () => expectType('nhận lương 20tr', 'LOG_TRANSACTION'));

  console.log('\nIntent Router V2 — LLM intents');
  it('phân tích tình hình tháng này -> ANALYZE/CFO', () =>
    expectOneOf('phân tích tình hình tháng này', ['ANALYZE_FINANCE', 'CFO_REPORT']));
  it('lên báo cáo CFO -> CFO_REPORT', () => expectType('lên báo cáo CFO tháng này', 'CFO_REPORT'));
  it('tư vấn cắt giảm chi tiêu -> ADVICE_CUT_SPENDING', () =>
    expectType('tư vấn cắt giảm chi tiêu', 'ADVICE_CUT_SPENDING'));

  console.log('\nIntent Router V2 — pipeline routing (deterministic không gọi LLM)');
  it('các deterministic intent -> pipeline deterministic', () => {
    const deterministic = [
      'ví chính còn bao nhiêu',
      'tháng này tôi thu bao nhiêu',
      'hôm nay tôi chi bao nhiêu',
      'bill nào chưa đóng',
      'danh mục nào vượt ngân sách',
      'ăn uống tháng này xài bao nhiêu',
      'tháng này còn bao nhiêu để xài',
      'mục tiêu mua nhà còn thiếu bao nhiêu',
      'điểm sức khỏe tài chính',
      'streak của tôi bao nhiêu',
    ];
    for (const text of deterministic) {
      const intent = routeIntent(text);
      if (intent.pipeline !== 'deterministic') {
        throw new Error(`"${text}" expected deterministic pipeline, got ${intent.pipeline} (${intent.type})`);
      }
    }
  });

  it('CFO/analyze/advice -> pipeline llm', () => {
    for (const text of ['lên báo cáo CFO tháng này', 'phân tích năng lực tài chính', 'tư vấn cắt giảm chi tiêu']) {
      if (routeIntent(text).pipeline !== 'llm') throw new Error(`"${text}" expected llm pipeline`);
    }
  });

  console.log('\nIntent Router V2 test complete.');
}

main();
