import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { readdir, readFile } from "node:fs/promises";
import {
  clarifyBucketDir,
  memoriesDir,
  poolPendingPath,
  repoRoot,
  storeDir,
} from "../config/paths.ts";
import type { Job } from "../jobs/index.ts";
import { readWorkspace, stampInTimezone } from "../vault/index.ts";
import { distillGaps, formatDistillGaps, snapshotDistill, type DistillGap } from "./distill-gate.ts";

/** Align Engram CLARIFY_GENERATE_MIN / MAX (engram/server/src/store/memories/clarify.ts). */
export const CLARIFY_GENERATE_MIN = 3;
export const CLARIFY_GENERATE_MAX = 5;

const WRITE_TOOLS = ["read", "grep", "find", "ls", "edit", "write"] as const;
const READ_TOOLS = ["read", "grep", "find", "ls"] as const;

function lastAssistantText(s: AgentSession): string {
  const msgs = s.messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m || m.role !== "assistant") continue;
    const parts = m.content;
    if (!Array.isArray(parts)) continue;
    const text = parts
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    if (text.trim()) return text;
  }
  const err = s.agent.state.errorMessage;
  throw new Error(err ? `pi error: ${err}` : "pi empty assistant text");
}

/** Non-empty pending.jsonl lines + clarify/pending/*.md (excluding .gitkeep). */
export async function countDistillWork(): Promise<{
  poolLines: number;
  clarifyPending: number;
  total: number;
}> {
  let poolLines = 0;
  try {
    const raw = await readFile(poolPendingPath(), "utf8");
    poolLines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0).length;
  } catch {
    poolLines = 0;
  }

  let clarifyPending = 0;
  try {
    const names = await readdir(clarifyBucketDir("pending"));
    clarifyPending = names.filter((n) => n.endsWith(".md") && n !== ".gitkeep").length;
  } catch {
    clarifyPending = 0;
  }

  return { poolLines, clarifyPending, total: poolLines + clarifyPending };
}

function promptIngest(job: Job): string {
  const store = storeDir;
  return [
    `Follow the skill engram-lite-ingest.`,
    `Memory store directory (absolute): ${store}`,
    `User event to capture:`,
    job.input.raw ?? "",
  ].join("\n\n");
}

function promptAsk(job: Job): string {
  const store = storeDir;
  return [
    `Follow the skill engram-lite-ask.`,
    `Memory store directory (absolute): ${store}`,
    `Read memories/chain/ (day/week/month/year), memories/pool/pending.jsonl, and memories/future-sight/ (upcoming.md + longTerm.md). Do not read archived.jsonl or memories/nodes/.`,
    `Question:`,
    job.input.q ?? "",
  ].join("\n\n");
}

/** Session A — distill only; never write asking. */
function promptDistillOnly(today: string): string {
  const store = storeDir;
  return [
    `Follow the skill engram-lite-distill.`,
    `Memory store directory (absolute): ${store}`,
    `Local today is ${today} (workspace timezone). Do not treat an event timestamp or a date inside the note as today.`,
    `A week is closed when ${today} is after that week's Sunday. If you create or update a day file in a closed week, write that week's chain file before you stop.`,
    `Absorb clarify/pending, write chain + nodes, archive pool.`,
    `Archive means appending processed lines to memories/pool/archived.jsonl and removing them from pending.jsonl. Move absorbed clarify files from clarify/pending/ to clarify/history/. Saying so in the reply is not enough.`,
    `Do NOT create or edit any files under memories/clarify/asking/. Asking generation is a separate program-orchestrated session.`,
  ].join("\n\n");
}

function promptDistillContinue(today: string, gaps: DistillGap[]): string {
  const lines = gaps.map((gap) => {
    if (gap.kind === "pool") return `- pool line still not archived: ${gap.id}`;
    if (gap.kind === "clarify") {
      return `- clarify file still not moved to history/: ${gap.id}.md`;
    }
    return `- week file missing or older than the day files: ${gap.weekId} (days ${gap.days.join(", ")}; this week is closed)`;
  });
  return [
    `You stopped before engram-lite-distill finished. Continue in this same session.`,
    `Local today is ${today}. Do not treat an event timestamp as today.`,
    `These artifacts are still missing on disk. Write them, then stop:`,
    ...lines,
    `Do not rewrite chain files that are already correct. Finish the missing archive, clarify moves, and closed-week files.`,
    `Do NOT create or edit any files under memories/clarify/asking/.`,
  ].join("\n\n");
}

