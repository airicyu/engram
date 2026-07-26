/** Higher-level memory-chain (week / month / year) paths, reads, and initialized index. */

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, stringify } from "../../yaml";
import { homePath } from "../home";
import { extractCurrentSection } from "./nodes";
import {
  isValidMonthId,
  isValidWeekId,
  isValidYearId,
  monthYearKey,
  weekMonthKey,
  type ChainLevel,
} from "./chain-time";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export type HigherChainLevel = Exclude<ChainLevel, "day">;

export function weekSummaryRel(weekId: string): string {
  if (!isValidWeekId(weekId)) throw new Error(`invalid week id: ${weekId}`);
  return `memories/chain/weeks/${weekMonthKey(weekId)}/${weekId}.summary.md`;
}

export function monthSummaryRel(monthId: string): string {
  if (!isValidMonthId(monthId)) throw new Error(`invalid month id: ${monthId}`);
  return `memories/chain/months/${monthYearKey(monthId)}/${monthId}.summary.md`;
}

export function yearSummaryRel(yearId: string): string {
  if (!isValidYearId(yearId)) throw new Error(`invalid year id: ${yearId}`);
  return `memories/chain/years/${yearId}.summary.md`;
}

export function higherSummaryRel(level: HigherChainLevel, id: string): string {
  if (level === "week") return weekSummaryRel(id);
  if (level === "month") return monthSummaryRel(id);
  return yearSummaryRel(id);
}

export function weekSummaryPath(weekId: string): string {
  return homePath(...weekSummaryRel(weekId).split("/"));
}

export function monthSummaryPath(monthId: string): string {
  return homePath(...monthSummaryRel(monthId).split("/"));
}

export function yearSummaryPath(yearId: string): string {
  return homePath(...yearSummaryRel(yearId).split("/"));
}

export function higherSummaryPath(level: HigherChainLevel, id: string): string {
  return homePath(...higherSummaryRel(level, id).split("/"));
}

export async function readHigherSummaryFile(
  level: HigherChainLevel,
  id: string,
): Promise<string> {
  const p = higherSummaryPath(level, id);
  if (!(await exists(p))) return "";
  return readFile(p, "utf8");
}

export async function readHigherSummaryCurrent(
  level: HigherChainLevel,
  id: string,
): Promise<string> {
  const file = await readHigherSummaryFile(level, id);
  if (!file.trim()) return "";
  return extractCurrentSection(file);
}

export async function higherSummaryExists(
  level: HigherChainLevel,
  id: string,
): Promise<boolean> {
  return exists(higherSummaryPath(level, id));
}

async function listIdsFromGroupedSummaries(
  rootParts: string[],
  fileRe: RegExp,
  groupDirRe?: RegExp,
): Promise<string[]> {
  const root = homePath(...rootParts);
  try {
    const ids = new Set<string>();
    const entries = await readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (groupDirRe) {
        if (!e.isDirectory() || !groupDirRe.test(e.name)) continue;
        const files = await readdir(join(root, e.name));
        for (const f of files) {
          const m = f.match(fileRe);
          if (m) ids.add(m[1]);
        }
      } else if (e.isFile()) {
        const m = e.name.match(fileRe);
        if (m) ids.add(m[1]);
      }
    }
    return [...ids].sort().reverse();
  } catch {
    return [];
  }
}

export async function listWeekIds(): Promise<string[]> {
  return listIdsFromGroupedSummaries(
    ["memories", "chain", "weeks"],
    /^(\d{4}-W\d{2})\.summary\.md$/,
    /^\d{4}-\d{2}$/,
  );
}

export async function listMonthIds(): Promise<string[]> {
  return listIdsFromGroupedSummaries(
    ["memories", "chain", "months"],
    /^(\d{4}-\d{2})\.summary\.md$/,
    /^\d{4}$/,
  );
}

export async function listYearIds(): Promise<string[]> {
  return listIdsFromGroupedSummaries(
    ["memories", "chain", "years"],
    /^(\d{4})\.summary\.md$/,
  );
}

function initializedYamlPath(level: HigherChainLevel): string {
  return homePath("memories", "chain", `initialized_${level}s.yaml`);
}

export async function readInitializedIds(level: HigherChainLevel): Promise<string[]> {
  const p = initializedYamlPath(level);
  if (!(await exists(p))) return [];
  try {
    const doc = parse(await readFile(p, "utf8")) as { ids?: unknown };
    if (!Array.isArray(doc?.ids)) return [];
    return doc.ids.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Mark ids as initialized (idempotent add). Call only after successful approve of init. */
export async function addInitializedIds(
  level: HigherChainLevel,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const existing = new Set(await readInitializedIds(level));
  for (const id of ids) existing.add(id);
  const sorted = [...existing].sort();
  const p = initializedYamlPath(level);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, stringify({ ids: sorted }), "utf8");
}

/**
 * Whether this id should use revise (file exists or already initialized).
 * File existence wins; missing yaml is healed on approve.
 */
export async function resolveHigherOperation(
  level: HigherChainLevel,
  id: string,
): Promise<"init" | "revise"> {
  if (await higherSummaryExists(level, id)) return "revise";
  const initialized = await readInitializedIds(level);
  if (initialized.includes(id)) return "revise";
  return "init";
}
