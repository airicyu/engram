/** Parse agent stdout into a structured ask answer. */

import type { AskAnswer } from "./memory-ask-types";

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

/** Parse Cursor CLI `--output-format json` envelope or plain agent stdout. */
export function parseAskAgentStdout(stdout: string): AskAnswer {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("ask output is empty");
  }

  if (trimmed.startsWith("{")) {
    try {
      const envelope = JSON.parse(trimmed) as {
        type?: string;
        result?: string;
        is_error?: boolean;
      };
      if (envelope.type === "result") {
        if (envelope.is_error) {
          throw new Error(envelope.result?.trim() || "agent returned error result");
        }
        if (typeof envelope.result === "string" && envelope.result.trim()) {
          return parseAskOutput(envelope.result);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("ask output")) throw e;
      if (e instanceof Error && e.message.includes("agent returned error")) throw e;
      // Not a Cursor envelope — fall through to plain stdout parsing.
    }
  }

  return parseAskOutput(stdout);
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
        reason: typeof row.reason === "string" ? row.reason : undefined,
      };
    }),
    confidence: typeof obj.confidence === "string" ? obj.confidence : undefined,
  };
}
