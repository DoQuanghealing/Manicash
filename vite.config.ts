import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // Phải khớp chính xác với tên Repository trên GitHub của bạn
    base: '/ManiCash/', 
    
    plugins: [react()],
    
    define: {
      // Giúp ứng dụng không bị lỗi "process is not defined" trong trình duyệt
      'process.env': env,
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
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
      // Cấu hình để Rollup (bộ build của Vite) không báo lỗi khi gặp các thư viện từ ESM.sh
      rollupOptions: {
        external: [
          'react',
          'react-dom',
          'lucide-react',
          '@google/genai'
        ],
      },
    },
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
