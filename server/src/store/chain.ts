import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
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

export async function applyChainDay(opts: {
  dayId: string;
  content: string;
  patchId: string;
  eventRefs: string[];
}): Promise<void> {
  await mkdir(homePath("memory-chain", "days"), { recursive: true });
  const p = dayPath(opts.dayId);
  const marker = `<!-- patch:${opts.patchId} -->`;

  if (await exists(p)) {
    const existing = await readFile(p, "utf8");
    if (existing.includes(marker)) {
      return; // idempotent: same patch already in day file
    }
  }

  const refs = opts.eventRefs.join(", ");
  const block = [
    marker,
    `### patch:${opts.patchId} · events:[${refs}]`,
    "",
    opts.content.trim(),
    "",
  ].join("\n");

  if (await exists(p)) {
    await appendFile(p, block, "utf8");
  } else {
    await writeFile(p, `# ${opts.dayId}\n\n${block}`, "utf8");
  }
}
