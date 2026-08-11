/**
 * Convert Obsidian-style node wikilinks to markdown links targeting hash routes.
 * See docs/roadmap/0.31.0/docs/hash-routing-and-wikilinks.md
 */

/** Encode node id for `#/memory/nodes/{id}` (readable when safe). */
function encodeNodeId(id: string): string {
  if (/^[A-Za-z0-9._-]+$/.test(id)) return id;
  return encodeURIComponent(id);
}

function toMdLink(label: string, id: string): string {
  return `[${label}](#/memory/nodes/${encodeNodeId(id)})`;
}

/**
 * Preprocess markdown before react-markdown.
 * - P1 `[[nodes/{id}/{id}|label]]` / `[[nodes/{id}/{id}]]` always convert (symmetric path).
 * - Short `[[id]]` / `[[id|label]]` only when `knownNodeIds` contains id and destination has no `/`.
 * - Never touches `![[…]]` embeds.
 * - Leaves heading／block refs (`#`, `^`) and asymmetric paths alone.
 */
export function preprocessNodeWikilinks(
  md: string,
  knownNodeIds?: ReadonlySet<string> | readonly string[] | null,
): string {
  const known =
    knownNodeIds == null
      ? null
      : knownNodeIds instanceof Set
        ? knownNodeIds
        : new Set(knownNodeIds);

  return md.replace(/(!)?\[\[([^\]]+)\]\]/g, (full, bang: string | undefined, inner: string) => {
    if (bang) return full;

    // Skip Obsidian heading／block refs for this version.
    if (inner.includes("#") || inner.includes("^")) return full;

    const pipe = inner.indexOf("|");
    const dest = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const labelRaw = pipe >= 0 ? inner.slice(pipe + 1).trim() : "";
    if (!dest) return full;

    const p1 = /^nodes\/([^/]+)\/\1$/.exec(dest);
    if (p1) {
      const id = p1[1]!;
      const label = labelRaw || id;
      return toMdLink(label, id);
    }

    // Asymmetric nodes/a/b — leave alone
    if (dest.startsWith("nodes/")) return full;

    // Short form: no slash in destination
    if (dest.includes("/")) return full;
    if (!known || !known.has(dest)) return full;
    const label = labelRaw || dest;
    return toMdLink(label, dest);
  });
}
