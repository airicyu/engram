import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const engramUrl = (env.ENGRAM_URL || "http://localhost:8787").replace(/\/$/, "");
  const port = Number(env.WEB_PORT || 8788);

  return {
    plugins: [react()],
    server: {
      port,
      strictPort: true,
      proxy: {
        "/api": {
          target: engramUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    preview: {
      port,
    },
  };
});
