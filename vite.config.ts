import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env': env 
      },
      resolve: {
        alias: {
          // Trỏ về gốc để khớp với cấu trúc file hiện tại của bạn
          '@': path.resolve(__dirname, './'), 
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        // Đảm bảo không bị lỗi đường dẫn khi deploy lên Vercel
        assetsDir: 'assets',
      }
    };
});
