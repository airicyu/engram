import { access, readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { homePath } from "./home";

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

export async function readExtractState(): Promise<ExtractState> {
  if (!(await exists(statePath()))) return { status: "never" };
  const data = parse(await readFile(statePath(), "utf8")) as ExtractState;
  return data ?? { status: "never" };
}

export async function writeExtractState(state: ExtractState): Promise<void> {
  await writeFile(
    statePath(),
    stringify({ ...state, at: new Date().toISOString() }),
    "utf8",
  );
}
