import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const engramUrl = (env.ENGRAM_URL || "http://localhost:8787").replace(/\/$/, "");
  const port = Number(env.WEB_PORT || 8788);

  return {
    envDir: repoRoot,
    plugins: [react()],
    server: {
      host: "127.0.0.1",
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
      host: "127.0.0.1",
      port,
    },
  };
});
