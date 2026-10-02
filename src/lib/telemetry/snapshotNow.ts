/* ═══ Gửi bản ghi chỉ số NGAY, không đợi sang ngày ═══
 * MetricSnapshotCollector chỉ gửi 1 lần/ngày và ghi dấu "đã gửi" KỂ CẢ khi server
 * bỏ qua vì chưa đồng ý. Nên người dùng vừa bật "Đóng góp dữ liệu" sẽ phải đợi tới
 * mai CRM mới thấy họ. Gọi hàm này ngay sau khi consent được ghi THÀNH CÔNG: xoá
 * dấu và báo bộ thu gửi lại.
 */

export const SNAPSHOT_SENT_KEY = 'manicash-snapshot-sent-date';
export const SNAPSHOT_NOW_EVENT = 'manicash:snapshot-now';

export function requestSnapshotNow(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SNAPSHOT_SENT_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SNAPSHOT_NOW_EVENT));
}
