/** Parse and validate ask JSON from agent result payloads. */

import type { AskAnswer } from "./types";

/** Extract the first balanced `{…}` object from mixed agent text. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return JSON.parse(fence[1]!.trim());
    const embedded = extractJsonObject(trimmed);
    if (embedded) return JSON.parse(embedded);
    throw new Error("ask output is not valid JSON");
  }
}

/** Extract and validate ask JSON from agent stdout (inner payload). */
export function parseAskOutput(stdout: string): AskAnswer {
  const raw = parseJsonPayload(stdout);

  if (!raw || typeof raw !== "object") {
    throw new Error("ask output must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.answer !== "string" || !obj.answer.trim()) {
    throw new Error("ask output missing answer");
  }
  if (!Array.isArray(obj.sources)) {
    throw new Error("ask output missing sources array");
  }

  return {
    answer: obj.answer,
    sources: obj.sources.map((s) => {
      const row = s as Record<string, unknown>;
      return {
        kind: String(row.kind ?? ""),
        node: typeof row.node === "string" ? row.node : undefined,
        day_id: typeof row.day_id === "string" ? row.day_id : undefined,
        id: typeof row.id === "string" ? row.id : undefined,
        zone: typeof row.zone === "string" ? row.zone : undefined,
        reason: typeof row.reason === "string" ? row.reason : undefined,
      };
    }),
    confidence: typeof obj.confidence === "string" ? obj.confidence : undefined,
  };
}
