import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ file .env hoặc GitHub Secrets
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // base: './' giúp tránh lỗi đường dẫn khi deploy lên Vercel/GitHub Pages
    base: './', 

    plugins: [react()],

    define: {
      // Cho phép code sử dụng process.env nếu cần, nhưng ưu tiên import.meta.env
      'process.env': env,
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        // Cấu hình @ trỏ thẳng vào thư mục gốc để khớp với các lệnh import của bạn
        '@': path.resolve(__dirname, './'),
      },
    },

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Giúp quá trình build sạch sẽ hơn
      emptyOutDir: true,
    },
  };
});
