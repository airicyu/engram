import { readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { homePath } from "./home";

interface NodeCandidate {
  proposed_id: string;
  kind: string;
  aliases: string[];
  reason: string;
  evidence_event_refs: string[];
  seed_facets?: { what?: string };
  status: "pending" | "approved" | "rejected";
  patch_id: string;
  updated_at: string;
}

interface AttributionCandidate {
  node: string;
  role: string;
  confidence: number;
  date: string;
  content: string;
  event_refs: string[];
  status: "pending" | "resolved";
  patch_id: string;
  updated_at: string;
}

function nodesCandPath(): string {
  return homePath("candidates", "nodes.yaml");
}

function attrCandPath(): string {
  return homePath("candidates", "attribution.yaml");
}

export async function upsertNodeCandidate(c: Omit<NodeCandidate, "status" | "updated_at"> & { status?: NodeCandidate["status"] }): Promise<void> {
  const text = await readFile(nodesCandPath(), "utf8");
  const data = (parse(text) as { candidates: NodeCandidate[] } | null) ?? { candidates: [] };
  const list = data.candidates ?? [];
  const idx = list.findIndex((x) => x.proposed_id === c.proposed_id);
  const entry: NodeCandidate = {
    proposed_id: c.proposed_id,
    kind: c.kind,
    aliases: c.aliases ?? [],
    reason: c.reason,
    evidence_event_refs: c.evidence_event_refs ?? [],
    seed_facets: c.seed_facets,
    status: c.status ?? "pending",
    patch_id: c.patch_id,
    updated_at: new Date().toISOString(),
  };
  // yaml is source of truth for status — don't overwrite approved/rejected on replay
  if (idx >= 0) {
    const prev = list[idx];
    if (prev.status === "approved" || prev.status === "rejected") {
      entry.status = prev.status;
    }
    list[idx] = { ...prev, ...entry, status: entry.status };
  } else {
    list.push(entry);
  }
  await writeFile(nodesCandPath(), stringify({ candidates: list }), "utf8");
}

export async function upsertAttributionCandidate(
  c: Omit<AttributionCandidate, "status" | "updated_at"> & { status?: AttributionCandidate["status"] },
): Promise<void> {
  const text = await readFile(attrCandPath(), "utf8");
  const data = (parse(text) as { candidates: AttributionCandidate[] } | null) ?? { candidates: [] };
  const list = data.candidates ?? [];
  const idx = list.findIndex((x) => x.patch_id === c.patch_id);
  const entry: AttributionCandidate = {
    node: c.node,
    role: c.role,
    confidence: c.confidence,
    date: c.date,
    content: c.content,
    event_refs: c.event_refs ?? [],
    status: c.status ?? "pending",
    patch_id: c.patch_id,
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) {
    const prev = list[idx];
    if (prev.status === "resolved") {
      entry.status = "resolved";
    }
    list[idx] = { ...prev, ...entry, status: entry.status };
  } else {
    list.push(entry);
  }
  await writeFile(attrCandPath(), stringify({ candidates: list }), "utf8");
}
