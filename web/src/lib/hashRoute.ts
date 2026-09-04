import type { SceneId } from "./types";

export type ChainLevel = "day" | "week" | "month" | "year";

export type MemoryHash =
  | { mode: "chain"; level?: ChainLevel; id?: string }
  | { mode: "nodes"; id?: string }
  | { mode: "future"; id?: string };

export type HashRoute =
  | { scene: Exclude<SceneId, "memory" | "dream_reports"> }
  | { scene: "dream_reports"; dream_run_id?: string }
  | { scene: "memory"; memory: MemoryHash };

const SCENES = new Set<SceneId>([
  "activities",
  "consolidate",
  "clarify",
  "seek",
  "memory",
]);

const CHAIN_LEVELS = new Set<ChainLevel>(["day", "week", "month", "year"]);

const SAFE_ID = /^[A-Za-z0-9._-]+$/;

/** Encode path segment; leave safe ids unescaped for readable URLs. */
export function encodeHashId(id: string): string {
  if (SAFE_ID.test(id)) return id;
  return encodeURIComponent(id);
}

export function decodeHashId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Parse `location.hash` into a route.
 * Empty／unrecognized → activities. Bad memory subpath → memory + chain mode.
 */
export function parseHash(hash: string): HashRoute {
  const raw = (hash.startsWith("#") ? hash.slice(1) : hash).trim();
  const path = raw.startsWith("/") ? raw.slice(1) : raw;
  if (!path) return { scene: "activities" };

  // Ignore query string for this version.
  const noQuery = path.split("?")[0] ?? path;
  const parts = noQuery.split("/").filter(Boolean);
  if (parts.length === 0) return { scene: "activities" };

  const head = parts[0]!;
  if (head === "dream-reports") {
    const id = parts[1] ? decodeHashId(parts[1]) : undefined;
    if (id) return { scene: "dream_reports", dream_run_id: id };
    return { scene: "dream_reports" };
  }
  if (!SCENES.has(head as SceneId)) return { scene: "activities" };

  if (head !== "memory") {
    return { scene: head as Exclude<SceneId, "memory" | "dream_reports"> };
  }

  // #/memory
  if (parts.length === 1) {
    return { scene: "memory", memory: { mode: "chain" } };
  }

  if (parts[1] === "nodes") {
    if (parts.length >= 3 && parts[2]) {
      return {
        scene: "memory",
        memory: { mode: "nodes", id: decodeHashId(parts[2]) },
      };
    }
    return { scene: "memory", memory: { mode: "nodes" } };
  }

  if (parts[1] === "future") {
    if (parts.length >= 3 && parts[2]) {
      return {
        scene: "memory",
        memory: { mode: "future", id: decodeHashId(parts[2]) },
      };
    }
    return { scene: "memory", memory: { mode: "future" } };
  }

  if (parts[1] === "chain") {
    const level = parts[2] as ChainLevel | undefined;
    if (!level || !CHAIN_LEVELS.has(level)) {
      return { scene: "memory", memory: { mode: "chain" } };
    }
    if (parts.length >= 4 && parts[3]) {
      return {
        scene: "memory",
        memory: { mode: "chain", level, id: decodeHashId(parts[3]) },
      };
    }
    return { scene: "memory", memory: { mode: "chain", level } };
  }

  // Extra／unknown segments under memory → chain mode
  return { scene: "memory", memory: { mode: "chain" } };
}

/** Serialize route to a hash string including leading `#`. */
export function serializeHash(route: HashRoute): string {
  if (route.scene === "dream_reports") {
    if (route.dream_run_id) {
      return `#/dream-reports/${encodeHashId(route.dream_run_id)}`;
    }
    return `#/dream-reports`;
  }
  if (route.scene !== "memory") {
    return `#/${route.scene}`;
  }
  const m = route.memory;
  if (m.mode === "nodes") {
    if (m.id) return `#/memory/nodes/${encodeHashId(m.id)}`;
    return `#/memory/nodes`;
  }
  if (m.mode === "future") {
    if (m.id) return `#/memory/future/${encodeHashId(m.id)}`;
    return `#/memory/future`;
  }
  if (m.level && m.id) {
    return `#/memory/chain/${m.level}/${encodeHashId(m.id)}`;
  }
  if (m.level) return `#/memory/chain/${m.level}`;
  return `#/memory`;
}

/** Write hash via history API (does not fire hashchange). */
export function writeHash(hash: string, mode: "push" | "replace"): void {
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (location.hash === next) return;
  const url = `${location.pathname}${location.search}${next}`;
  if (mode === "replace") {
    history.replaceState(history.state, "", url);
  } else {
    history.pushState(history.state, "", url);
  }
}

export function routesEqual(a: HashRoute, b: HashRoute): boolean {
  return serializeHash(a) === serializeHash(b);
}

export function memoryHashEqual(a: MemoryHash, b: MemoryHash): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "nodes" && b.mode === "nodes") {
    return (a.id ?? "") === (b.id ?? "");
  }
  if (a.mode === "future" && b.mode === "future") {
    return (a.id ?? "") === (b.id ?? "");
  }
  if (a.mode === "chain" && b.mode === "chain") {
    return (a.level ?? "") === (b.level ?? "") && (a.id ?? "") === (b.id ?? "");
  }
  return false;
}
