import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Chỉ load các biến môi trường có prefix VITE_
  const env = loadEnv(mode, ".", "VITE_");

  return {
    base: "/Doucash/",
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
    // Không cần define API key vào process.env nữa
    // Vite sẽ expose biến môi trường qua import.meta.env.VITE_*
  };
});

