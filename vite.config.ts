import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // Phải khớp chính xác với tên Repository mới của bạn trên GitHub
    base: '/ManiCash/', 
    
    plugins: [react()],
    
    define: {
      // Đảm bảo không bị lỗi "process is not defined"
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
      rollupOptions: {
        // CHỈ để external nếu bạn chắc chắn index.html đã có importmap cho chúng
        // Nếu không chắc, hãy xóa phần external này để Vite tự đóng gói (khuyên dùng)
        external: [
          'react',
          'react-dom',
          'lucide-react',
          '@google/genai'
        ],
        output: {
          // Giúp các thư viện external ánh xạ đúng với Import Maps trong HTML
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          }
        }
      },
    },
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
