/** Runtime configuration resolved from environment variables and defaults. */

import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");

/** IANA timezone for calendar days and event timestamps. Override with ENGRAM_TZ. */
export const DEFAULT_TIMEZONE = "Asia/Hong_Kong";

/** Resolved server port, storage home, agent binaries, and timezone. */
export const config = {
  port: Number(process.env.PORT ?? 8787),
  engramHome: resolve(process.env.ENGRAM_HOME ?? resolve(repoRoot, "data")),
  claudeBin: process.env.CLAUDE_BIN ?? "claude",
  cursorAgentBin: process.env.CURSOR_AGENT_BIN ?? "agent",
  timezone: process.env.ENGRAM_TZ?.trim() || DEFAULT_TIMEZONE,
};
