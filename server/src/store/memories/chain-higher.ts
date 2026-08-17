/** Higher-level memory-chain (week / month / year) paths, reads, and init/revise via summary files. */

import { access, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
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
    /^(\d{4}-W\d{2}-\d{4})\.summary\.md$/,
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

const LEGACY_INITIALIZED_YAML_RELS = [
  "memories/chain/initialized_weeks.yaml",
  "memories/chain/initialized_months.yaml",
  "memories/chain/initialized_years.yaml",
] as const;

/**
 * Remove leftover 0.11 `initialized_*.yaml` indexes (init/revise is file existence only).
 * Returns store-relative paths that existed and were deleted (for git staging).
 */
export async function dropLegacyInitializedYaml(): Promise<string[]> {
  const removed: string[] = [];
  for (const rel of LEGACY_INITIALIZED_YAML_RELS) {
    const p = homePath(...rel.split("/"));
    if (!(await exists(p))) continue;
    await rm(p, { force: true });
    removed.push(rel);
  }
  return removed;
}

/** `revise` when the higher summary file exists; otherwise `init`. */
export async function resolveHigherOperation(
  level: HigherChainLevel,
  id: string,
): Promise<"init" | "revise"> {
  return (await higherSummaryExists(level, id)) ? "revise" : "init";
}
