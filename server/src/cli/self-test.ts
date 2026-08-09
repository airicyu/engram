/**
 * Self-test for dream approve + future-sight (isolated ENGRAM_STORE_DIR + mock agent).
 */
import { rm, mkdir, readFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { checkStoreStructure, structureAtLeast, parseMajorMinor } from "../store/store-structure";

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
      ENGRAM_STORE_DIR: TEST_HOME,
      PORT: String(PORT),
      ENGRAM_AGENT: agent,
      ENGRAM_ALLOW_VIRTUAL_CLOCK: "1",
      ENGRAM_MEMORY_LANGUAGE: "en",
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
    assert(s0.data.memory_language === "en", "default memory_language en");
    assert(typeof s0.data.timezone === "string" && s0.data.timezone.length > 0, "timezone present");
    assert(s0.data.store_git === true, "store_git true after ensure");
    assert(typeof s0.data.product_version === "string" && /^\d+\.\d+\.\d+$/.test(s0.data.product_version), "product_version semver");
    assert(s0.data.store_version === s0.data.product_version, "new store stamped store_version");
    const gitHead = Bun.spawnSync(["git", "-C", TEST_HOME, "rev-parse", "--verify", "HEAD"]);
    assert(gitHead.exitCode === 0, "store has initial HEAD commit");
    const gi = await readFile(join(TEST_HOME, ".gitignore"), "utf8");
    assert(gi.includes("dreams/") && gi.includes("tmp/"), ".gitignore excludes dreams/ and tmp/");
    const trackedDreams = Bun.spawnSync(["git", "-C", TEST_HOME, "ls-files", "dreams"]);
    assert(
      trackedDreams.exitCode === 0 && trackedDreams.stdout.toString().trim() === "",
      "dreams/ not tracked in store git",
    );

    const emptyChain = await json("GET", "/memories/chain");
    assert(emptyChain.status === 200 && emptyChain.data.present === false, "empty chain index");
    const emptyNodes = await json("GET", "/memories/nodes");
    assert(emptyNodes.status === 200 && emptyNodes.data.present === false, "empty nodes index");
    const emptyDay = await json("GET", "/memories/chain/2020-01-01");
    assert(emptyDay.status === 200 && emptyDay.data.present === false, "empty chain detail");

    const emptyDream = await json("POST", "/dreams/run");
    assert(emptyDream.status === 409 && emptyDream.data.error === "nothing_to_dream", "empty pool 409");

    const i1 = await json("POST", "/activities", {
      raw: "Talked to Alice about Acme API rate limits",
      source: "api",
      node_refs: ["acme", "alice"],
    });
    assert(i1.status === 201 && i1.data.event_id === "e0000000001", "first ingest");

    const i2 = await json("POST", "/activities", {
      raw: "NewCo might partner with us on aurora",
      node_refs: ["aurora"],
    });
    assert(i2.data.event_id === "e0000000002", "second ingest");

    const events = await readFile(join(TEST_HOME, "memories/activities/events.jsonl"), "utf8");
    assert(events.trim().split("\n").length === 2, "L0 two lines");
    const pool = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(pool.includes("e0000000001") && pool.includes("e0000000002"), "short-term pool indexed");

    for (const [id, what] of [
      ["acme", "Partner organization we integrate with."],
      ["alice", "A contact person."],
      ["aurora", "Theme placeholder."],
    ] as const) {
      await mkdir(join(TEST_HOME, `memories/nodes/${id}`), { recursive: true });
      await Bun.write(join(TEST_HOME, `memories/nodes/${id}/${id}.md`), `${what}\n`);
      await Bun.write(join(TEST_HOME, `memories/nodes/${id}/node.meta.yaml`), `id: ${id}\nkind: org\n`);
    }

    console.log("Phase 1: extract → pending_review (no L2 yet)");
    const d1 = await json("POST", "/dreams/run");
    assert(d1.status === 202, `dream 202 got ${d1.status} ${JSON.stringify(d1.data)}`);

    const afterExtract = await waitForJob(
      (job, st) =>
        job?.status === "completed" && st.dream_status === "pending_review",
    );
    assert(afterExtract.dream_status === "pending_review", "pending_review");

    const runId = (afterExtract.dream_job as { dream_run_id?: string })?.dream_run_id;
    assert(typeof runId === "string" && runId.length > 0, "dream_job run id");
    const ev = await json("GET", `/dreams/events?run_id=${encodeURIComponent(runId!)}`);
    assert(ev.status === 200, "dream events 200");
    assert((ev.data.total as number) >= 5, "dream events total");
    const names = (ev.data.events as Array<{ event: string }>).map((e) => e.event);
    assert(names.includes("run_start"), "event run_start");
    assert(names.includes("run_complete"), "event run_complete");

    const pending = await json("GET", "/dreams/pending");
    assert(pending.status === 200 && pending.data.present === true, "pending present");
    assert(pending.data.scope?.length === 2, "scope frozen to 2 events");
    assert(typeof pending.data.report === "string" && pending.data.report.length > 0, "report");
    assert(
      typeof pending.data.report === "string" &&
        pending.data.report.includes("## Structure notes"),
      "report has Structure notes section",
    );

    const whatBefore = await readFile(
      join(TEST_HOME, "memories/nodes/acme/acme.md"),
      "utf8",
    );
    assert(whatBefore.includes("Partner organization"), "L2 unchanged before approve");

    console.log("Phase 1b: ingest while pending_review allowed");
    const i3 = await json("POST", "/activities", {
      raw: "Daytime note after extract — should survive approve of S",
    });
    assert(i3.status === 201, "ingest during pending_review");
    assert(i3.data.event_id === "e0000000003", "third event");

    console.log("Phase 1b2: amend same run_id with instruction");
    const missingInstr = await json("POST", "/dreams/amend", {});
    assert(
      missingInstr.status === 400 && missingInstr.data.error === "missing_instruction",
      "amend without instruction → 400",
    );
    const amendRunId = pending.data.dream_run_id as string;
    const amend1 = await json("POST", "/dreams/amend", {
      instruction: "Clarify Acme rate-limit wording in the day summary",
      dream_run_id: amendRunId,
    });
    assert(amend1.status === 202, `amend 202 got ${amend1.status} ${JSON.stringify(amend1.data)}`);
    assert(amend1.data.job_id === amendRunId, "amend job_id equals pending run id");
    await waitForJob(
      (job, st) =>
        job?.status === "completed" &&
        st.dream_status === "pending_review" &&
        (job.dream_run_id as string) === amendRunId,
    );
    const pendingAmend = await json("GET", "/dreams/pending");
    assert(pendingAmend.status === 200 && pendingAmend.data.present === true, "pending after amend");
    assert(pendingAmend.data.dream_run_id === amendRunId, "amend keeps same dream_run_id");
    assert(
      typeof pendingAmend.data.report === "string" &&
        pendingAmend.data.report.includes("Amend feedback") &&
        pendingAmend.data.report.includes("Clarify Acme rate-limit"),
      "amend report has Amend feedback + instruction",
    );

    console.log("Phase 1c: pending blocks /dreams/run; retry with reason");
    const blockedRun = await json("POST", "/dreams/run");
    assert(
      blockedRun.status === 409 && blockedRun.data.error === "pending_review",
      "run while pending → 409 pending_review",
    );

    const missingReason = await json("POST", "/dreams/retry", {});
    assert(
      missingReason.status === 400 && missingReason.data.error === "missing_reason",
      "retry without reason → 400",
    );

    const firstScope = pendingAmend.data.scope as string[];
    assert(Array.isArray(firstScope) && firstScope.length === 2, "baseline scope length 2");
    const firstRunId = pendingAmend.data.dream_run_id as string;

    const retry1 = await json("POST", "/dreams/retry", {
      reason: "Too vague — name the Acme rate-limit discussion explicitly",
      dream_run_id: firstRunId,
    });
    assert(retry1.status === 202, `retry 202 got ${retry1.status} ${JSON.stringify(retry1.data)}`);

    const afterRetry1 = await waitForJob(
      (job, st) =>
        job?.status === "completed" &&
        st.dream_status === "pending_review" &&
        (job.dream_run_id as string) !== firstRunId,
    );
    assert(afterRetry1.dream_status === "pending_review", "pending after retry1");

    const pending2 = await json("GET", "/dreams/pending");
    assert(pending2.status === 200 && pending2.data.present === true, "pending2 present");
    assert(
      JSON.stringify(pending2.data.scope) === JSON.stringify(firstScope),
      "retry1 keeps frozen scope",
    );
    assert(
      typeof pending2.data.report === "string" &&
        pending2.data.report.includes("Too vague") &&
        pending2.data.report.includes(firstRunId),
      "retry1 report has reason + retried_from",
    );
    const secondRunId = pending2.data.dream_run_id as string;
    assert(secondRunId !== firstRunId, "retry1 new run id");

    const poolMid = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(poolMid.includes("e0000000001") && poolMid.includes("e0000000003"), "short-term uncleared on retry");

    const retry2 = await json("POST", "/dreams/retry", {
      reason: "Also drop the NewCo propose_node — keep as mention only",
    });
    assert(retry2.status === 202, "retry2 202");
    await waitForJob(
      (job, st) =>
        job?.status === "completed" &&
        st.dream_status === "pending_review" &&
        (job.dream_run_id as string) !== secondRunId,
    );
    const pending3 = await json("GET", "/dreams/pending");
    assert(
      JSON.stringify(pending3.data.scope) === JSON.stringify(firstScope),
      "retry2 still same original scope",
    );
    assert(
      typeof pending3.data.report === "string" &&
        pending3.data.report.includes("Also drop the NewCo") &&
        pending3.data.report.includes(secondRunId),
      "retry2 uses immediate previous summary/run id",
    );

    console.log("Phase 2: approve → commit L2 + clear S only");
    const ap = await json("POST", "/dreams/approve", {});
    assert(ap.status === 200, `approve 200 got ${ap.status} ${JSON.stringify(ap.data)}`);
    assert(ap.data.l1_clear_pending === false, "l1 cleared");
    assert(Array.isArray(ap.data.committed) && ap.data.committed.length > 0, "committed paths");
    const approvedRunId = String(ap.data.dream_run_id ?? "");
    assert(approvedRunId.length > 0, "approve returns dream_run_id");
    const gitLog = Bun.spawnSync(["git", "-C", TEST_HOME, "log", "-5", "--oneline"]);
    assert(gitLog.exitCode === 0, "store git log ok");
    const logText = gitLog.stdout.toString();
    assert(
      logText.includes(approvedRunId) || logText.includes(`dream ${approvedRunId}`),
      `git commit mentions dream_run_id; log=${logText}`,
    );
    const dreamsTracked = Bun.spawnSync(["git", "-C", TEST_HOME, "ls-files", "dreams"]);
    assert(
      dreamsTracked.exitCode === 0 && dreamsTracked.stdout.toString().trim() === "",
      "dreams/ still not tracked after approve",
    );

    const poolAfter = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(poolAfter.includes("e0000000003"), "new ingest kept in pool");
    assert(!poolAfter.includes("e0000000001"), "S cleared e0000000001");
    assert(!poolAfter.includes("e0000000002"), "S cleared e0000000002");

    // Mock proposes newco from "NewCo" ingest; semantic lands on newco
    const whatNewco = await readFile(
      join(TEST_HOME, "memories/nodes/newco/newco.md"),
      "utf8",
    );
    assert(
      whatNewco.includes("Mock extract") || whatNewco.includes("Organization mentioned"),
      "L2 newco updated",
    );
    assert(
      whatNewco.includes("## Identity") &&
        whatNewco.includes("## Relation") &&
        whatNewco.includes("## Standing facts") &&
        whatNewco.includes("## Current situation") &&
        whatNewco.indexOf("## Identity") < whatNewco.indexOf("## Relation") &&
        whatNewco.indexOf("## Relation") < whatNewco.indexOf("## Standing facts") &&
        whatNewco.indexOf("## Standing facts") < whatNewco.indexOf("## Current situation"),
      "{id}.md has standing understanding headings in order",
    );
    assert(
      whatNewco.includes("[[nodes/acme/acme|acme]]"),
      "Relation includes P1 wikilink to peer node",
    );
    const legacyWhat = await access(join(TEST_HOME, "memories/nodes/newco/understand/what.md"))
      .then(() => true)
      .catch(() => false);
    assert(!legacyWhat, "new node has no understand/what.md");
    const stubIndex = await access(join(TEST_HOME, "memories/nodes/newco/INDEX.md"))
      .then(() => true)
      .catch(() => false);
    assert(!stubIndex, "new node has no stub INDEX.md");
    const daysRoot = join(TEST_HOME, "memories/chain/days");
    const monthDirs = (await readdir(daysRoot, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name))
      .map((e) => e.name);
    assert(monthDirs.length > 0, "chain day files under YYYY-MM/");
    let sampleDay = "";
    let sampleMonth = "";
    for (const month of monthDirs) {
      const files = await readdir(join(daysRoot, month));
      const ledger = files.find((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
      if (ledger) {
        sampleDay = ledger.replace(/\.md$/, "");
        sampleMonth = month;
        break;
      }
    }
    assert(!!sampleDay, "chain ledger day written");
    const summaryExists = await readFile(
      join(daysRoot, sampleMonth, `${sampleDay}.summary.md`),
      "utf8",
    ).then(() => true).catch(() => false);
    assert(summaryExists, "chain summary day written");
    const ledgerBody = await readFile(
      join(daysRoot, sampleMonth, `${sampleDay}.md`),
      "utf8",
    );
    assert(ledgerBody.includes("<!-- patch:"), "ledger has patch marker");
    assert(
      !/^#\s*\d{4}-\d{2}-\d{2}\s*$/m.test(ledgerBody),
      "ledger has no date heading",
    );
    const summaryBody = await readFile(
      join(daysRoot, sampleMonth, `${sampleDay}.summary.md`),
      "utf8",
    );
    assert(!/^##\s*Current\b/m.test(summaryBody), "summary has no Current wrapper");
    assert(!/^##\s*History\b/m.test(summaryBody), "summary has no History");
    assert(summaryBody.includes("Day summary (mock)") || summaryBody.includes("Day ledger"), "summary content");
    assert(
      !/^##\s*Current\s*$/m.test(whatNewco) && !/^##\s*History\b/m.test(whatNewco),
      "{id}.md has no Current/History wrappers",
    );

    const searchChain = await json("GET", "/memories/search?q=summary");
    assert(searchChain.status === 200, "search 200");
    assert(Array.isArray(searchChain.data.scope) && searchChain.data.scope.length === 4, "default scope");
    assert(
      (searchChain.data.scope as string[]).includes("future"),
      "default scope includes future",
    );
    assert(Array.isArray(searchChain.data.chain) && searchChain.data.chain.length > 0, "chain hit");
    assert("future_sight" in searchChain.data, "default search has future_sight key");
    const nodesOnlyScope = await json("GET", "/memories/search?q=summary&scope=nodes");
    assert(nodesOnlyScope.status === 200, "scope=nodes 200");
    assert(!("future_sight" in nodesOnlyScope.data), "nodes-only omits future_sight");
    const chainHit = searchChain.data.chain[0];
    assert(chainHit.source === "summary", "search prefers summary");
    assert(
      !String(chainHit.content ?? "").includes("<!-- patch:"),
      "search summary does not inject ledger markers",
    );

    const chainOnly = await json("GET", "/memories/search?q=summary&scope=chain");
    assert(chainOnly.status === 200, "scope=chain 200");
    assert(chainOnly.data.scope?.join(",") === "chain", "scope echoed");
    assert(chainOnly.data.chain?.length > 0, "chain only hit");
    assert(!("nodes" in chainOnly.data), "nodes omitted when out of scope");

    const badScope = await json("GET", "/memories/search?q=x&scope=foo");
    assert(badScope.status === 400 && badScope.data.error === "invalid_scope", "invalid scope");

    const noQ = await json("GET", "/memories/search");
    assert(noQ.status === 400 && noQ.data.error === "missing_q", "search requires q");
    const whatAcmeStill = await readFile(
      join(TEST_HOME, "memories/nodes/acme/acme.md"),
      "utf8",
    );
    assert(whatAcmeStill === whatBefore, "unrelated L2 acme unchanged");

    const pendingEmpty = await json("GET", "/dreams/pending");
    assert(pendingEmpty.data.present === false, "no pending after approve");

    const a1 = await json("GET", "/memories/search?q=acme");
    assert(a1.status === 200, "search acme 200");
    assert(
      (a1.data.nodes as Array<{ node: string }>).some((n) => n.node === "acme"),
      "search finds acme node",
    );

    console.log("Phase 3: extract fail → dream_incomplete, short-term kept");
    await stopServer(server);
    server = await startServer("mock-fail");

    const dFail = await json("POST", "/dreams/run");
    assert(dFail.status === 202, "fail job still 202");
    await waitForJob((job) => job?.status === "failed");

    const st = await json("GET", "/status");
    assert(st.data.dream_status === "dream_incomplete", "status dream_incomplete");
    assert(st.data.dream_job?.phase === "extract", "failed phase extract");
    const l1Kept = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(l1Kept.includes("e0000000003"), "short-term retained after extract fail");

    const noPending = await json("GET", "/dreams/pending");
    assert(noPending.data.present === false, "failed materialize/extract does not create pending");

    console.log("Phase 4: discard path");
    await stopServer(server);
    server = await startServer("mock-ok");
    const d4 = await json("POST", "/dreams/run");
    assert(d4.status === 202 && d4.data.job_id, "phase4 dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === d4.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const disc = await json("POST", "/dreams/discard", {});
    assert(disc.status === 200 && disc.data.discarded === true, "discard ok");
    const stillPool = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(stillPool.includes("e0000000003"), "discard leaves short-term");

    console.log("Phase 4a: Structure notes soft lint (missing headings) + approve still ok");
    const iStruct = await json("POST", "/activities", {
      raw: "Structure-lint fixture event for skewed node",
      source: "api",
    });
    assert(iStruct.status === 201, "structure fixture activity");
    const dStruct = await json("POST", "/dreams/run");
    assert(dStruct.status === 202, "structure dream 202");
    await waitForJob(
      (job, st2) =>
        job?.status === "completed" && st2.dream_status === "pending_review",
    );
    const pendStruct = await json("GET", "/dreams/pending");
    assert(pendStruct.data.present === true, "structure pending");
    const structRunId = pendStruct.data.dream_run_id as string;
    const skewedDraft = join(
      TEST_HOME,
      "dreams/draft",
      structRunId,
      "memories/nodes/skewed",
    );
    await mkdir(skewedDraft, { recursive: true });
    await Bun.write(
      join(skewedDraft, "skewed.md"),
      ["## Identity", "", "Broken fixture", "", "## Relation", "", "_None_", ""].join("\n"),
    );
    const amendStruct = await json("POST", "/dreams/amend", {
      instruction: "Re-scan draft for structure notes only",
      dream_run_id: structRunId,
    });
    assert(amendStruct.status === 202, "structure amend 202");
    await waitForJob(
      (job, st2) =>
        job?.status === "completed" &&
        st2.dream_status === "pending_review" &&
        (job.dream_run_id as string) === structRunId,
    );
    const pendStruct2 = await json("GET", "/dreams/pending");
    const structReport = String(pendStruct2.data.report ?? "");
    assert(structReport.includes("## Structure notes"), "structure notes section after amend");
    assert(
      structReport.includes("missing heading Standing facts") ||
        structReport.includes("missing heading Current situation"),
      "structure notes warn missing headings",
    );
    const apStruct = await json("POST", "/dreams/approve", {});
    assert(apStruct.status === 200, `approve with structure warnings → 200 got ${apStruct.status}`);
    assert(pendStruct2.data.present === true, "was pending before approve");
    const pendAfterStruct = await json("GET", "/dreams/pending");
    assert(pendAfterStruct.data.present === false, "no pending after structure approve");
    // Re-seed short-term so later phases still have an L1 pool (approve cleared scope).
    const iKeep = await json("POST", "/activities", {
      raw: "Keep short-term non-empty after structure approve",
      source: "api",
    });
    assert(iKeep.status === 201, "reseed activity after structure approve");

    console.log("Phase 4b: memory l1 + ask");
    const l1 = await json("GET", "/memories/short-term-memory");
    assert(l1.status === 200 && l1.data.present === true, "memory l1");
    assert(!("nodes" in l1.data), "l1 has no nodes");

    await stopServer(server);
    server = await startServer("mock-ask-ok");

    const askBadFlag = await json("POST", "/memories/ask", {
      q: "What about Acme?",
      include_later: "true",
    });
    assert(
      askBadFlag.status === 400 && askBadFlag.data.error === "invalid_include_later",
      "ask reject non-boolean include_later",
    );

    const askStart = await json("POST", "/memories/ask", { q: "What about Acme?" });
    assert(askStart.status === 202 && askStart.data.job_id, "ask 202");
    assert(askStart.data.include_later === false, "ask default include_later false");
    const jobId = askStart.data.job_id as string;
    let askDone = false;
    for (let i = 0; i < 40; i++) {
      const poll = await json("GET", `/memories/ask/${encodeURIComponent(jobId)}`);
      assert(poll.status === 200 && poll.data.present === true, "ask poll");
      if (poll.data.status === "completed") {
        assert(String(poll.data.answer).includes("Mock answer"), "ask answer");
        assert(String(poll.data.answer).includes("include_later=false"), "ask default forbids later");
        assert(poll.data.include_later === false, "poll echoes include_later false");
        askDone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    assert(askDone, "ask completed");

    const askLater = await json("POST", "/memories/ask", {
      q: "What is later?",
      include_later: true,
    });
    assert(askLater.status === 202 && askLater.data.include_later === true, "ask include_later true");
    const laterJobId = askLater.data.job_id as string;
    let askLaterDone = false;
    for (let i = 0; i < 40; i++) {
      const poll = await json("GET", `/memories/ask/${encodeURIComponent(laterJobId)}`);
      assert(poll.status === 200 && poll.data.present === true, "ask later poll");
      if (poll.data.status === "completed") {
        assert(String(poll.data.answer).includes("include_later=true"), "ask later allowed");
        assert(poll.data.include_later === true, "poll echoes include_later true");
        const srcs = poll.data.sources as { kind?: string; zone?: string }[];
        assert(
          Array.isArray(srcs) && srcs.some((s) => s.kind === "future_sight" && s.zone === "later"),
          "ask later source zone",
        );
        askLaterDone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    assert(askLaterDone, "ask include_later completed");

    console.log("Phase 4c: browse chain + nodes");
    const chainIdx = await json("GET", "/memories/chain");
    assert(chainIdx.status === 200 && chainIdx.data.present === true, "chain index present");
    assert(Array.isArray(chainIdx.data.days) && chainIdx.data.days.length >= 1, "chain days");
    const browseDay = chainIdx.data.days[0].day_id as string;
    const chainDet = await json("GET", `/memories/chain/${browseDay}`);
    assert(chainDet.status === 200 && chainDet.data.present === true, "chain day detail");
    assert(String(chainDet.data.content ?? "").length > 0, "chain day content");

    const nodesIdx = await json("GET", "/memories/nodes");
    assert(nodesIdx.status === 200 && nodesIdx.data.present === true, "nodes index present");
    assert(
      (nodesIdx.data.nodes as Array<{ node: string }>).some((n) => n.node === "acme"),
      "nodes includes acme",
    );
    const newcoIdx = (nodesIdx.data.nodes as Array<{
      node: string;
      score?: number | null;
      display_score?: number | null;
    }>).find((n) => n.node === "newco");
    assert(
      newcoIdx != null && typeof newcoIdx.score === "number" && newcoIdx.score === 100,
      "newco has S0 score from create settle",
    );
    assert(
      typeof newcoIdx!.display_score === "number" &&
        newcoIdx!.display_score! >= 1 &&
        newcoIdx!.display_score! <= 100,
      "newco display_score 1–100",
    );
    const nodeDet = await json("GET", "/memories/nodes/newco");
    assert(nodeDet.status === 200 && nodeDet.data.present === true, "node newco detail");
    assert(typeof nodeDet.data.score === "number", "node detail score");
    assert(typeof nodeDet.data.display_score === "number", "node detail display_score");
    assert(typeof nodeDet.data.score_timestamp === "string", "node detail score_timestamp");

    const acmeDetEarly = await json("GET", "/memories/nodes/acme");
    assert(acmeDetEarly.status === 200 && acmeDetEarly.data.present === true, "node acme detail");
    // acme existed pre-dream but was not involved in first newco-only dream → score may be null

    const badDay = await json("GET", "/memories/chain/not-a-date");
    assert(badDay.status === 400 && badDay.data.error === "invalid_day_id", "invalid day_id");

    const weeksEmpty = await json("GET", "/memories/chain/weeks");
    assert(weeksEmpty.status === 200, "weeks index 200");
    assert(typeof weeksEmpty.data.present === "boolean", "weeks present bool");
    const badWeek = await json("GET", "/memories/chain/weeks/not-a-week");
    assert(badWeek.status === 400 && badWeek.data.error === "invalid_week_id", "invalid week_id");
    const legacyWeek = await json("GET", "/memories/chain/weeks/2026-W30");
    assert(
      legacyWeek.status === 400 && legacyWeek.data.error === "invalid_week_id",
      "legacy YYYY-Www rejected",
    );
    const badMonday = await json("GET", "/memories/chain/weeks/2026-W30-0721");
    assert(
      badMonday.status === 400 && badMonday.data.error === "invalid_week_id",
      "MMDD must be Monday",
    );
    const weekShape = await json("GET", "/memories/chain/weeks/2026-W30-0720");
    assert(weekShape.status === 200, "valid week detail 200");
    assert(weekShape.data.week_id === "2026-W30-0720", "week_id echo");
    assert(weekShape.data.start === "2026-07-20" && weekShape.data.end === "2026-07-26", "week start/end");
    assert(weekShape.data.present === false, "missing week present false");
    assert(weekShape.data.content === null, "missing week content null");
    const badMonth = await json("GET", "/memories/chain/months/2026-13");
    assert(badMonth.status === 400 && badMonth.data.error === "invalid_month_id", "invalid month_id");
    const badYear = await json("GET", "/memories/chain/years/20");
    assert(badYear.status === 400 && badYear.data.error === "invalid_year_id", "invalid year_id");

    await stopServer(server);
    server = await startServer("mock-ok");

    console.log("Phase 5: future-sight patch → approve → list → sweep");
    const iFs = await json("POST", "/activities", {
      raw: "fs-mock: Engram deadline discussed for next sprint",
      source: "api",
    });
    assert(iFs.status === 201, "future ingest");
    const dFs = await json("POST", "/dreams/run");
    assert(dFs.status === 202 && dFs.data.job_id, "future dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dFs.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const pendFs = await json("GET", "/dreams/pending");
    assert(
      typeof pendFs.data.report === "string" && pendFs.data.report.includes("Proposed future-sight"),
      "report has future-sight section",
    );
    assert(
      Array.isArray(pendFs.data.draft_summary?.future_ids) &&
        (pendFs.data.draft_summary.future_ids as string[]).length >= 1,
      "pending draft has future_ids",
    );
    const apFs = await json("POST", "/dreams/approve", {});
    assert(apFs.status === 200, `future approve 200: ${JSON.stringify(apFs.data)}`);
    assert(
      (apFs.data.committed as string[]).some(
        (p: string) =>
          p === "memories/future-sight/hot.md" || p === "memories/future-sight/later.md",
      ),
      `committed future-sight zone path: ${JSON.stringify(apFs.data.committed)}`,
    );

    const list1 = await json("GET", "/memories/future-sight");
    assert(list1.status === 200, "future-sight 200");
    assert(Array.isArray(list1.data.anchors) && list1.data.anchors.length >= 1, "has active anchors");
    assert(
      (list1.data.anchors as { zone?: string }[]).every((a) => a.zone === "hot" || a.zone === "later"),
      "anchors have zone",
    );
    const stFs = await json("GET", "/status");
    assert(stFs.data.future_sight_active_count >= 1, "status count");
    assert(typeof stFs.data.future_sight_hot_count === "number", "hot count");
    assert(typeof stFs.data.future_sight_later_count === "number", "later count");

    // Plant an already-expired anchor in hot.md; GET should sweep → L0+short-term event + remove
    const hotPath = join(TEST_HOME, "memories/future-sight/hot.md");
    const hotExisting = await readFile(hotPath, "utf8");
    const expiredBlock = `
## fs-expired-test
\`\`\`yaml
anchor_start: "2020-01-01"
anchor_end: "2020-01-02"
\`\`\`

Old foresight that should expire.
`;
    await Bun.write(hotPath, hotExisting.trimEnd() + "\n" + expiredBlock);
    const list2 = await json("GET", "/memories/future-sight");
    assert(list2.data.swept_expired?.includes("fs-expired-test"), "swept expired id");
    assert(
      !(list2.data.anchors as { id: string }[]).some((a) => a.id === "fs-expired-test"),
      "expired not in active list",
    );
    const eventsAfter = await readFile(join(TEST_HOME, "memories/activities/events.jsonl"), "utf8");
    assert(eventsAfter.includes("system/future_sight_expired"), "L0 expiry event");
    assert(eventsAfter.includes("fs-expired-test"), "L0 mentions id");
    const poolSweep = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(poolSweep.includes("Future-sight expired"), "short-term has expiry note");

    console.log("Phase 5b: search future-sight (hot + later)");
    const stWindow = await json("GET", "/status");
    assert(stWindow.data.future_sight_window_days === 365, "default window_days 365");
    assert(stWindow.data.future_sight_hot_days === 30, "hot_days still 30");

    const laterPath = join(TEST_HOME, "memories/future-sight/later.md");
    const laterExisting = await readFile(laterPath, "utf8");
    const laterBlock = `
## game-xx-launch
\`\`\`yaml
anchor_start: "2026-12-01"
anchor_end: "2026-12-15"
\`\`\`

Unique later keyword xylophone-launch window for search.
`;
    await Bun.write(laterPath, laterExisting.trimEnd() + "\n" + laterBlock);

    const searchFuture = await json("GET", "/memories/search?q=xylophone-launch&scope=future");
    assert(searchFuture.status === 200, "search future 200");
    assert(searchFuture.data.scope?.join(",") === "future", "scope=future echoed");
    assert(!("nodes" in searchFuture.data), "future-only omits nodes");
    assert(Array.isArray(searchFuture.data.future_sight), "future_sight array");
    const fsHits = searchFuture.data.future_sight as {
      id: string;
      zone: string;
      match_reason?: string;
    }[];
    assert(
      fsHits.some((h) => h.id === "game-xx-launch" && h.zone === "later"),
      "search hits later zone",
    );

    const searchDefaultFs = await json("GET", "/memories/search?q=deadline");
    assert(searchDefaultFs.status === 200, "default search deadline");
    assert(Array.isArray(searchDefaultFs.data.future_sight), "default has future_sight");
    assert(
      (searchDefaultFs.data.future_sight as { zone: string }[]).length >= 1,
      "deadline hits future-sight",
    );

    const searchNoFuture = await json("GET", "/memories/search?q=xylophone-launch&scope=nodes");
    assert(searchNoFuture.status === 200, "nodes scope 200");
    assert(!("future_sight" in searchNoFuture.data), "scope=nodes excludes future_sight");

    console.log("\nPhase 6: virtual clock (time replay)");
    const clock0 = await json("GET", "/clock");
    assert(clock0.status === 200, "GET /clock 200");
    assert(clock0.data.mode === "system", "clock starts system");
    assert(clock0.data.allow_set === true, "allow_set true in test");
    assert(typeof clock0.data.now === "string" && typeof clock0.data.today === "string", "now/today");

    const stClock = await json("GET", "/status");
    assert(stClock.data.clock && (stClock.data.clock as { mode: string }).mode === "system", "status.clock");

    const putNow = await json("PUT", "/clock", { now: "2026-05-12T21:05:00+08:00" });
    assert(putNow.status === 200, `PUT /clock now: ${JSON.stringify(putNow.data)}`);
    assert(putNow.data.mode === "virtual", "mode virtual");
    assert(putNow.data.today === "2026-05-12", `today=2026-05-12 got ${putNow.data.today}`);

    const capV = await json("POST", "/activities", {
      raw: "virtual-clock capture on May 12",
      source: "test",
    });
    assert(capV.status === 201, "capture under virtual clock");
    const poolV = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(poolV.includes("2026-05-12"), "pool ts uses virtual day");

    const putDay = await json("PUT", "/clock", { day: "2026-05-12", time: "23:30:00" });
    assert(putDay.status === 200 && putDay.data.today === "2026-05-12", "PUT day+time");

    const delClock = await json("DELETE", "/clock");
    assert(delClock.status === 200 && delClock.data.mode === "system", "DELETE → system");

    console.log("\nPhase 7: higher chain rollup (mock)");
    // Clear leftover short-term from phase 6 under a clock where past months can roll
    await json("PUT", "/clock", { now: "2026-07-01T22:00:00+08:00" });
    for (let i = 0; i < 3; i++) {
      const st = await json("GET", "/status");
      if (st.data.l1_empty === true) break;
      if (st.data.dream_status === "pending_review") {
        await json("POST", "/dreams/approve", {});
        continue;
      }
      const dClear = await json("POST", "/dreams/run");
      if (dClear.status !== 202) break;
      await waitForJob(
        (job, st2) =>
          job?.dream_run_id === dClear.data.job_id &&
          job?.status === "completed" &&
          (st2.dream_status === "pending_review" || st2.dream_status === "ok"),
      );
      const pend = await json("GET", "/dreams/pending");
      if (pend.data.present) await json("POST", "/dreams/approve", {});
    }
    {
      const st = await json("GET", "/status");
      assert(st.data.l1_empty === true, "short-term cleared before rollup fixture");
    }

    await json("PUT", "/clock", { now: "2026-06-20T20:00:00+08:00" });
    const capJun = await json("POST", "/activities", {
      raw: "June day event for month rollup",
      source: "test",
    });
    assert(capJun.status === 201, "june capture");
    await json("PUT", "/clock", { now: "2026-07-02T22:00:00+08:00" });
    const dRoll = await json("POST", "/dreams/run");
    assert(dRoll.status === 202, "rollup dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dRoll.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const pendRoll = await json("GET", "/dreams/pending");
    assert(pendRoll.data.present === true, "rollup pending");
    const report = String(pendRoll.data.report ?? "");
    assert(
      report.includes("Higher chain rollup") || /week|month|year/i.test(report),
      "report mentions rollup",
    );
    const apRoll = await json("POST", "/dreams/approve", {});
    assert(apRoll.status === 200, "approve rollup");

    const monthsIdx = await json("GET", "/memories/chain/months");
    assert(monthsIdx.status === 200 && monthsIdx.data.present === true, "months present after rollup");
    assert(
      (monthsIdx.data.months as Array<{ month_id: string }>).some((m) => m.month_id === "2026-06"),
      "June month summary exists",
    );

    await json("PUT", "/clock", { now: "2026-06-29T18:00:00+08:00" });
    const capBack = await json("POST", "/activities", {
      raw: "June 29 backfill after month initialized",
      source: "test",
    });
    assert(capBack.status === 201, "backfill capture");
    await json("PUT", "/clock", { now: "2026-07-03T22:00:00+08:00" });
    const dRev = await json("POST", "/dreams/run");
    assert(dRev.status === 202, "revise dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dRev.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const apRev = await json("POST", "/dreams/approve", {});
    assert(apRev.status === 200, "approve revise rollup");
    const monthDet = await json("GET", "/memories/chain/months/2026-06");
    assert(monthDet.status === 200 && monthDet.data.present === true, "june month still present");
    const monthText = String(monthDet.data.content ?? "");
    assert(monthText.length > 20, "month summary has content");
    assert(!/^##\s*Current\b/m.test(monthText), "higher summary has no Current wrapper");
    assert(/^##\s+\S+/m.test(monthText), "month summary has ## section title");
    assert(!/^[-*]\s*\d{4}/m.test(monthText), "month summary is not an id-bullet dump");
    assert(!/summary\s*\(mock\)\s*for/i.test(monthText), "month summary has no mock dump label");

    await json("DELETE", "/clock");

    console.log("\nPhase 7c: rollup-only empty dream (0.24)");

    // Fixture: a day summary inside a now-closed week, but no higher summary yet.
    await json("PUT", "/clock", { now: "2026-05-15T10:00:00+08:00" });
    const capMay = await json("POST", "/activities", {
      raw: "May day event that later needs week rollup",
      source: "test",
    });
    assert(capMay.status === 201, "may capture");
    const dMay = await json("POST", "/dreams/run");
    assert(dMay.status === 202, "may dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dMay.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const apMay = await json("POST", "/dreams/approve", {});
    assert(apMay.status === 200, "approve may dream");
    assert(
      (await json("GET", "/status")).data.l1_empty === true,
      "short-term empty after may approve",
    );

    // Same week is current on May 15 (touched), so no higher summary was created.
    // Move forward: pool empty + closed week missing monthly summary → rollup-only.
    await json("PUT", "/clock", { now: "2026-06-01T10:00:00+08:00" });
    const dRollOnly = await json("POST", "/dreams/run");
    assert(
      dRollOnly.status === 202,
      `rollup-only empty dream 202 got ${dRollOnly.status} ${JSON.stringify(dRollOnly.data)}`,
    );
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dRollOnly.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const pendRollOnly = await json("GET", "/dreams/pending");
    assert(pendRollOnly.data.present === true, "rollup-only pending");
    assert(
      Array.isArray(pendRollOnly.data.scope) && pendRollOnly.data.scope.length === 0,
      "rollup-only scope empty",
    );
    const reportRollOnly = String(pendRollOnly.data.report ?? "");
    assert(
      reportRollOnly.includes("2026-W20-0511") || reportRollOnly.includes("memories/chain/weeks"),
      "rollup-only report lists week rollup targets",
    );
    assert(
      reportRollOnly.includes("Rollup-only") || reportRollOnly.includes("no new events"),
      "rollup-only narrative marks skipped extract",
    );
    // No day-extract agent was spawned: the run's events include the skip marker.
    const evRollOnly = await json(
      "GET",
      `/dreams/events?run_id=${encodeURIComponent(pendRollOnly.data.dream_run_id as string)}`,
    );
    const rollEventNames = (evRollOnly.data.events as Array<{ event: string }>).map((e) => e.event);
    assert(rollEventNames.includes("extract_skipped"), "rollup-only marks extract skipped");
    assert(!rollEventNames.includes("extract_failed"), "no day-extract agent spawn in rollup-only");

    const apRollOnly = await json("POST", "/dreams/approve", {});
    assert(apRollOnly.status === 200, "approve rollup-only");
    const weekFile = join(
      TEST_HOME,
      "memories/chain/weeks/2026-05/2026-W20-0511.summary.md",
    );
    const weekExists = await Bun.file(weekFile).exists();
    assert(weekExists === true, "closed week summary written from empty dream");
    const monthFile = join(TEST_HOME, "memories/chain/months/2026/2026-05.summary.md");
    assert((await Bun.file(monthFile).exists()) === true, "closed month summary written");

    // Empty pool with nothing to roll up → 409 nothing_to_dream (unchanged).
    const emptyNoWork = await json("POST", "/dreams/run");
    assert(
      emptyNoWork.status === 409 && emptyNoWork.data.error === "nothing_to_dream",
      "empty pool + no closed catch-up → 409",
    );
    await json("DELETE", "/clock");

    console.log("\nPhase 8: node score (0.19)");

    // T2／pending JSON: involvements present; 2a patch then approve uses new category
    const scoreBefore2a = await json("GET", "/memories/nodes/acme");
    const liveBefore =
      typeof scoreBefore2a.data.score === "number" ? (scoreBefore2a.data.score as number) : null;
    const iScore = await json("POST", "/activities", {
      raw: "Acme rate-limit follow-up for score settle",
      source: "api",
    });
    assert(iScore.status === 201, "score activity");
    const dScore = await json("POST", "/dreams/run");
    assert(dScore.status === 202, "score dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dScore.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const pendScore = await json("GET", "/dreams/pending");
    assert(Array.isArray(pendScore.data.node_score_involvements), "pending has involvements array");
    const inv = pendScore.data.node_score_involvements as Array<{ id: string; category: string }>;
    assert(inv.some((x) => x.id === "acme"), "involvements include acme");
    assert(
      typeof pendScore.data.report === "string" &&
        pendScore.data.report.includes("## Node score involvements"),
      "report has involvements section",
    );

    // T9: unknown id → 404
    const patch404 = await json("PATCH", "/dreams/pending/node-score-involvements", {
      id: "no-such-node-xyz",
      category: "mention",
    });
    assert(
      patch404.status === 404 && patch404.data.error === "involvement_not_found",
      "2a unknown id 404",
    );

    // illegal category → 400
    const patch400 = await json("PATCH", "/dreams/pending/node-score-involvements", {
      id: "acme",
      category: "GRADE_1",
    });
    assert(
      patch400.status === 400 && patch400.data.error === "invalid_category",
      "2a invalid category 400",
    );

    // live score unchanged during pending (T8 mid)
    const midLive = await json("GET", "/memories/nodes/acme");
    assert(midLive.data.score === liveBefore, "live score unchanged while pending");

    // T8: patch to mention then approve → +10 (missing score first ensured to S0)
    const patchOk = await json("PATCH", "/dreams/pending/node-score-involvements", {
      id: "acme",
      category: "mention",
    });
    assert(patchOk.status === 200 && patchOk.data.category === "mention", "2a patch mention");
    const pendAfterPatch = await json("GET", "/dreams/pending");
    const invAfter = pendAfterPatch.data.node_score_involvements as Array<{
      id: string;
      category: string;
    }>;
    assert(invAfter.find((x) => x.id === "acme")?.category === "mention", "pending shows mention");

    const apScore = await json("POST", "/dreams/approve", {});
    assert(apScore.status === 200 && apScore.data.empty_patches === false, "score approve");
    const afterMention = await json("GET", "/memories/nodes/acme");
    const expectedAfterMention = (liveBefore ?? 100) + 10;
    assert(
      afterMention.data.score === expectedAfterMention,
      `approve after 2a mention: expected ${expectedAfterMention} got ${afterMention.data.score}`,
    );

    // T10: discard does not change live score
    const beforeDiscard = afterMention.data.score as number;
    const iDisc = await json("POST", "/activities", { raw: "discard score check", source: "api" });
    assert(iDisc.status === 201, "discard activity");
    const dDisc = await json("POST", "/dreams/run");
    assert(dDisc.status === 202, "discard dream");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dDisc.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const discRes = await json("POST", "/dreams/discard", {});
    assert(discRes.status === 200, "discard ok");
    const afterDisc = await json("GET", "/memories/nodes/acme");
    assert(afterDisc.data.score === beforeDiscard, "discard leaves live score");

    // T4: newco create ends at S0
    const iNew = await json("POST", "/activities", {
      raw: "Met NewCo founders about partnership",
      source: "api",
    });
    assert(iNew.status === 201, "newco activity");
    const dNew = await json("POST", "/dreams/run");
    assert(dNew.status === 202, "newco dream");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dNew.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const apNew = await json("POST", "/dreams/approve", {});
    assert(apNew.status === 200, "newco approve");
    const newco = await json("GET", "/memories/nodes/newco");
    assert(newco.status === 200 && newco.data.present === true, "newco present");
    assert(newco.data.score === 100, `newco S0 got ${newco.data.score}`);

    // T5: push acme over S_max → downscale; brandnew created same round stays S0
    await Bun.write(
      join(TEST_HOME, "memories/nodes/acme/score.yaml"),
      "score: 1950\nscore_timestamp: \"2026-08-01T00:00:00.000+08:00\"\n",
    );
    await Bun.write(
      join(TEST_HOME, "memories/node-score-registry.yaml"),
      "max_score: 1950\n",
    );
    const iDs = await json("POST", "/activities", {
      raw: "Acme focus storm with BrandNew corp intro that will tip max",
      source: "api",
    });
    assert(iDs.status === 201, "downscale activity");
    const dDs = await json("POST", "/dreams/run");
    assert(dDs.status === 202, "downscale dream");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dDs.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    await json("PATCH", "/dreams/pending/node-score-involvements", {
      id: "acme",
      category: "focus",
    });
    const apDs = await json("POST", "/dreams/approve", {});
    assert(apDs.status === 200, "downscale approve");
    const acmeDs = await json("GET", "/memories/nodes/acme");
    const brandDs = await json("GET", "/memories/nodes/brandnew");
    assert(brandDs.status === 200 && brandDs.data.present === true, "brandnew present");
    assert(
      (acmeDs.data.score as number) < 1950 + 80,
      `acme downscaled got ${acmeDs.data.score}`,
    );
    assert(
      brandDs.data.score === 100,
      `brandnew still S0 after downscale exclude got ${brandDs.data.score}`,
    );

    // T6: empty_patches approve does not change scores
    await stopServer(server);
    server = await startServer("mock-empty-patches");
    const beforeEmpty = (await json("GET", "/memories/nodes/acme")).data.score as number;
    const iEmpty = await json("POST", "/activities", { raw: "empty patches note", source: "api" });
    assert(iEmpty.status === 201, "empty activity");
    const dEmpty = await json("POST", "/dreams/run");
    assert(dEmpty.status === 202, "empty dream");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dEmpty.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
    );
    const apEmpty = await json("POST", "/dreams/approve", {});
    assert(apEmpty.status === 200 && apEmpty.data.empty_patches === true, "empty_patches true");
    const afterEmpty = await json("GET", "/memories/nodes/acme");
    assert(afterEmpty.data.score === beforeEmpty, "empty_patches leaves scores");

    // T7: illegal category does not enter pending
    await stopServer(server);
    server = await startServer("mock-bad-involvement");
    const iBad = await json("POST", "/activities", { raw: "bad category dream", source: "api" });
    assert(iBad.status === 201, "bad activity");
    const dBad = await json("POST", "/dreams/run");
    assert(dBad.status === 202, "bad dream");
    await waitForJob((job) => job?.status === "failed" || job?.status === "completed");
    const stBad = await json("GET", "/status");
    assert(stBad.data.dream_job?.status === "failed", "bad involvement job failed");
    assert(stBad.data.dream_status !== "pending_review", "bad involvement not pending");
    const pendBad = await json("GET", "/dreams/pending");
    assert(pendBad.data.present === false, "no pending after bad involvement");

    // T1: migrate 0.17→0.19 fills missing score.yaml (legacy what.md layout)
    await mkdir(join(TEST_HOME, "memories/nodes/orphan/understand"), { recursive: true });
    await Bun.write(join(TEST_HOME, "memories/nodes/orphan/understand/what.md"), "orphan\n");
    await Bun.write(join(TEST_HOME, "memories/nodes/orphan/node.meta.yaml"), "id: orphan\nkind: org\n");
    await Bun.write(
      join(TEST_HOME, "memories/nodes/orphan/INDEX.md"),
      "# orphan\n\nSee understand/what.md\n",
    );
    // stamp workspace as 0.18 for migrate admit
    const wsPath = join(TEST_HOME, "engram.workspace.yaml");
    let wsText = await readFile(wsPath, "utf8");
    wsText = wsText.replace(/store_version:\s*[\d.]+/, "store_version: 0.18.2");
    await Bun.write(wsPath, wsText);
    const mig = Bun.spawnSync([
      "bun",
      join(ROOT, ".claude/skills/engram-migration/scripts/migrate-0.17-to-0.19.ts"),
      TEST_HOME,
    ]);
    assert(mig.exitCode === 0, `migrate 0.17→0.19 exit 0: ${mig.stderr.toString()}`);
    const orphanScore = await readFile(
      join(TEST_HOME, "memories/nodes/orphan/score.yaml"),
      "utf8",
    );
    assert(orphanScore.includes("score: 100") || orphanScore.includes("score: 100.0"), "orphan S0");
    let wsAfter = await readFile(wsPath, "utf8");
    assert(wsAfter.includes("store_version: 0.19.0"), "store_version 0.19.0");

    // T1b: migrate 0.19→0.28 (offline; discards pending; renames what.md → {id}.md)
    await mkdir(join(TEST_HOME, "dreams/draft/dream-pending-mig/memories"), { recursive: true });
    await Bun.write(
      join(TEST_HOME, "dreams/draft/dream-pending-mig/memories/note.md"),
      "pending draft junk\n",
    );
    await mkdir(join(TEST_HOME, "dreams/runs"), { recursive: true });
    await Bun.write(
      join(TEST_HOME, "dreams/runs/dream-pending-mig.yaml"),
      [
        "id: dream-pending-mig",
        "status: pending",
        "scope: []",
        "created_at: 2026-08-01T00:00:00.000Z",
        "patch_count: 0",
        "report_path: dreams/reports/dream-pending-mig.md",
        "",
      ].join("\n"),
    );
    await Bun.write(
      join(TEST_HOME, "dreams/dream.lock"),
      JSON.stringify({
        holder: "stale-migrate-test",
        token: "tok-mig",
        acquired_at: "2020-01-01T00:00:00.000Z",
      }) + "\n",
    );
    const mig28 = Bun.spawnSync([
      "bun",
      join(ROOT, ".claude/skills/engram-migration/scripts/migrate-0.19-to-0.28.ts"),
      TEST_HOME,
    ]);
    assert(mig28.exitCode === 0, `migrate 0.19→0.28 exit 0: ${mig28.stderr.toString()}\n${mig28.stdout.toString()}`);
    assert(
      mig28.stdout.toString().includes("discarded pending dream(s): dream-pending-mig"),
      "migrate stdout lists discarded pending",
    );
    assert(
      mig28.stdout.toString().includes("removed dreams/dream.lock") ||
        !(await access(join(TEST_HOME, "dreams/dream.lock")).then(() => true).catch(() => false)),
      "migrate cleared dream.lock",
    );
    const lockGone = await access(join(TEST_HOME, "dreams/dream.lock"))
      .then(() => false)
      .catch(() => true);
    assert(lockGone, "dream.lock file removed");

    const orphanMain = await readFile(join(TEST_HOME, "memories/nodes/orphan/orphan.md"), "utf8");
    assert(orphanMain.includes("orphan"), "orphan.md after hop");
    const legacyOrphan = await access(
      join(TEST_HOME, "memories/nodes/orphan/understand/what.md"),
    )
      .then(() => true)
      .catch(() => false);
    assert(!legacyOrphan, "orphan understand/what.md removed");
    const stubGone = await access(join(TEST_HOME, "memories/nodes/orphan/INDEX.md"))
      .then(() => true)
      .catch(() => false);
    assert(!stubGone, "stub INDEX.md removed");
    const draftLeft = await readdir(join(TEST_HOME, "dreams/draft")).catch(() => [] as string[]);
    assert(draftLeft.length === 0, "dreams/draft cleared");
    const pendingRun = await readFile(
      join(TEST_HOME, "dreams/runs/dream-pending-mig.yaml"),
      "utf8",
    );
    assert(pendingRun.includes("status: discarded"), "pending run marked discarded");
    wsAfter = await readFile(wsPath, "utf8");
    assert(wsAfter.includes("store_version: 0.28.0"), "store_version 0.28.0");

    // T11–T13: boot structure gate (pure check; process exit covered by assertStoreStructureOrExit)
    const tooOld = checkStoreStructure("0.27.0");
    assert(tooOld.ok === false && tooOld.reason === "too_old", "T11 0.27 too old");
    assert(tooOld.message.includes("migrate-0.19-to-0.28"), "T11 migrate hint");
    assert(
      tooOld.message.includes("need not be running") || tooOld.message.includes("offline"),
      "T11 hint says offline／no server required",
    );
    const missing = checkStoreStructure(null);
    assert(missing.ok === false && missing.reason === "missing", "T12 missing store_version");
    assert(checkStoreStructure("0.28.0").ok === true, "T13 0.28 ok");
    assert(checkStoreStructure("0.29.1").ok === true, "T13 newer stamp ok");
    const mm27 = parseMajorMinor("0.27.0");
    const mm28 = parseMajorMinor("0.28.0");
    assert(mm27 && mm28 && !structureAtLeast(mm27, mm28), "structureAtLeast 0.27 < 0.28");
    assert(mm28 && structureAtLeast(mm28, { major: 0, minor: 28 }), "structureAtLeast 0.28 >=");

    console.log("\nPhase 9: capture concurrency + node_refs (0.20)");
    const badRefs = await json("POST", "/activities", {
      raw: "bad node_refs shape",
      node_refs: "acme",
    });
    assert(badRefs.status === 400, "node_refs string → 400");
    assert(badRefs.data.error === "invalid_node_refs", "invalid_node_refs error");

    const goodRefs = await json("POST", "/activities", {
      raw: "good node_refs shape",
      node_refs: ["acme"],
    });
    assert(goodRefs.status === 201, "node_refs string[] → 201");
    assert(typeof goodRefs.data.event_id === "string", "good refs event id");

    const serialIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await json("POST", "/activities", { raw: `serial-capture-${i}` });
      assert(r.status === 201, `serial capture ${i}`);
      serialIds.push(String(r.data.event_id));
    }
    assert(new Set(serialIds).size === 20, "serial ids unique");
    for (let i = 1; i < serialIds.length; i++) {
      assert(serialIds[i]! > serialIds[i - 1]!, `serial strictly increasing at ${i}`);
    }

    const parallel = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        json("POST", "/activities", { raw: `parallel-capture-${i}` }),
      ),
    );
    for (const r of parallel) {
      assert(r.status === 201, `parallel capture 201 got ${r.status}`);
    }
    const parallelIds = parallel.map((r) => String(r.data.event_id));
    assert(new Set(parallelIds).size === 10, "parallel ids unique");
    const eventsTail = await readFile(
      join(TEST_HOME, "memories/activities/events.jsonl"),
      "utf8",
    );
    const poolTail = await readFile(
      join(TEST_HOME, "memories/short-term-memory/pool.jsonl"),
      "utf8",
    );
    for (const id of parallelIds) {
      assert(eventsTail.includes(id), `L0 has ${id}`);
      assert(poolTail.includes(id), `pool has ${id}`);
    }

    console.log("\n✅ All self-checks passed (through 0.28)");
  } finally {
    await stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
