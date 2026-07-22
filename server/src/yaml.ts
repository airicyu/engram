/** Small wrappers around Bun's built-in YAML parser and formatter. */

import { YAML } from "bun";

/** Parse a single-document YAML string (Bun built-in; no npm `yaml`). */
export function parse(text: string): unknown {
  return YAML.parse(text);
}

/** Pretty-print YAML with a trailing newline (matches prior npm `yaml` write style). */
export function stringify(value: unknown): string {
  const out = YAML.stringify(value, null, 2);
  return out.endsWith("\n") ? out : `${out}\n`;
}
