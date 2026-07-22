/** Patch schema and runtime validation for agent extraction output. */

/** Union of all patch kinds accepted by the dream pipeline. */
export type Patch =
  | SemanticPatch
  | EpisodicPatch
  | ChainPatch
  | FuturePatch
  | ProposeNodePatch
  | DlqReviewPatch;

interface PatchBase {
  patch_id: string;
  dream_run_id: string;
  ts: string;
  event_refs?: string[];
}

/** Long-term node understanding update. */
export interface SemanticPatch extends PatchBase {
  type: "semantic";
  node: string;
  facet: "what";
  operation: "append" | "revise" | "resolve_open";
  content: string;
}

/** Candidate episodic attribution for a node. */
export interface EpisodicPatch extends PatchBase {
  type: "episodic";
  node: string;
  role: "primary" | "mention";
  confidence: number;
  date: string;
  content: string;
}

/** Daily memory-chain ledger and summary update. */
export interface ChainPatch extends PatchBase {
  type: "chain";
  level: "day";
  id: string;
  /** Incremental ledger block text → `days/{id}.md` append. */
  content: string;
  /**
   * Fused day narrative → `days/{id}.summary.md` Current.
   * Optional only for legacy patches (ledger-only); new extract must include it.
   */
  summary?: string;
  /** Present iff `summary` is set. */
  summary_operation?: "init" | "revise";
}

/** Near-horizon future-sight anchor (not memory-chain). */
export interface FuturePatch extends PatchBase {
  type: "future";
  id: string;
  anchor_start: string;
  anchor_end: string;
  content: string;
  node_refs?: string[];
}

/** Proposal to create a new long-term node. */
export interface ProposeNodePatch extends PatchBase {
  type: "propose_node";
  proposed_id: string;
  kind: string;
  aliases?: string[];
  reason: string;
  evidence_event_refs?: string[];
  seed_facets?: { what?: string };
}

/** Review decision for dead-letter patches. */
export interface DlqReviewPatch extends PatchBase {
  type: "dlq_review";
  consumed_ids: string[];
  report_ref: string;
  disposition: "apply" | "discard";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`missing/invalid string field: ${key}`);
  }
  return v;
}

function optStringArray(obj: Record<string, unknown>, key: string): string[] | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new Error(`invalid string[] field: ${key}`);
  }
  return v;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FUTURE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

function reqDay(obj: Record<string, unknown>, key: string): string {
  const v = reqString(obj, key);
  if (!DAY_RE.test(v)) throw new Error(`invalid YYYY-MM-DD field: ${key}`);
  return v;
}

