/* ═══ Test — hai túi tiền (tiền mặt vs ngân hàng) ═══
 *
 * Bất biến quan trọng nhất: tiền mặt là TẬP CON của ví chính.
 *   tiền mặt + số dư ngân hàng === ví chính, ở MỌI thời điểm.
 * Sai bất biến này là đúng cái cảnh "app báo một đằng, ví báo một nẻo".
 */
import './_setupLocalStorage';
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { useFinanceStore } from '@/stores/useFinanceStore';

function reset() {
  useFinanceStore.setState({
    transactions: [],
    mainBalance: 0,
    cashBalance: 0,
    emergencyBalance: 0,
    billFundBalance: 0,
    fixedBills: [],
    billSnapshots: [],
    billPayments: [],
  });
}

/** Bất biến: tiền mặt + ngân hàng = ví chính. */
function assertPocketsMatch(msg: string) {
  const s = useFinanceStore.getState();
  assert.equal(
    s.cashBalance + s.getBankBalance(),
    s.mainBalance,
    `${msg} — hai túi cộng lại phải bằng ví chính`,
  );
}

test('thu tiền mặt vào cả ví chính lẫn túi tiền mặt', () => {
  reset();
  useFinanceStore.getState().addTransaction({
    type: 'income', amount: 12_000_000, categoryId: 'gift-in',
    note: 'Chồng đưa', wallet: 'main', method: 'cash',
  });
  const s = useFinanceStore.getState();
  assert.equal(s.mainBalance, 12_000_000);
  assert.equal(s.cashBalance, 12_000_000);
  assert.equal(s.getBankBalance(), 0);
  assertPocketsMatch('sau khi thu tiền mặt');
});

test('thu chuyển khoản KHÔNG làm tăng tiền mặt', () => {
  reset();
  useFinanceStore.getState().addTransaction({
    type: 'income', amount: 24_000_000, categoryId: 'salary',
    note: 'Lương', wallet: 'main', method: 'transfer',
  });
  const s = useFinanceStore.getState();
  assert.equal(s.mainBalance, 24_000_000);
  assert.equal(s.cashBalance, 0);
  assert.equal(s.getBankBalance(), 24_000_000);
  assertPocketsMatch('sau khi nhận lương qua ngân hàng');
});

test('chi tiền mặt trừ đúng túi tiền mặt, ngân hàng đứng yên', () => {
  reset();
  const add = useFinanceStore.getState().addTransaction;
  add({ type: 'income', amount: 24_000_000, categoryId: 'salary', note: 'Lương', wallet: 'main', method: 'transfer' });
  add({ type: 'income', amount: 12_000_000, categoryId: 'gift-in', note: 'Chồng đưa', wallet: 'main', method: 'cash' });
  add({ type: 'expense', amount: 50_000, categoryId: 'coffee', note: 'Cà phê', wallet: 'main', method: 'cash' });

  const s = useFinanceStore.getState();
  assert.equal(s.cashBalance, 11_950_000);
  assert.equal(s.getBankBalance(), 24_000_000, 'chi tiền mặt không được đụng vào ngân hàng');
  assert.equal(s.mainBalance, 35_950_000);
  assertPocketsMatch('sau khi chi tiền mặt');
});

test('quẹt thẻ trừ ngân hàng, tiền trong túi giữ nguyên', () => {
  reset();
  const add = useFinanceStore.getState().addTransaction;
  add({ type: 'income', amount: 10_000_000, categoryId: 'salary', note: 'Lương', wallet: 'main', method: 'transfer' });
  add({ type: 'income', amount: 2_000_000, categoryId: 'business', note: 'Bán hàng', wallet: 'main', method: 'cash' });
  add({ type: 'expense', amount: 900_000, categoryId: 'groceries', note: 'Siêu thị', wallet: 'main', method: 'transfer' });

  const s = useFinanceStore.getState();
  assert.equal(s.cashBalance, 2_000_000, 'quẹt thẻ không rút tiền khỏi túi');
  assert.equal(s.getBankBalance(), 9_100_000);
  assertPocketsMatch('sau khi quẹt thẻ');
});

test('giao dịch không khai hình thức được coi là chuyển khoản', () => {
  reset();
  useFinanceStore.getState().addTransaction({
    type: 'income', amount: 5_000_000, categoryId: 'salary', note: 'Cũ', wallet: 'main',
  });
  const s = useFinanceStore.getState();
  assert.equal(s.cashBalance, 0, 'dữ liệu cũ không được nhảy vào túi tiền mặt');
  assert.equal(s.getBankBalance(), 5_000_000);
  assertPocketsMatch('với giao dịch cũ chưa có hình thức');
});

test('tiền mặt chỉ theo dõi ở ví chính, không tính quỹ dự phòng', () => {
  reset();
  useFinanceStore.getState().addTransaction({
    type: 'income', amount: 3_000_000, categoryId: 'salary',
    note: 'Nạp quỹ', wallet: 'emergency', method: 'cash',
  });
  const s = useFinanceStore.getState();
  assert.equal(s.emergencyBalance, 3_000_000);
  assert.equal(s.cashBalance, 0, 'quỹ dự phòng nằm ở ngân hàng, không phải trong túi');
  assertPocketsMatch('khi nạp quỹ dự phòng');
});

test('xoá giao dịch (hoàn tác) trả tiền mặt về đúng như cũ', () => {
  reset();
  const add = useFinanceStore.getState().addTransaction;
  add({ type: 'income', amount: 1_000_000, categoryId: 'business', note: 'Bán chả cá', wallet: 'main', method: 'cash' });
  const spend = add({ type: 'expense', amount: 200_000, categoryId: 'food', note: 'Ăn trưa', wallet: 'main', method: 'cash' });
  assert.equal(useFinanceStore.getState().cashBalance, 800_000);

  const ok = useFinanceStore.getState().removeTransaction(spend.id);
  assert.equal(ok, true);
  assert.equal(useFinanceStore.getState().cashBalance, 1_000_000, 'hoàn tác phải trả lại tiền vào túi');
  assertPocketsMatch('sau khi hoàn tác');
});

test('không cho tiền mặt âm dù chi quá số đang cầm', () => {
  reset();
  const add = useFinanceStore.getState().addTransaction;
  add({ type: 'income', amount: 5_000_000, categoryId: 'salary', note: 'Lương', wallet: 'main', method: 'transfer' });
  add({ type: 'expense', amount: 300_000, categoryId: 'food', note: 'Chi tay', wallet: 'main', method: 'cash' });

  const s = useFinanceStore.getState();
  assert.equal(s.cashBalance, 0, 'chi tay nhiều hơn tiền đang cầm thì kẹp về 0');
  assert.ok(s.getBankBalance() >= 0, 'số dư ngân hàng không được âm');
});
