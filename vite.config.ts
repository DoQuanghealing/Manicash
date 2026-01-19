import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    
    // ĐÂY LÀ DÒNG QUAN TRỌNG NHẤT GIÚP CHỮA MÀN HÌNH ĐEN
    base: "/Doucash/", 

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        // Cách viết gọn nhẹ, ít lỗi hơn cho alias
        '@': '/src', 
      }
    }
  };
});
