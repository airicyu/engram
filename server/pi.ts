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
import { repoRoot, storeDir } from "./paths.ts";
import type { Job } from "./jobs.ts";
import { readWorkspace } from "./store.ts";

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

function promptFor(job: Job): string {
  const store = storeDir;
  if (job.kind === "ingest") {
    return [
      `Follow the skill engram-lite-ingest.`,
      `Memory store directory (absolute): ${store}`,
      `User event to capture:`,
      job.input.raw ?? "",
    ].join("\n\n");
  }
  if (job.kind === "distill") {
    return [
      `Follow the skill engram-lite-distill.`,
      `Memory store directory (absolute): ${store}`,
      `Distill all pending events into chain + nodes, then archive them.`,
    ].join("\n\n");
  }
  return [
    `Follow the skill engram-lite-ask.`,
    `Memory store directory (absolute): ${store}`,
    `Read only chain/ (day/week/month/year) and pool/pending.jsonl. Do not read archived.jsonl or nodes/.`,
    `Question:`,
    job.input.q ?? "",
  ].join("\n\n");
}

export async function runSkillJob(job: Job, onLog: (line: string) => void): Promise<string> {
  const agentDir = getAgentDir();
  const tools = job.kind === "ask" ? [...READ_TOOLS] : [...WRITE_TOOLS];
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
  onLog(`model ${cliModel.model.provider}/${cliModel.model.id}`);
  if (cliModel.warning) onLog(`model warning: ${cliModel.warning}`);

  const settingsManager = SettingsManager.inMemory({
    retry: { enabled: true, maxRetries: 2 },
  });

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd: repoRoot,
    agentDir,
    tools,
    model: cliModel.model,
    thinkingLevel: cliModel.thinkingLevel ?? "off",
    modelRuntime,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });
  if (modelFallbackMessage) onLog(`model fallback: ${modelFallbackMessage}`);

  session.subscribe((event) => {
    if (event.type === "agent_start") onLog("pi generating");
    if (event.type === "agent_end") onLog("pi done");
    if (event.type === "auto_retry_start") {
      onLog(`retry ${event.attempt}/${event.maxAttempts}: ${event.errorMessage.slice(0, 160)}`);
    }
  });

  try {
    await session.prompt(promptFor(job));
    return lastAssistantText(session);
  } finally {
    session.dispose();
  }
}
