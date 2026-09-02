import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const API_PROXY_TARGET = env.API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || "http://localhost:8083";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.API_PROXY_TARGET": JSON.stringify(API_PROXY_TARGET)
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: API_PROXY_TARGET,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 4173,
      proxy: {
        "/api": {
          target: API_PROXY_TARGET,
          changeOrigin: true
        }
      }
    }
  };
});
