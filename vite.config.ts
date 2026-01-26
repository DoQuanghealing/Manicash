import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load cả biến môi trường từ file .env và từ hệ thống (GitHub Actions)
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // Dùng './' là lựa chọn an toàn nhất cho GitHub Pages
    base: './', 
    
    plugins: [react()],
    
    define: {
      /**
       * SỬA TẠI ĐÂY: 
       * Chúng ta ưu tiên lấy VITE_GEMINI_API_KEY (từ deploy.yml)
       * Nếu không có thì mới lấy GEMINI_API_KEY (từ file .env máy cá nhân)
       */
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
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
