import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | ManiCash',
  description: 'Điều khoản sử dụng dịch vụ ManiCash — ứng dụng quản lý tài chính cá nhân.',
};

export default function TermsPage() {
  return (
    <article>
      <h1>Điều khoản sử dụng</h1>
      <p className="legal-meta">
        Ngày hiệu lực: 01/06/2026 &nbsp;·&nbsp; Cập nhật lần cuối: 01/06/2026
      </p>

      <p>
        Bằng cách tải xuống, cài đặt hoặc sử dụng ứng dụng <strong>ManiCash</strong>, bạn đồng ý
        bị ràng buộc bởi các điều khoản này. Nếu bạn không đồng ý, vui lòng không sử dụng ứng dụng.
      </p>

      <h2>1. Dịch vụ cung cấp</h2>
      <p>
        ManiCash là ứng dụng quản lý tài chính cá nhân cho phép người dùng ghi chép thu/chi, đặt
        ngân sách, theo dõi mục tiêu tiết kiệm, và nhận phân tích AI về tình trạng tài chính cá nhân.
        Ứng dụng có hai gói: <strong>Free</strong> và <strong>Pro</strong>.
      </p>

      <h2>2. Điều kiện sử dụng</h2>
      <ul>
        <li>Bạn phải từ 13 tuổi trở lên để sử dụng ManiCash</li>
        <li>Bạn chịu trách nhiệm bảo mật tài khoản Google của mình</li>
        <li>Một người chỉ được tạo một tài khoản cá nhân</li>
        <li>Bạn không được tạo tài khoản thay mặt người khác mà không có sự đồng ý của họ</li>
      </ul>

      <h2>3. Hành vi bị cấm</h2>
      <p>Bạn không được:</p>
      <ul>
        <li>Dịch ngược, giải mã hoặc cố gắng trích xuất mã nguồn của ứng dụng</li>
        <li>Tự động hóa truy cập API (scraping, bot) mà không có sự cho phép bằng văn bản</li>
        <li>Cố ý khai thác lỗ hổng bảo mật; nếu phát hiện, hãy báo cáo cho chúng tôi</li>
        <li>Sử dụng ứng dụng cho mục đích bất hợp pháp theo pháp luật Việt Nam</li>
        <li>Chia sẻ tài khoản Pro với người khác hoặc bán lại quyền truy cập</li>
      </ul>

      <h2>4. Tuyên bố miễn trách nhiệm về AI CFO</h2>
      <div className="legal-note">
        <strong>⚠️ Quan trọng:</strong> Các nhận xét, gợi ý và phân tích từ tính năng AI CFO
        (Lord Diamond) chỉ mang tính <strong>tham khảo và giải trí</strong>. Đây <em>không phải</em>{' '}
        tư vấn tài chính, đầu tư hay pháp lý chuyên môn được cấp phép. ManiCash không phải tổ chức
        tài chính. Bạn hoàn toàn chịu trách nhiệm về mọi quyết định tài chính của mình. Hãy tham
        khảo chuyên gia tài chính được cấp phép trước khi đưa ra các quyết định tài chính quan trọng.
      </div>

      <h2>5. Thanh toán và hoàn tiền</h2>
      <p>
        Gói Pro được thanh toán qua Google Play (in-app purchase). Giá hiện tại là
        <strong> 49.000 VND/tháng</strong>. Chính sách hoàn tiền tuân theo{' '}
        <a href="https://support.google.com/googleplay/answer/2479637" target="_blank" rel="noopener noreferrer">
          chính sách hoàn tiền của Google Play
        </a>. Trong vòng 48 giờ sau khi mua, bạn có thể yêu cầu hoàn tiền trực tiếp qua Google Play.
      </p>
      <p>
        Sau khi huỷ gói Pro, bạn tiếp tục được dùng tính năng Pro đến hết chu kỳ thanh toán hiện tại.
      </p>

      <h2>6. Sở hữu trí tuệ</h2>
      <p>
        ManiCash và tất cả nội dung liên quan (logo, thiết kế, code, nội dung) là tài sản trí tuệ
        của ManiCash Team. Bạn được cấp phép sử dụng cá nhân, phi thương mại. Bạn không được sao
        chép, phân phối hay tạo sản phẩm phái sinh mà không có sự cho phép bằng văn bản.
      </p>

      <h2>7. Gián đoạn dịch vụ</h2>
      <p>
        Chúng tôi cố gắng duy trì ứng dụng hoạt động liên tục, nhưng không đảm bảo 100% uptime.
        Dịch vụ có thể gián đoạn do bảo trì, sự cố kỹ thuật hoặc các yếu tố ngoài tầm kiểm soát.
        Chúng tôi không chịu trách nhiệm về tổn thất phát sinh từ sự gián đoạn này.
      </p>

      <h2>8. Giới hạn trách nhiệm</h2>
      <p>
        Trong phạm vi tối đa được pháp luật cho phép, ManiCash Team không chịu trách nhiệm về:
      </p>
      <ul>
        <li>Quyết định tài chính của bạn dựa trên thông tin từ ứng dụng</li>
        <li>Mất mát dữ liệu do sự cố kỹ thuật ngoài tầm kiểm soát</li>
        <li>Thiệt hại gián tiếp, đặc biệt hoặc hệ quả phát sinh từ việc sử dụng ứng dụng</li>
      </ul>

      <h2>9. Chấm dứt</h2>
      <p>
        Bạn có thể chấm dứt sử dụng bất cứ lúc nào bằng cách xóa tài khoản. Chúng tôi có quyền
        đình chỉ hoặc xóa tài khoản vi phạm các điều khoản này, có hoặc không cần thông báo trước
        tùy theo mức độ vi phạm.
      </p>

      <h2>10. Luật áp dụng</h2>
      <p>
        Các điều khoản này được điều chỉnh bởi pháp luật <strong>Việt Nam</strong>. Mọi tranh chấp
        sẽ được giải quyết tại tòa án có thẩm quyền tại Việt Nam.
      </p>

      <h2>11. Thay đổi điều khoản</h2>
      <p>
        Chúng tôi có thể cập nhật điều khoản này. Thay đổi quan trọng sẽ được thông báo trước ít
        nhất 7 ngày. Tiếp tục sử dụng ứng dụng sau khi thay đổi có hiệu lực đồng nghĩa với việc
        bạn chấp nhận điều khoản mới.
      </p>

      <h2>12. Liên hệ</h2>
      <p>
        Câu hỏi về điều khoản sử dụng:
        <br />
        📧 <a href="mailto:legal@manicash.app">legal@manicash.app</a>
      </p>
    </article>
  );
}
