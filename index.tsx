import React from 'react';
import ReactDOM from 'react-dom/client';
// Đảm bảo tệp App.tsx nằm cùng thư mục và đã có 'export default App'
import App from './App';

/**
 * Khởi tạo ứng dụng React
 * Kết nối với thẻ <div id="root"></div> trong tệp index.html
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  // Lỗi này thường xảy ra nếu script chạy trước khi DOM kịp tải xong
  console.error("Không tìm thấy phần tử 'root'. Kiểm tra lại index.html!");
} else {
  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
