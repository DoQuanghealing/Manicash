import React from 'react';
import ReactDOM from 'react-dom/client';
// Import tệp App từ cùng thư mục
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  // Thêm thông báo này để dễ debug nếu lỡ tay xóa mất id="root" trong index.html
  console.error("LỖI: Không tìm thấy thẻ <div id='root'></div> trong file index.html");
} else {
  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
