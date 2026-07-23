/** GET /memory/search — keyword search hits (L1, chain, nodes). */

import { parseSearchScopes, searchMemory } from "../../memory/search";

export {
  SEARCH_SCOPES,
  parseSearchScopes,
  searchMemory as handleMemorySearch,
  type MemorySearchScope,
  type MemorySearchResult,
  type MemorySearchNodeHit,
  type MemorySearchL1Hit,
  type MemorySearchChainHit,
} from "../../memory/search";

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
