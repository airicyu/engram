/**
 * Self-test for Phase 0–3 exit criteria (uses isolated ENGRAM_HOME + mock agent).
 */
import { rm, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const ROOT = resolve(import.meta.dir, "../../..");
const TEST_HOME = join(ROOT, "data-test");
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function json(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function startServer(agent: string): Promise<ChildProcess> {
  const server = spawn("bun", ["run", "src/index.ts"], {
    cwd: join(ROOT, "server"),
    env: {
      ...process.env,
      ENGRAM_HOME: TEST_HOME,
      PORT: String(PORT),
      ENGRAM_AGENT: agent,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolveBoot, reject) => {
    const t = setTimeout(() => reject(new Error("server boot timeout")), 10000);
    let boot = "";
    server.stdout?.on("data", (chunk: Buffer) => {
      boot += chunk.toString();
      if (boot.includes("listening")) {
        clearTimeout(t);
        resolveBoot(server);
      }
    });
    server.stderr?.on("data", (chunk: Buffer) => {
      boot += chunk.toString();
    });
    server.on("exit", (code) => {
      clearTimeout(t);
      reject(new Error(`server exited early: ${code}\n${boot}`));
    });
  });
}

async function stopServer(server: ChildProcess) {
  if (!server.killed) {
    server.kill("SIGKILL");
  }
  await new Promise((r) => setTimeout(r, 800));
}

async function main() {
  await rm(TEST_HOME, { recursive: true, force: true });
  await mkdir(TEST_HOME, { recursive: true });

  let server = await startServer("mock-ok");

  try {
    console.log("Phase 0: ingest + status");
    const s0 = await json("GET", "/status");
    assert(s0.status === 200, "status 200");
    assert(s0.data.lock === false, "lock false");

    const i1 = await json("POST", "/ingest", {
      raw: "Talked to Alice about Acme API rate limits",
      source: "api",
      node_refs: ["acme", "alice"],
    });
    assert(i1.status === 201 && i1.data.event_id === "e000001", "first ingest");

    const i2 = await json("POST", "/ingest", {
      raw: "NewCo might partner with us on aurora",
      node_refs: ["aurora"],
    });
    assert(i2.data.event_id === "e000002", "second ingest");

    const events = await readFile(join(TEST_HOME, "log/events.jsonl"), "utf8");
    assert(events.trim().split("\n").length === 2, "L0 two lines");
    const summary = await readFile(join(TEST_HOME, "short-term-memory/summary.md"), "utf8");
    assert(summary.includes("e000001") && summary.includes("e000002"), "L1 visible");

    for (const [id, what] of [
      ["acme", "Partner organization we integrate with."],
      ["alice", "A contact person."],
      ["aurora", "Theme placeholder."],
    ] as const) {
      await mkdir(join(TEST_HOME, `nodes/${id}/understand`), { recursive: true });
      await Bun.write(
        join(TEST_HOME, `nodes/${id}/understand/what.md`),
        `## Current\n\n${what}\n\n## History\n`,
      );
      await Bun.write(join(TEST_HOME, `nodes/${id}/node.meta.yaml`), `id: ${id}\nkind: org\n`);
    }

    console.log("Phase 3: activate before dream");
    const a0 = await json("GET", "/activate?q=acme");
    assert(a0.data.dream_status === "never_dreamed", "never_dreamed before first dream");
    assert(a0.data.sources.includes("L1"), "L1 in sources");

    console.log("Phase 2: dream/run mock-ok");
    const d1 = await json("POST", "/dream/run");
    assert(d1.status === 200, `dream ok got ${d1.status} ${JSON.stringify(d1.data)}`);
    assert(d1.data.extract_status === "ok", "extract ok");
    assert(Array.isArray(d1.data.applied) && d1.data.applied.length > 0, "applied some");

    const patches = await readFile(join(TEST_HOME, "dream/patches.jsonl"), "utf8");
    assert(patches.trim().length > 0, "L0.5 written");
    const l1After = await readFile(join(TEST_HOME, "short-term-memory/summary.md"), "utf8");
    assert(l1After.trim() === "", "L1 cleared");

    const a1 = await json("GET", "/activate?q=acme");
    assert(a1.data.l1.present === false, "L1 gone after dream");
    assert(["ok", "dead_letter_pending"].includes(a1.data.dream_status), "dream_status after success");

    console.log("Phase 2: extract fail → dream_incomplete");
    await json("POST", "/ingest", { raw: "post-dream daytime note about Acme" });
    await stopServer(server);

    server = await startServer("mock-fail");
    const dFail = await json("POST", "/dream/run");
    assert(
      dFail.status === 502,
      `extract fail 502 got ${dFail.status} ${JSON.stringify(dFail.data)}`,
    );
    assert(dFail.data.dream_status === "dream_incomplete", "dream_incomplete");
    const l1Kept = await readFile(join(TEST_HOME, "short-term-memory/summary.md"), "utf8");
    assert(l1Kept.includes("post-dream"), "L1 retained after extract fail");

    const st = await json("GET", "/status");
    assert(st.data.dream_status === "dream_incomplete", "status dream_incomplete");

    console.log("\n✅ All Phase 0–3 self-checks passed");
  } finally {
    await stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
