import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Chỉ load các biến môi trường có prefix VITE_
  loadEnv(mode, ".", "VITE_");

  return {
    // QUAN TRỌNG: base tương đối để chạy ổn trên GitHub Pages
    base: "./",

    server: {
      port: 3000,
      host: "0.0.0.0",
    },

    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
