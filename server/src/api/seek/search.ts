/** GET /memory/search — keyword search hits (short-term, chain, nodes). */

import { parseSearchScopes, searchMemory } from "../../seek/search";

export {
  SEARCH_SCOPES,
  parseSearchScopes,
  searchMemory as handleMemorySearch,
  type MemorySearchScope,
  type MemorySearchResult,
  type MemorySearchNodeHit,
  type MemorySearchShortTermHit,
  type MemorySearchChainHit,
} from "../../seek/search";

type SearchRequestError = "missing_q" | "invalid_scope";

/** Validate q/scope and run search. */
export async function handleMemorySearchRequest(
  q: string | null,
  scopeRaw: string | null,
): Promise<{ result: Awaited<ReturnType<typeof searchMemory>> } | { error: SearchRequestError }> {
  const trimmed = q?.trim();
  if (!trimmed) return { error: "missing_q" };
  const parsed = parseSearchScopes(scopeRaw);
  if ("error" in parsed) return { error: parsed.error };
  return { result: await searchMemory(trimmed, parsed.scopes) };
}