/** Session B — clarify-generate only. */
function promptClarifyGenerate(opts: { retry: boolean; askingCount: number }): string {
  const store = storeDir;
  const lines = [
    `Follow the skill engram-lite-clarify-generate.`,
    `Memory store directory (absolute): ${store}`,
    `Create NEW files under memories/clarify/asking/ only.`,
    `Quota (hard): MIN ${CLARIFY_GENERATE_MIN}, MAX ${CLARIFY_GENERATE_MAX} new asking files this session (one question per file).`,
    `Do NOT modify chain, nodes, or pool.`,
  ];
  if (opts.retry) {
    lines.push(
      `RETRY: currently only ${opts.askingCount} asking file(s) exist after the previous generate session.`,
      `You MUST bring the total NEW asking count for this distill job to at least ${CLARIFY_GENERATE_MIN} (at most ${CLARIFY_GENERATE_MAX}).`,
      `Write additional distinct, answerable questions (gaps / relations / time / follow-ups). No synonymous duplicates.`,
    );
  }
  return lines.join("\n\n");
}

type SessionKind = "ingest" | "ask" | "distill" | "clarify-generate";

async function openPiSession(opts: {
  tools: readonly string[];
  onLog: (line: string) => void;
  label: string;
}): Promise<AgentSession> {
  const agentDir = getAgentDir();
  const loader = new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir,
  });
  await loader.reload();

  const modelRuntime = await ModelRuntime.create();
  const { pi_model } = await readWorkspace();
  const cliModel = resolveCliModel({
    cliModel: pi_model,
    modelRuntime,
  });
  if (cliModel.error) throw new Error(`pi_model ${pi_model}: ${cliModel.error}`);
  if (!cliModel.model) throw new Error(`pi_model ${pi_model}: unresolved`);
  opts.onLog(`${opts.label} model ${cliModel.model.provider}/${cliModel.model.id}`);
  if (cliModel.warning) opts.onLog(`${opts.label} model warning: ${cliModel.warning}`);

  const settingsManager = SettingsManager.inMemory({
    retry: { enabled: true, maxRetries: 2 },
  });

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd: repoRoot,
    agentDir,
    tools: [...opts.tools],
    model: cliModel.model,
    thinkingLevel: cliModel.thinkingLevel ?? "off",
    modelRuntime,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });
  if (modelFallbackMessage) opts.onLog(`${opts.label} model fallback: ${modelFallbackMessage}`);

  session.subscribe((event) => {
    if (event.type === "agent_start") opts.onLog(`${opts.label} pi generating`);
    if (event.type === "agent_end") opts.onLog(`${opts.label} pi done`);
    if (event.type === "auto_retry_start") {
      opts.onLog(
        `${opts.label} retry ${event.attempt}/${event.maxAttempts}: ${event.errorMessage.slice(0, 160)}`,
      );
    }
  });
  return session;
}

async function promptSession(session: AgentSession, prompt: string): Promise<string> {
  await session.prompt(prompt);
  return lastAssistantText(session);
}

async function runOnePiSession(opts: {
  tools: readonly string[];
  prompt: string;
  onLog: (line: string) => void;
  label: string;
}): Promise<string> {
  const session = await openPiSession(opts);
  try {
    return await promptSession(session, opts.prompt);
  } finally {
    session.dispose();
  }
}

/**
 * Session A stays open after the first stop. One continuation lists missing
 * week / clarify / pool artifacts. Still missing → throw (caller skips generate).
 */
