import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chính sách quyền riêng tư | ManiCash',
  description: 'Chính sách quyền riêng tư của ứng dụng ManiCash — quản lý tài chính cá nhân.',
};

export default function PrivacyPage() {
  return (
    <article>
      <h1>Chính sách quyền riêng tư</h1>
      <p className="legal-meta">
        Ngày hiệu lực: 01/06/2026 &nbsp;·&nbsp; Cập nhật lần cuối: 01/06/2026
      </p>

      <p>
        Chào mừng bạn đến với <strong>ManiCash</strong>. Chính sách này mô tả cách chúng tôi thu thập,
        sử dụng và bảo vệ thông tin của bạn khi sử dụng ứng dụng và các dịch vụ liên quan.
        Bằng cách sử dụng ManiCash, bạn đồng ý với các điều khoản trong chính sách này.
      </p>

      <h2>1. Thông tin về chủ thể xử lý dữ liệu</h2>
      <p>
        ManiCash được vận hành bởi <strong>ManiCash Team</strong> (cá nhân/tổ chức độc lập, không
        phải tổ chức tài chính được cấp phép). Để liên hệ về quyền riêng tư:
        <br />
        📧 <a href="mailto:privacy@manicash.app">privacy@manicash.app</a>
      </p>

      <h2>2. Dữ liệu chúng tôi thu thập</h2>
      <p>Chúng tôi thu thập các loại dữ liệu sau:</p>
      <ul>
        <li>
          <strong>Thông tin định danh:</strong> Email, tên hiển thị, ảnh đại diện — do Google cung cấp
          khi bạn đăng nhập bằng Google Sign-In.
        </li>
        <li>
          <strong>Dữ liệu tài chính:</strong> Giao dịch thu/chi bạn nhập, ngưỡng chi tiêu, mục tiêu
          tiết kiệm, số dư ví, snapshot ngân sách hàng tháng. Dữ liệu này do <em>bạn tự nhập</em> —
          chúng tôi không kết nối trực tiếp với ngân hàng hay tài khoản tài chính của bạn.
        </li>
        <li>
          <strong>Dữ liệu gamification:</strong> Điểm XP, streak, rank, nhiệm vụ kiếm tiền, huy hiệu.
        </li>
        <li>
          <strong>Dữ liệu hành vi:</strong> Các tính năng đã dùng, tần suất sử dụng (thông qua
          Firebase Analytics nếu bạn đồng ý).
        </li>
        <li>
          <strong>Dữ liệu AI (tùy chọn Pro):</strong> Khi bạn yêu cầu phân tích AI, chúng tôi gửi
          <em>số liệu đã tổng hợp</em> (tổng thu nhập, tổng chi tiêu tháng, tỷ lệ tiết kiệm) —
          không bao gồm note giao dịch cụ thể hay thông tin định danh — đến nhà cung cấp AI (Groq).
        </li>
      </ul>

      <h2>3. Mục đích sử dụng dữ liệu</h2>
      <ul>
        <li>Cung cấp và duy trì chức năng của ứng dụng</li>
        <li>Cá nhân hóa trải nghiệm gamification và nhắc nhở tài chính</li>
        <li>Tạo báo cáo tài chính và AI insights (chỉ với dữ liệu tổng hợp)</li>
        <li>Đồng bộ dữ liệu của bạn trên nhiều thiết bị qua Firebase Firestore</li>
        <li>Xác thực danh tính và bảo vệ tài khoản</li>
        <li>Cải thiện chất lượng ứng dụng (analytics ẩn danh)</li>
      </ul>

      <h2>4. Chia sẻ với bên thứ ba</h2>
      <p>Chúng tôi không bán dữ liệu của bạn. Dữ liệu chỉ được chia sẻ với:</p>
      <ul>
        <li>
          <strong>Google (Firebase):</strong> Dùng cho xác thực (Firebase Authentication) và lưu trữ
          dữ liệu (Cloud Firestore, Firebase Analytics).{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Chính sách bảo mật Google
          </a>
        </li>
        <li>
          <strong>Groq:</strong> Nhận số liệu tổng hợp ẩn danh để tạo nhận xét AI CFO (chỉ khi bạn
          kích hoạt tính năng này với tài khoản Pro).{' '}
          <a href="https://groq.com/privacy-policy" target="_blank" rel="noopener noreferrer">
            Chính sách bảo mật Groq
          </a>
        </li>
        <li>
          <strong>Vercel:</strong> Hosting ứng dụng web và API.{' '}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Chính sách bảo mật Vercel
          </a>
        </li>
      </ul>

      <div className="legal-note">
        <strong>Về AI và dữ liệu tài chính:</strong> Khi bạn yêu cầu phân tích AI, chúng tôi chỉ
        gửi các con số tổng hợp (ví dụ: "Thu nhập tháng: 15.000.000 VND, Chi tiêu: 9.000.000 VND").
        Chúng tôi <em>không</em> gửi nội dung ghi chú giao dịch, tên người, hay bất kỳ thông tin
        định danh nào đến Groq.
      </div>

      <h2>5. Lưu trữ và bảo mật dữ liệu</h2>
      <p>
        Dữ liệu của bạn được lưu trữ trên Firebase Firestore (máy chủ Google, khu vực Asia-Southeast).
        Chúng tôi áp dụng các biện pháp bảo mật bao gồm:
      </p>
      <ul>
        <li>Kết nối HTTPS/TLS cho toàn bộ truyền tải dữ liệu</li>
        <li>Firebase Security Rules ngăn chặn truy cập trái phép</li>
        <li>Mã hóa dữ liệu lưu trữ theo tiêu chuẩn của Google Cloud</li>
        <li>Không lưu thông tin thanh toán thẻ/ngân hàng trực tiếp</li>
      </ul>
      <p>
        Dữ liệu được giữ cho đến khi bạn xóa tài khoản. Sau khi xóa, dữ liệu sẽ bị xóa khỏi hệ
        thống trong vòng 30 ngày.
      </p>

      <h2>6. Quyền của bạn</h2>
      <p>Bạn có quyền:</p>
      <ul>
        <li><strong>Truy cập:</strong> Xem toàn bộ dữ liệu của bạn trong ứng dụng</li>
        <li><strong>Xuất:</strong> Tải dữ liệu dưới dạng JSON từ trang Hồ sơ</li>
        <li><strong>Sửa:</strong> Cập nhật thông tin hồ sơ bất kỳ lúc nào</li>
        <li>
          <strong>Xóa:</strong> Yêu cầu xóa toàn bộ tài khoản và dữ liệu qua trang Hồ sơ →
          "Xóa tài khoản", hoặc gửi email đến{' '}
          <a href="mailto:privacy@manicash.app">privacy@manicash.app</a>
        </li>
        <li><strong>Phản đối xử lý:</strong> Liên hệ chúng tôi nếu bạn không đồng ý với cách dữ liệu được dùng</li>
      </ul>

      <h2>7. Cookie và dữ liệu phiên</h2>
      <p>
        ManiCash chỉ sử dụng một session cookie (<code>manicash-session</code>) để duy trì trạng
        thái đăng nhập. Cookie này là cần thiết cho hoạt động của ứng dụng và không dùng cho mục
        đích quảng cáo.
      </p>

      <h2>8. Trẻ em</h2>
      <p>
        ManiCash không dành cho trẻ em dưới 13 tuổi. Chúng tôi không cố ý thu thập dữ liệu của trẻ
        em. Nếu bạn phát hiện tài khoản của trẻ em, vui lòng liên hệ chúng tôi để xóa ngay.
      </p>

      <h2>9. Thay đổi chính sách</h2>
      <p>
        Chúng tôi có thể cập nhật chính sách này. Khi có thay đổi quan trọng, chúng tôi sẽ thông
        báo qua email hoặc thông báo trong ứng dụng ít nhất 7 ngày trước khi có hiệu lực. Ngày
        "Cập nhật lần cuối" ở đầu trang luôn phản ánh phiên bản mới nhất.
      </p>

      <h2>10. Liên hệ</h2>
      <p>
        Mọi câu hỏi về quyền riêng tư, vui lòng liên hệ:
        <br />
        📧 <a href="mailto:privacy@manicash.app">privacy@manicash.app</a>
        <br />
        Chúng tôi cam kết phản hồi trong vòng 7 ngày làm việc.
      </p>
    </article>
  );
}
