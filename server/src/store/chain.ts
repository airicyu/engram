import { access, readFile } from "node:fs/promises";
import { homePath } from "./home";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function dayPath(dayId: string): string {
  return homePath("memory-chain", "days", `${dayId}.md`);
}

export async function readDay(dayId: string): Promise<string> {
  const p = dayPath(dayId);
  if (!(await exists(p))) return "";
  return readFile(p, "utf8");
}
