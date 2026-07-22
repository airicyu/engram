/**
 * Self-test for dream approve + future-sight (isolated ENGRAM_HOME + mock agent).
 */
import { rm, mkdir, readFile, readdir } from "node:fs/promises";
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
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

async function waitForJob(
  pred: (job: Record<string, unknown> | null, status: Record<string, unknown>) => boolean,
  timeoutMs = 15000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await json("GET", "/status");
    assert(st.status === 200, "status 200 while polling");
    const job = (st.data.dream_job ?? null) as Record<string, unknown> | null;
    if (pred(job, st.data as Record<string, unknown>)) return st.data;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("timeout waiting for dream job");
}

async function main() {
  await rm(TEST_HOME, { recursive: true, force: true });
  await mkdir(TEST_HOME, { recursive: true });

  let server = await startServer("mock-ok");

  try {
    console.log("Phase 0: capture + status");
    const s0 = await json("GET", "/status");
    assert(s0.status === 200, "status 200");
    assert(s0.data.lock === false, "lock false");
    assert(s0.data.dream_status === "never_dreamed", "never_dreamed");

    const emptyDream = await json("POST", "/dream/run");
    assert(emptyDream.status === 409 && emptyDream.data.error === "nothing_to_dream", "empty pool 409");

    const i1 = await json("POST", "/capture", {
      raw: "Talked to Alice about Acme API rate limits",
      source: "api",
      node_refs: ["acme", "alice"],
    });
    assert(i1.status === 201 && i1.data.event_id === "e0000000001", "first ingest");

    const i2 = await json("POST", "/capture", {
      raw: "NewCo might partner with us on aurora",
      node_refs: ["aurora"],
    });
    assert(i2.data.event_id === "e0000000002", "second ingest");

    const events = await readFile(join(TEST_HOME, "log/events.jsonl"), "utf8");
    assert(events.trim().split("\n").length === 2, "L0 two lines");
    const pool = await readFile(join(TEST_HOME, "short-term-memory/pool.jsonl"), "utf8");
    assert(pool.includes("e0000000001") && pool.includes("e0000000002"), "L1 pool indexed");

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

    console.log("Phase 1: extract → pending_review (no L2 yet)");
    const d1 = await json("POST", "/dream/run");
    assert(d1.status === 202, `dream 202 got ${d1.status} ${JSON.stringify(d1.data)}`);

    const afterExtract = await waitForJob(
      (job, st) =>
        job?.status === "completed" && st.dream_status === "pending_review",
    );
    assert(afterExtract.dream_status === "pending_review", "pending_review");

    const pending = await json("GET", "/dream/pending");
    assert(pending.status === 200 && pending.data.present === true, "pending present");
    assert(pending.data.scope?.length === 2, "scope frozen to 2 events");
    assert(typeof pending.data.report === "string" && pending.data.report.length > 0, "report");

    const whatBefore = await readFile(
      join(TEST_HOME, "nodes/acme/understand/what.md"),
      "utf8",
    );
    assert(whatBefore.includes("Partner organization"), "L2 unchanged before approve");

    console.log("Phase 1b: ingest while pending_review allowed");
    const i3 = await json("POST", "/capture", {
      raw: "Daytime note after extract — should survive approve of S",
    });
    assert(i3.status === 201, "ingest during pending_review");
    assert(i3.data.event_id === "e0000000003", "third event");

    console.log("Phase 2: approve → commit L2 + clear S only");
    const ap = await json("POST", "/dream/approve", {});
    assert(ap.status === 200, `approve 200 got ${ap.status} ${JSON.stringify(ap.data)}`);
    assert(ap.data.l1_clear_pending === false, "l1 cleared");
    assert(Array.isArray(ap.data.committed) && ap.data.committed.length > 0, "committed paths");

    const poolAfter = await readFile(join(TEST_HOME, "short-term-memory/pool.jsonl"), "utf8");
    assert(poolAfter.includes("e0000000003"), "new ingest kept in pool");
    assert(!poolAfter.includes("e0000000001"), "S cleared e0000000001");
    assert(!poolAfter.includes("e0000000002"), "S cleared e0000000002");

    // Mock proposes newco from "NewCo" ingest; semantic lands on newco
    const whatNewco = await readFile(
      join(TEST_HOME, "nodes/newco/understand/what.md"),
      "utf8",
    );
    assert(
      whatNewco.includes("Mock extract") || whatNewco.includes("Organization mentioned"),
      "L2 newco updated",
    );
    const days = await readdir(join(TEST_HOME, "memory-chain/days"));
    const ledgerFiles = days.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
    const summaryFiles = days.filter((f) => /^\d{4}-\d{2}-\d{2}\.summary\.md$/.test(f));
    assert(ledgerFiles.length > 0, "chain ledger day written");
    assert(summaryFiles.length > 0, "chain summary day written");
    const sampleDay = ledgerFiles[0].replace(/\.md$/, "");
    const ledgerBody = await readFile(
      join(TEST_HOME, "memory-chain/days", `${sampleDay}.md`),
      "utf8",
    );
    assert(ledgerBody.includes("<!-- patch:"), "ledger has patch marker");
    const summaryBody = await readFile(
      join(TEST_HOME, "memory-chain/days", `${sampleDay}.summary.md`),
      "utf8",
    );
    assert(summaryBody.includes("## Current"), "summary has Current");
    assert(summaryBody.includes("Day summary (mock)") || summaryBody.includes("Day ledger"), "summary content");

    const recallChain = await json("GET", "/recall");
    assert(recallChain.data.chain?.source === "summary", "recall prefers summary");
    assert(
      !String(recallChain.data.chain?.content ?? "").includes("<!-- patch:"),
      "recall summary does not inject ledger markers",
    );
    const whatAcmeStill = await readFile(
      join(TEST_HOME, "nodes/acme/understand/what.md"),
      "utf8",
    );
    assert(whatAcmeStill === whatBefore, "unrelated L2 acme unchanged");

    const pendingEmpty = await json("GET", "/dream/pending");
    assert(pendingEmpty.data.present === false, "no pending after approve");

    const a1 = await json("GET", "/recall?q=acme");
    assert(["ok", "dead_letter_pending"].includes(a1.data.dream_status), "dream_status after approve");

    console.log("Phase 3: extract fail → dream_incomplete, L1 kept");
    await stopServer(server);
    server = await startServer("mock-fail");

    const dFail = await json("POST", "/dream/run");
    assert(dFail.status === 202, "fail job still 202");
    await waitForJob((job) => job?.status === "failed");

    const st = await json("GET", "/status");
    assert(st.data.dream_status === "dream_incomplete", "status dream_incomplete");
    assert(st.data.dream_job?.phase === "extract", "failed phase extract");
    const l1Kept = await readFile(join(TEST_HOME, "short-term-memory/pool.jsonl"), "utf8");
    assert(l1Kept.includes("e0000000003"), "L1 retained after extract fail");

    const noPending = await json("GET", "/dream/pending");
    assert(noPending.data.present === false, "failed materialize/extract does not create pending");

    console.log("Phase 4: discard path");
    await stopServer(server);
    server = await startServer("mock-ok");
    const d4 = await json("POST", "/dream/run");
    assert(d4.status === 202 && d4.data.job_id, "phase4 dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === d4.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const disc = await json("POST", "/dream/discard", {});
    assert(disc.status === 200 && disc.data.discarded === true, "discard ok");
    const stillPool = await readFile(join(TEST_HOME, "short-term-memory/pool.jsonl"), "utf8");
    assert(stillPool.includes("e0000000003"), "discard leaves L1");

    console.log("Phase 5: future-sight patch → approve → list → sweep");
    const iFs = await json("POST", "/capture", {
      raw: "fs-mock: Engram deadline discussed for next sprint",
      source: "api",
    });
    assert(iFs.status === 201, "future ingest");
    const dFs = await json("POST", "/dream/run");
    assert(dFs.status === 202 && dFs.data.job_id, "future dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dFs.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const pendFs = await json("GET", "/dream/pending");
    assert(
      typeof pendFs.data.report === "string" && pendFs.data.report.includes("Proposed future-sight"),
      "report has future-sight section",
    );
    const patchTypes = (pendFs.data.patches as { type: string }[]).map((p) => p.type);
    assert(patchTypes.includes("future"), `pending has future patch, got ${patchTypes.join(",")}`);
    const apFs = await json("POST", "/dream/approve", {});
    assert(apFs.status === 200, `future approve 200: ${JSON.stringify(apFs.data)}`);
    assert(
      (apFs.data.committed as string[]).some((p: string) => p.startsWith("future-sight/active/")),
      `committed future-sight path: ${JSON.stringify(apFs.data.committed)}`,
    );

    const list1 = await json("GET", "/future-sight");
    assert(list1.status === 200, "future-sight 200");
    assert(Array.isArray(list1.data.anchors) && list1.data.anchors.length >= 1, "has active anchors");
    const stFs = await json("GET", "/status");
    assert(stFs.data.future_sight_active_count >= 1, "status count");

    // Plant an already-expired anchor; GET should sweep → L0+L1 event + hard delete
    await mkdir(join(TEST_HOME, "future-sight/active"), { recursive: true });
    await Bun.write(
      join(TEST_HOME, "future-sight/active/fs-expired-test.md"),
      `---
id: fs-expired-test
anchor_start: "2020-01-01"
anchor_end: "2020-01-02"
---

Old foresight that should expire.
`,
    );
    const list2 = await json("GET", "/future-sight");
    assert(list2.data.swept_expired?.includes("fs-expired-test"), "swept expired id");
    assert(
      !(list2.data.anchors as { id: string }[]).some((a) => a.id === "fs-expired-test"),
      "expired not in active list",
    );
    const eventsAfter = await readFile(join(TEST_HOME, "log/events.jsonl"), "utf8");
    assert(eventsAfter.includes("system/future_sight_expired"), "L0 expiry event");
    assert(eventsAfter.includes("fs-expired-test"), "L0 mentions id");
    const poolSweep = await readFile(join(TEST_HOME, "short-term-memory/pool.jsonl"), "utf8");
    assert(poolSweep.includes("Future-sight expired"), "L1 has expiry note");

    console.log("\n✅ All 0.5 self-checks passed");
  } finally {
    await stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
