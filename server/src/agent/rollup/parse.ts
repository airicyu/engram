/** Rollup plan JSON parse + writer preamble strip. */

import { access, readFile } from "node:fs/promises";
import type { RollupPlan } from "../../dream/rollup/cascade";

export function parsePlanJson(raw: string): RollupPlan {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("rollup plan: no JSON object in result file");
  }
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as RollupPlan;
  if (!obj || typeof obj !== "object") throw new Error("rollup plan: invalid JSON");
  return obj;
}

/**
 * If an agent left process narration above the first `##`, keep from that title.
 * Prefer empty preamble (file deliverable); this is defense in depth.
 */
export function stripRollupWriterPreamble(text: string): string {
  const m = text.match(/^##\s+\S/m);
  if (!m || m.index == null) return text.trim();
  let body = text.slice(m.index);
  const lines = body.split(/\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (
      i > 0 &&
      !line.startsWith("##") &&
      /^(Reading |Checking |Writing |Looking |Saved |Created |已寫入|以下是)/.test(
        line,
      )
    ) {
      break;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

export async function readRequiredFile(path: string, label: string): Promise<string> {
  try {
    await access(path);
  } catch {
    throw new Error(`${label} result file missing: ${path}`);
  }
  return (await readFile(path, "utf8")).trim();
}

