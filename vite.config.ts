import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // SỬA TẠI ĐÂY: Dùng './' thay vì '/ManiCash/' để tránh lỗi phân biệt hoa/thường trên GitHub
    base: './', 
    
    plugins: [react()],
    
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Bổ sung để fix lỗi nếu thư viện yêu cầu process.env
      'process.env': env 
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      // Đảm bảo tệp JS được tạo ra có đường dẫn đúng
      modulePreload: {
        polyfill: true
      }
    },
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
