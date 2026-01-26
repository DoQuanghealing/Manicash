import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // base phải khớp chính xác với tên repo trên GitHub
    base: '/ManiCash/', 
    
    plugins: [react()],
    
    define: {
      // Fix lỗi "process is not defined" khi chạy trên trình duyệt
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    
    resolve: {
      alias: {
        // Giúp bạn import file bằng dấu @ (ví dụ: import x from '@/components/x')
        '@': path.resolve(__dirname, './'),
      },
    },
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      // ĐÃ GỠ BỎ ROLLUPOPTIONS EXTERNAL
      // Bây giờ Vite sẽ tự động đóng gói React và các thư viện khác vào tệp 'dist'
    },
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
