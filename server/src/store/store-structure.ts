/**
 * Store structure generation gate (boot): refuse start when disk is older than
 * this binary's minimum structure major.minor.
 */

import { peekStoreVersion } from "../config";

/**
 * Minimum store structure generation this product binary requires.
 * Bump **only** when a migrate hop changes on-disk shape (not every product release).
 */
export const REQUIRED_STORE_STRUCTURE = { major: 0, minor: 19 } as const;

/** Human-facing floor string for messages (patch ignored in comparisons). */
export const REQUIRED_STORE_STRUCTURE_LABEL = `${REQUIRED_STORE_STRUCTURE.major}.${REQUIRED_STORE_STRUCTURE.minor}.0`;

export type MajorMinor = { major: number; minor: number };

/** Parse `X.Y.Z` → `{ major, minor }`; invalid → null. */
export function parseMajorMinor(version: string): MajorMinor | null {
  const m = version.trim().match(/^(\d+)\.(\d+)\.\d+$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

/** True if `have` major.minor >= `need`. */
export function structureAtLeast(have: MajorMinor, need: MajorMinor): boolean {
  if (have.major !== need.major) return have.major > need.major;
  return have.minor >= need.minor;
}

export type StoreStructureCheck =
  | { ok: true; store_version: string }
  | { ok: false; reason: "missing" | "too_old"; store_version: string | null; message: string };

/**
 * Evaluate whether disk store_version meets {@link REQUIRED_STORE_STRUCTURE}.
 * Does not exit; caller decides.
 */
export function checkStoreStructure(storeVersion: string | null = peekStoreVersion()): StoreStructureCheck {
  const need = REQUIRED_STORE_STRUCTURE;
  const needLabel = REQUIRED_STORE_STRUCTURE_LABEL;
  const migrateHint =
    "Migrate with the engram-migration skill (hop migrate-0.17-to-0.19). See .claude/skills/engram-migration/";

  if (storeVersion == null) {
    return {
      ok: false,
      reason: "missing",
      store_version: null,
      message:
        `engram: store_version missing in engram.workspace.yaml; this binary requires structure >= ${needLabel}. ${migrateHint}`,
    };
  }

  const have = parseMajorMinor(storeVersion);
  if (!have) {
    return {
      ok: false,
      reason: "missing",
      store_version: storeVersion,
      message:
        `engram: store_version ${JSON.stringify(storeVersion)} is not usable; this binary requires structure >= ${needLabel}. ${migrateHint}`,
    };
  }

  if (!structureAtLeast(have, need)) {
    return {
      ok: false,
      reason: "too_old",
      store_version: storeVersion,
      message:
        `engram: store structure too old (store_version=${storeVersion}, need >= ${needLabel}). ${migrateHint}`,
    };
  }

  return { ok: true, store_version: storeVersion };
}

/**
 * After ensureEngramHome: refuse process start if structure too old／missing.
 * Escape: ENGRAM_ALLOW_STALE_STORE=1 → warn and continue.
 */
export function assertStoreStructureOrExit(): void {
  const result = checkStoreStructure(peekStoreVersion());
  if (result.ok) return;

  const allowStale = process.env.ENGRAM_ALLOW_STALE_STORE === "1";
  if (allowStale) {
    console.error(`engram warning (ENGRAM_ALLOW_STALE_STORE=1): ${result.message}`);
    return;
  }

  console.error(result.message);
  process.exit(1);
}