/** Validate and normalize one untrusted patch value. */
export function parsePatch(raw: unknown): Patch {
  if (!isObject(raw)) throw new Error("patch must be object");
  const patch_id = reqString(raw, "patch_id");
  const dream_run_id = reqString(raw, "dream_run_id");
  const ts = reqString(raw, "ts");
  const type = reqString(raw, "type");
  const event_refs = optStringArray(raw, "event_refs");

  switch (type) {
    case "semantic": {
      const facet = reqString(raw, "facet");
      if (facet !== "what") throw new Error(`unsupported facet: ${facet}`);
      const operation = reqString(raw, "operation");
      if (!["append", "revise", "resolve_open"].includes(operation)) {
        throw new Error(`invalid operation: ${operation}`);
      }
      return {
        type: "semantic",
        patch_id,
        dream_run_id,
        ts,
        event_refs,
        node: reqString(raw, "node"),
        facet: "what",
        operation: operation as SemanticPatch["operation"],
        content: reqString(raw, "content"),
      };
    }
    case "episodic": {
      const role = reqString(raw, "role");
      if (role !== "primary" && role !== "mention") {
        throw new Error(`invalid role: ${role}`);
      }
      const confidence = raw.confidence;
      if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
        throw new Error("confidence must be number 0..1");
      }
      return {
        type: "episodic",
        patch_id,
        dream_run_id,
        ts,
        event_refs,
        node: reqString(raw, "node"),
        role,
        confidence,
        date: reqString(raw, "date"),
        content: reqString(raw, "content"),
      };
    }
    case "chain": {
      const level = reqString(raw, "level");
      if (level !== "day") throw new Error(`unsupported chain level: ${level}`);
      const hasSummary = raw.summary !== undefined;
      const hasOp = raw.summary_operation !== undefined;
      if (hasSummary !== hasOp) {
        throw new Error("chain requires both summary and summary_operation, or neither (legacy)");
      }
      let summary: string | undefined;
      let summary_operation: ChainPatch["summary_operation"];
      if (hasSummary) {
        summary = reqString(raw, "summary");
        const op = reqString(raw, "summary_operation");
        if (op !== "init" && op !== "revise") {
          throw new Error(`invalid summary_operation: ${op}`);
        }
        summary_operation = op;
      }
      return {
        type: "chain",
        patch_id,
        dream_run_id,
        ts,
        event_refs,
        level: "day",
        id: reqString(raw, "id"),
        content: reqString(raw, "content"),
        summary,
        summary_operation,
      };
    }
    case "future": {
      const id = reqString(raw, "id");
      if (!FUTURE_ID_RE.test(id)) {
        throw new Error(`invalid future id (use [a-zA-Z0-9_-]): ${id}`);
      }
      const anchor_start = reqDay(raw, "anchor_start");
      const anchor_end = reqDay(raw, "anchor_end");
      if (anchor_start > anchor_end) {
        throw new Error(`anchor_start > anchor_end for ${id}`);
      }
      return {
        type: "future",
        patch_id,
        dream_run_id,
        ts,
        event_refs,
        id,
        anchor_start,
        anchor_end,
        content: reqString(raw, "content"),
        node_refs: optStringArray(raw, "node_refs"),
      };
    }
    case "propose_node": {
      return {
        type: "propose_node",
        patch_id,
        dream_run_id,
        ts,
        event_refs,
        proposed_id: reqString(raw, "proposed_id"),
        kind: reqString(raw, "kind"),
        aliases: optStringArray(raw, "aliases") ?? [],
        reason: reqString(raw, "reason"),
        evidence_event_refs: optStringArray(raw, "evidence_event_refs") ?? [],
        seed_facets: isObject(raw.seed_facets)
          ? { what: typeof raw.seed_facets.what === "string" ? raw.seed_facets.what : undefined }
          : undefined,
      };
    }
    case "dlq_review": {
      const consumed = optStringArray(raw, "consumed_ids");
      if (!consumed) throw new Error("consumed_ids required");
      const disposition = reqString(raw, "disposition");
      if (disposition !== "apply" && disposition !== "discard") {
        throw new Error(`invalid disposition: ${disposition}`);
      }
      return {
        type: "dlq_review",
        patch_id,
        dream_run_id,
        ts,
        event_refs,
        consumed_ids: consumed,
        report_ref: reqString(raw, "report_ref"),
        disposition,
      };
    }
    default:
      throw new Error(`unknown patch type: ${type}`);
  }
}

/** Validate an array of untrusted patch values. */
export function parsePatchArray(raw: unknown): Patch[] {
  if (!Array.isArray(raw)) throw new Error("expected JSON array of patches");
  // Empty array allowed (0.3 #29): pending_review with no L2 writes; approve clears S only.
  return raw.map((item, i) => {
    try {
      return parsePatch(item);
    } catch (e) {
      throw new Error(`patch[${i}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}

/** Parse Cursor CLI `--output-format json` envelope or plain agent stdout. */
export function parseAgentExtractOutput(stdout: string): Patch[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("extract stdout is not valid JSON: empty output");
  }

  if (trimmed.startsWith("{")) {
    try {
      const envelope = JSON.parse(trimmed) as { type?: string; result?: string; is_error?: boolean };
      if (envelope.type === "result") {
        if (envelope.is_error) {
          throw new Error(envelope.result?.trim() || "agent returned error result");
        }
        if (typeof envelope.result === "string" && envelope.result.trim()) {
          return parseExtractStdout(envelope.result);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("extract stdout")) throw e;
      if (e instanceof Error && e.message.includes("agent returned error")) throw e;
      if (e instanceof Error && e.message.startsWith("patch[")) throw e;
      // Not a Cursor envelope — fall through to plain stdout parsing.
    }
  }

  return parseExtractStdout(stdout);
}

/** Parse agent stdout: bare JSON array or fenced ```json ... ``` */
export function parseExtractStdout(stdout: string): Patch[] {
  const trimmed = stdout.trim();
  let jsonText = trimmed;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    jsonText = fence[1].trim();
  } else {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start >= 0 && end > start) {
      jsonText = trimmed.slice(start, end + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`extract stdout is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  return parsePatchArray(parsed);
}
