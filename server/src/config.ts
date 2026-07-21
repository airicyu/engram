import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");

export const TIMEZONE = "Asia/Taipei" as const;

export const config = {
  port: Number(process.env.PORT ?? 8787),
  engramHome: resolve(process.env.ENGRAM_HOME ?? resolve(repoRoot, "data")),
  claudeBin: process.env.CLAUDE_BIN ?? "claude",
  cursorAgentBin: process.env.CURSOR_AGENT_BIN ?? "agent",
  timezone: TIMEZONE,
};
