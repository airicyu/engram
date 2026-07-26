/** Load and render {{TOKEN}} prompt templates. */

import { readFile } from "node:fs/promises";

/** Read a prompt markdown file as UTF-8. */
export async function loadPrompt(absolutePath: string): Promise<string> {
  return readFile(absolutePath, "utf8");
}

/**
 * Replace all `{{KEY}}` occurrences. Throws if any `{{TOKEN}}` remains.
 */
export function renderPrompt(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  const leftover = out.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (leftover && leftover.length > 0) {
    const uniq = [...new Set(leftover)];
    throw new Error(`prompt has unreplaced tokens: ${uniq.join(", ")}`);
  }
  return out;
}
