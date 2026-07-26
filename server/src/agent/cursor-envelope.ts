/** Low-level Cursor CLI JSON envelope / fenced-block helpers (no domain schema). */

/** Unwrap Cursor `--output-format json` result envelope when present. */
export function unwrapCursorResultEnvelope(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const envelope = JSON.parse(trimmed) as {
      type?: string;
      result?: string;
      is_error?: boolean;
    };
    if (envelope.type === "result") {
      if (envelope.is_error) throw new Error(envelope.result || "agent error");
      if (typeof envelope.result === "string") return envelope.result.trim();
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("agent error")) throw e;
  }
  return trimmed;
}

/** Prefer fenced markdown／json body when present; else return trimmed raw. */
export function unwrapFencedOrRaw(
  raw: string,
  fenceLang?: RegExp,
): string {
  const trimmed = raw.trim();
  const re =
    fenceLang ??
    /```(?:markdown|md|json)?\s*([\s\S]*?)```/;
  const fence = trimmed.match(re);
  if (fence) return fence[1]!.trim();
  return trimmed;
}