async function runDistillSession(onLog: (line: string) => void, today: string): Promise<string> {
  const memories = memoriesDir();
  const before = await snapshotDistill(memories);
  const session = await openPiSession({
    tools: WRITE_TOOLS,
    onLog,
    label: "distill",
  });
  try {
    let text = await promptSession(session, promptDistillOnly(today));
    let gaps = await distillGaps(memories, before, today);
    onLog(`distill gaps: ${formatDistillGaps(gaps)}`);
    if (gaps.length > 0) {
      onLog("distill continue… (same session A)");
      const more = await promptSession(session, promptDistillContinue(today, gaps));
      text = `${text}\n\n${more}`;
      gaps = await distillGaps(memories, before, today);
      onLog(`distill gaps after continue: ${formatDistillGaps(gaps)}`);
    }
    if (gaps.length > 0) {
      throw new Error(`distill incomplete after continue: ${formatDistillGaps(gaps)}`);
    }
    return text;
  } finally {
    session.dispose();
  }
}

async function countAskingFiles(): Promise<number> {
  try {
    const names = await readdir(clarifyBucketDir("asking"));
    return names.filter((n) => n.endsWith(".md") && n !== ".gitkeep").length;
  } catch {
    return 0;
  }
}

/**
 * Program-orchestrated distill (see docs/architecture/orchestration.md):
 * Session A distill-only → (if work) Session B clarify-generate → retry once if asking < MIN → fail if still short.
 */
async function runDistillOrchestrated(onLog: (line: string) => void): Promise<string> {
  const before = await countDistillWork();
  onLog(
    `distill work before: poolLines=${before.poolLines} clarifyPending=${before.clarifyPending} total=${before.total}`,
  );

  if (before.total === 0) {
    onLog("distill early-exit: nothing to distill; skip clarify-generate");
    return "early-exit: no pending pool or clarify to distill; skipped clarify-generate";
  }

  const today = stampInTimezone((await readWorkspace()).timezone).ts.slice(0, 10);
  onLog(`distill… (session A: engram-lite-distill; today=${today})`);
  const distillText = await runDistillSession(onLog, today);

  const after = await countDistillWork();
  onLog(
    `distill work after: poolLines=${after.poolLines} clarifyPending=${after.clarifyPending} total=${after.total}`,
  );

  // before.total > 0 (else early-exit above) → always run Session B
  const askingBeforeGenerate = await countAskingFiles();

  onLog("clarify-generate… (session B: engram-lite-clarify-generate)");
  const genText1 = await runOnePiSession({
    tools: WRITE_TOOLS,
    prompt: promptClarifyGenerate({ retry: false, askingCount: 0 }),
    onLog,
    label: "clarify-generate",
  });

  let askingAfter = await countAskingFiles();
  const createdApprox = Math.max(0, askingAfter - askingBeforeGenerate);
  onLog(`clarify-generate asking count: total=${askingAfter} new≈${createdApprox}`);

  let genText2 = "";
  // Product gate: mailbox must show at least MIN asking after generate (align Engram quota).
  if (askingAfter < CLARIFY_GENERATE_MIN) {
    onLog(
      `retry generate… (asking ${askingAfter} < MIN ${CLARIFY_GENERATE_MIN})`,
    );
    genText2 = await runOnePiSession({
      tools: WRITE_TOOLS,
      prompt: promptClarifyGenerate({ retry: true, askingCount: askingAfter }),
      onLog,
      label: "clarify-generate-retry",
    });
    askingAfter = await countAskingFiles();
    onLog(
      `retry generate asking count: total=${askingAfter} new≈${Math.max(0, askingAfter - askingBeforeGenerate)}`,
    );
  }

  if (askingAfter < CLARIFY_GENERATE_MIN) {
    throw new Error(
      `clarify-generate produced ${askingAfter} asking file(s) after retry; need at least ${CLARIFY_GENERATE_MIN} (max ${CLARIFY_GENERATE_MAX})`,
    );
  }

  return [
    "## distill",
    distillText,
    "",
    "## clarify-generate",
    genText1,
    genText2 ? "\n## clarify-generate-retry\n" + genText2 : "",
    "",
    `asking_total=${askingAfter}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runSkillJob(job: Job, onLog: (line: string) => void): Promise<string> {
  if (job.kind === "distill") {
    return runDistillOrchestrated(onLog);
  }

  const tools = job.kind === "ask" ? READ_TOOLS : WRITE_TOOLS;
  const prompt = job.kind === "ingest" ? promptIngest(job) : promptAsk(job);
  const label: SessionKind = job.kind === "ingest" ? "ingest" : "ask";
  return runOnePiSession({ tools, prompt, onLog, label });
}
