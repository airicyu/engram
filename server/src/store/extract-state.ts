/** Persistent status of the latest dream extraction attempt. */

import { access, readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "../yaml";
import { homePath } from "./home";

/** Stored outcome of the latest extraction attempt. */
export type ExtractState = {
  status: "ok" | "failed" | "never";
  dream_run_id?: string;
  message?: string;
  at?: string;
};

function statePath(): string {
  return homePath("dream", "extract-state.yaml");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Read extraction state, defaulting to never run. */
export async function readExtractState(): Promise<ExtractState> {
  if (!(await exists(statePath()))) return { status: "never" };
  const data = parse(await readFile(statePath(), "utf8")) as ExtractState;
  return data ?? { status: "never" };
}

/** Persist extraction state with its update timestamp. */
export async function writeExtractState(state: ExtractState): Promise<void> {
  await writeFile(
    statePath(),
    stringify({ ...state, at: new Date().toISOString() }),
    "utf8",
  );
}
