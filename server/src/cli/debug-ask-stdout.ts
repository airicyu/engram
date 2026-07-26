/** One-off: run Cursor ask agent and verify result.json contract. */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { config } from "../config";
import { buildAskPrompt, readAskResultFile } from "../agent/ask-invoke";
import { askJobDir, askResultPath } from "../store/tmp/ask-job";

const q = process.argv[2] ?? "最近做了什麼decision?";
const jobId = "debug-ask";
const PROMPT_PATH = join(import.meta.dir, "../../prompts/memory-ask.md");

const promptTemplate = await readFile(PROMPT_PATH, "utf8");
const prompt = buildAskPrompt(promptTemplate, {
  job_id: jobId,
  q,
  store_dir: config.storeDir,
  timezone: config.timezone,
  memory_language: config.memoryLanguage,
  dream_status: "ok",
  now: new Date().toISOString(),
  today: new Date().toISOString().slice(0, 10),
});

const jobDir = askJobDir(jobId);
await mkdir(jobDir, { recursive: true });

const cmd = [
  config.cursorAgentBin,
  "-p",
  prompt,
  "--yolo",
  "--add-dir",
  config.storeDir,
  "--add-dir",
  jobDir,
];

console.error("spawn:", cmd[0], "-p <prompt>", ...cmd.slice(2));
const proc = Bun.spawn(cmd, {
  cwd: config.storeDir,
  stdout: "pipe",
  stderr: "pipe",
});

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
]);

console.log("exit_code:", exitCode);
console.log("result_path:", askResultPath(jobId));
console.log("stdout_bytes:", stdout.length);
console.log("stderr_bytes:", stderr.length);

try {
  const parsed = await readAskResultFile(jobId);
  console.log("result: OK", { answer_len: parsed.answer.length, sources: parsed.sources.length });
} catch (e) {
  console.log("result: FAIL", e instanceof Error ? e.message : e);
}
