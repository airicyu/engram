/**
 * Locate Engram agent skills under the product repo.
 *
 * Layout: `<repo>/{.agents|.claude|.codex}/skills/<skill-name>/`
 * Prefer a **full** skill directory (has `scripts/` or companion docs) over
 * thin Claude stubs that only point at `.agents/skills/…`.
 */

import { accessSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Prefer canonical content tree first, then tool-specific wrappers. */
const SKILL_VENDOR_DIRS = [".agents", ".claude", ".codex"] as const;

function exists(path: string): boolean {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/** True when the directory looks like a full skill (not a redirect-only stub). */
export function isFullSkillDir(dir: string): boolean {
  if (exists(join(dir, "scripts"))) return true;
  if (exists(join(dir, "workflows.md"))) return true;
  if (exists(join(dir, "api-reference.md"))) return true;
  if (exists(join(dir, "patterns.md"))) return true;
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith("migrate-") && name.endsWith(".md")) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Absolute path to `<repo>/{vendor}/skills` that contains at least one full skill, else first existing. */
export function resolveAgentSkillsRoot(repoRoot: string): string | null {
  let fallback: string | null = null;
  for (const vendor of SKILL_VENDOR_DIRS) {
    const root = join(repoRoot, vendor, "skills");
    if (!exists(root)) continue;
    fallback ??= root;
    try {
      for (const name of readdirSync(root)) {
        if (isFullSkillDir(join(root, name))) return root;
      }
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

/** Absolute path to a named skill directory, preferring a full skill over a stub. */
export function resolveAgentSkillDir(repoRoot: string, skillName: string): string | null {
  let fallback: string | null = null;
  for (const vendor of SKILL_VENDOR_DIRS) {
    const dir = join(repoRoot, vendor, "skills", skillName);
    if (!exists(dir)) continue;
    if (isFullSkillDir(dir)) return dir;
    fallback ??= dir;
  }
  return fallback;
}
