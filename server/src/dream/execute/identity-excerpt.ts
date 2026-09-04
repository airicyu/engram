/** Mechanical Identity excerpt for day-extract frozen JSON (0.45). */

const IDENTITY_HEADING = /^## Identity\s*$/;
const NEXT_H2 = /^## /;

/**
 * Excerpt the first exact `## Identity` section from a live node main file.
 * Does not treat `### Identity`, `## identity`, or non-English titles as a match.
 */
export function extractIdentityExcerpt(md: string): string {
  const text = md.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (IDENTITY_HEADING.test(lines[i]!)) {
      start = i;
      break;
    }
  }
  if (start < 0) return "";

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (NEXT_H2.test(lines[i]!)) {
      end = i;
      break;
    }
  }

  const body = lines.slice(start + 1, end).join("\n").trim();
  if (!body) return "_None_";

  const bodyLines = body.split("\n");
  let excerpt = bodyLines.slice(0, 8).join("\n");
  let truncated = bodyLines.length > 8;
  if (excerpt.length > 500) {
    excerpt = excerpt.slice(0, 500);
    truncated = true;
  }
  if (truncated) excerpt += "…";
  return excerpt;
}
