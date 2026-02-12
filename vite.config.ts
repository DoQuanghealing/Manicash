import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      // Vì không có /src, chúng ta trỏ @ trực tiếp vào thư mục gốc
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
    // Đảm bảo Vite tìm đúng file entry chính tại thư mục gốc
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
});
