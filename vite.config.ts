import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file dựa trên mode (development/production)
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Cách này giúp code cũ dùng process.env vẫn chạy được trên Vite
        'process.env': env 
      },
      resolve: {
        alias: {
          // Đảm bảo alias @ trỏ đúng vào thư mục gốc hoặc src
          '@': path.resolve(__dirname, './src'), 
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true
      }
    };
});
