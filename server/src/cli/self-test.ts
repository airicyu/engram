/**
 * Self-test for dream approve + future-sight (isolated ENGRAM_STORE_DIR + mock agent).
 */
import { rm, mkdir, readFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { checkStoreStructure, structureAtLeast, parseMajorMinor } from "../store/store-structure";
import { resolveAgentSkillDir } from "../paths/agent-skills";

const ROOT = resolve(import.meta.dir, "../../..");
const TEST_HOME = join(ROOT, "data-test");
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;

function migrationScript(name: string): string {
  const skill = resolveAgentSkillDir(ROOT, "engram-migration");
  assert(skill, "engram-migration skill directory not found under agent skills root");
  return join(skill, "scripts", name);
}

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

function startServer(agent: string, extraEnv: Record<string, string> = {}): Promise<ChildProcess> {
  const server = spawn("bun", ["run", "src/index.ts"], {
    cwd: join(ROOT, "server"),
    env: {
      ...process.env,
      ENGRAM_STORE_DIR: TEST_HOME,
      PORT: String(PORT),
      ENGRAM_AGENT: agent,
      ENGRAM_ALLOW_VIRTUAL_CLOCK: "1",
      ENGRAM_MEMORY_LANGUAGE: "en",
      ...extraEnv,
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
    const emptyGraph = await json("GET", "/memories/nodes/graph");
    assert(emptyGraph.status === 200 && emptyGraph.data.present === false, "empty nodes graph");
    assert(Array.isArray(emptyGraph.data.nodes) && emptyGraph.data.nodes.length === 0, "empty graph nodes");
    assert(Array.isArray(emptyGraph.data.edges) && emptyGraph.data.edges.length === 0, "empty graph edges");
    const emptyDay = await json("GET", "/memories/chain/2020-01-01");
    assert(emptyDay.status === 200 && emptyDay.data.present === false, "empty chain detail");

    const emptyDream = await json("POST", "/dreams/run");
    assert(emptyDream.status === 409 && emptyDream.data.error === "nothing_to_dream", "empty pool 409");

    const i1 = await json("POST", "/activities", {
      raw: "Talked to [@alice](node:alice) about [@acme](node:acme) API rate limits",
      source: "api",
    });
    assert(i1.status === 201 && i1.data.event_id === "e0000000001", "first ingest");

    const i2 = await json("POST", "/activities", {
      raw: "NewCo might partner with us on [@aurora](node:aurora)",
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

    const seededGraph = await json("GET", "/memories/nodes/graph");
    assert(seededGraph.status === 200 && seededGraph.data.present === true, "seeded graph present");
    assert(Array.isArray(seededGraph.data.edges) && seededGraph.data.edges.length === 0, "no wikilinks → no edges");
    const seededIdx = await json("GET", "/memories/nodes");
    assert(
      JSON.stringify((seededIdx.data.nodes as { node: string }[]).map((n) => n.node)) ===
        JSON.stringify((seededGraph.data.nodes as { node: string }[]).map((n) => n.node)),
      "graph nodes match index after seed",
    );

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
      summaryBody.includes("[[nodes/"),
      "day summary includes P1 node wikilink",
    );
    assert(
      ledgerBody.includes("[[nodes/"),
      "day ledger includes P1 node wikilink",
    );
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
    assert(Array.isArray(l1.data.entries) && l1.data.entries.length > 0, "l1 entries");
    assert(!("summary" in l1.data), "l1 has no summary");
    assert(!("node_notes" in l1.data), "l1 has no node_notes");
    assert(!("nodes" in l1.data), "l1 has no nodes");

    await stopServer(server);
    server = await startServer("mock-ask-ok");

    const askRemovedFlag = await json("POST", "/memories/ask", {
      q: "What about Acme?",
      include_later: "true",
    });
    assert(
      askRemovedFlag.status === 400 && askRemovedFlag.data.error === "include_later_removed",
      "ask reject include_later string",
    );
    const askRemovedFalse = await json("POST", "/memories/ask", {
      q: "What about Acme?",
      include_later: false,
    });
    assert(
      askRemovedFalse.status === 400 && askRemovedFalse.data.error === "include_later_removed",
      "ask reject include_later false",
    );
    const askRemovedTrue = await json("POST", "/memories/ask", {
      q: "What about Acme?",
      include_later: true,
    });
    assert(
      askRemovedTrue.status === 400 && askRemovedTrue.data.error === "include_later_removed",
      "ask reject include_later true",
    );

    const askStart = await json("POST", "/memories/ask", { q: "What about Acme?" });
    assert(askStart.status === 202 && askStart.data.job_id, "ask 202");
    assert(!("include_later" in askStart.data), "ask 202 has no include_later");
    const jobId = askStart.data.job_id as string;
    let askDone = false;
    for (let i = 0; i < 40; i++) {
      const poll = await json("GET", `/memories/ask/${encodeURIComponent(jobId)}`);
      assert(poll.status === 200 && poll.data.present === true, "ask poll");
      if (poll.data.status === "completed") {
        assert(String(poll.data.answer).includes("Mock answer"), "ask answer");
        assert(String(poll.data.answer).includes("hot+later allowed"), "ask always allows later");
        assert(!("include_later" in poll.data), "poll has no include_later");
        const srcs = poll.data.sources as { kind?: string; zone?: string }[];
        assert(
          Array.isArray(srcs) && srcs.some((s) => s.kind === "future_sight" && s.zone === "later"),
          "ask later source zone",
        );
        askDone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    assert(askDone, "ask completed");

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

    console.log("Phase 4c2: nodes graph edges");
    const gPair = ["galpha", "gbeta", "gdelta"] as const;
    for (const id of gPair) {
      await mkdir(join(TEST_HOME, `memories/nodes/${id}`), { recursive: true });
    }
    await Bun.write(
      join(TEST_HOME, "memories/nodes/galpha/galpha.md"),
      [
        "[[nodes/gbeta/gbeta|B]]",
        "[[nodes/galpha/galpha|self]]",
        "[[nodes/ghost/ghost|missing]]",
        "[[nodes/nope|bad]]",
        "",
      ].join("\n"),
    );
    await Bun.write(
      join(TEST_HOME, "memories/nodes/gbeta/gbeta.md"),
      "[[nodes/galpha/galpha|A]]\n[[nodes/galpha/galpha|A2]]\n",
    );
    await Bun.write(
      join(TEST_HOME, "memories/nodes/gdelta/gdelta.md"),
      "[[nodes/galpha/galpha|one-way]]\n",
    );
    const graphBody = await json("GET", "/memories/nodes/graph");
    assert(graphBody.status === 200 && graphBody.data.present === true, "graph 200 present");
    const idxAfter = await json("GET", "/memories/nodes");
    assert(
      JSON.stringify((idxAfter.data.nodes as { node: string }[]).map((n) => n.node)) ===
        JSON.stringify((graphBody.data.nodes as { node: string }[]).map((n) => n.node)),
      "graph nodes[] matches GET /memories/nodes",
    );
    const edges = graphBody.data.edges as Array<{ a: string; b: string; refs: number; level: number }>;
    const ab = edges.find((e) => e.a === "galpha" && e.b === "gbeta");
    assert(ab != null && ab.refs === 3 && ab.level === 2, "bidirectional refs 3 → level 2");
    const ad = edges.find((e) => e.a === "galpha" && e.b === "gdelta");
    assert(ad != null && ad.refs === 1 && ad.level === 1, "one-way refs 1 → level 1");
    assert(!edges.some((e) => e.a === "galpha" && e.b === "galpha"), "no self edge");
    assert(!edges.some((e) => e.a === "ghost" || e.b === "ghost"), "missing id not an endpoint");
    for (const e of edges) {
      assert(e.a < e.b, "edge a < b");
      assert(e.refs >= 1, "refs >= 1");
      assert(e.level >= 1 && e.level <= 10, "level 1–10");
    }

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
    assert(
      monthText.includes("[[nodes/"),
      "month summary includes P1 node wikilink",
    );

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
    assert(
      !(await Bun.file(join(TEST_HOME, "memories/chain/initialized_weeks.yaml")).exists()),
      "no initialized_weeks.yaml after rollup",
    );
    assert(
      !(await Bun.file(join(TEST_HOME, "memories/chain/initialized_months.yaml")).exists()),
      "no initialized_months.yaml after rollup",
    );

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
      migrationScript("migrate-0.17-to-0.19.ts"),
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
      migrationScript("migrate-0.19-to-0.28.ts"),
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

    // T1c: migrate 0.28→0.36 (drop initialized yaml + STM derived)
    await mkdir(join(TEST_HOME, "memories/chain"), { recursive: true });
    await Bun.write(join(TEST_HOME, "memories/chain/initialized_weeks.yaml"), "ids: []\n");
    await Bun.write(join(TEST_HOME, "memories/chain/initialized_months.yaml"), "ids: []\n");
    await mkdir(join(TEST_HOME, "memories/short-term-memory/nodes/acme"), { recursive: true });
    await Bun.write(
      join(TEST_HOME, "memories/short-term-memory/nodes/acme/notes.md"),
      "legacy note\n",
    );
    await Bun.write(join(TEST_HOME, "memories/short-term-memory/summary.md"), "- leftover\n");
    const mig36 = Bun.spawnSync([
      "bun",
      migrationScript("migrate-0.28-to-0.36.ts"),
      TEST_HOME,
    ]);
    assert(mig36.exitCode === 0, `migrate 0.28→0.36 exit 0: ${mig36.stderr.toString()}\n${mig36.stdout.toString()}`);
    assert(
      !(await Bun.file(join(TEST_HOME, "memories/chain/initialized_weeks.yaml")).exists()),
      "initialized_weeks.yaml dropped",
    );
    assert(
      !(await Bun.file(join(TEST_HOME, "memories/chain/initialized_months.yaml")).exists()),
      "initialized_months.yaml dropped",
    );
    assert(
      !(await Bun.file(join(TEST_HOME, "memories/short-term-memory/nodes")).exists()),
      "STM nodes/ dropped",
    );
    assert(
      !(await Bun.file(join(TEST_HOME, "memories/short-term-memory/summary.md")).exists()),
      "STM summary.md dropped",
    );
    wsAfter = await readFile(wsPath, "utf8");
    assert(wsAfter.includes("store_version: 0.36.0"), "store_version 0.36.0");

    // T11–T13: boot structure gate (pure check; process exit covered by assertStoreStructureOrExit)
    const tooOld = checkStoreStructure("0.27.0");
    assert(tooOld.ok === false && tooOld.reason === "too_old", "T11 0.27 too old");
    assert(tooOld.message.includes("migrate-0.19-to-0.28"), "T11 migrate hint 0.19→0.28");
    assert(tooOld.message.includes("migrate-0.28-to-0.36"), "T11 migrate hint 0.28→0.36");
    assert(
      tooOld.message.includes("need not be running") || tooOld.message.includes("offline"),
      "T11 hint says offline／no server required",
    );
    const missing = checkStoreStructure(null);
    assert(missing.ok === false && missing.reason === "missing", "T12 missing store_version");
    assert(checkStoreStructure("0.28.0").ok === false, "T13 0.28 too old for 0.36 gate");
    assert(checkStoreStructure("0.35.0").ok === false, "T13 0.35 too old");
    assert(checkStoreStructure("0.36.0").ok === true, "T13 0.36 ok");
    assert(checkStoreStructure("0.37.1").ok === true, "T13 newer stamp ok");
    const mm27 = parseMajorMinor("0.27.0");
    const mm36 = parseMajorMinor("0.36.0");
    assert(mm27 && mm36 && !structureAtLeast(mm27, mm36), "structureAtLeast 0.27 < 0.36");
    assert(mm36 && structureAtLeast(mm36, { major: 0, minor: 36 }), "structureAtLeast 0.36 >=");

    console.log("\nPhase 9: capture concurrency + mentions (0.32)");
    await stopServer(server);
    server = await startServer("mock-ok");
    const badRefs = await json("POST", "/activities", {
      raw: "legacy node_refs rejected",
      node_refs: "acme",
    });
    assert(badRefs.status === 400, "node_refs key → 400");
    assert(badRefs.data.error === "node_refs_removed", "node_refs_removed error");

    const badRefsArr = await json("POST", "/activities", {
      raw: "legacy node_refs array rejected",
      node_refs: ["acme"],
    });
    assert(badRefsArr.status === 400, "node_refs array → 400");
    assert(badRefsArr.data.error === "node_refs_removed", "node_refs_removed for array");

    const plainOk = await json("POST", "/activities", {
      raw: "plain text capture still works",
    });
    assert(plainOk.status === 201, "plain raw → 201");

    const mentionOk = await json("POST", "/activities", {
      raw: "met [@ken](node:ken) at lunch",
    });
    assert(mentionOk.status === 201, "mention ref → 201");
    assert(typeof mentionOk.data.event_id === "string", "mention event id");

    const createExists = await json("POST", "/activities", {
      raw: "try create existing [@acme](node-create:acme)",
    });
    assert(createExists.status === 400, "create existing → 400");
    assert(createExists.data.error === "mention_create_exists", "mention_create_exists");

    const createNew = await json("POST", "/activities", {
      raw: "introducing [@brandnew32](node-create:brandnew32)",
    });
    assert(createNew.status === 201, "node-create brandnew32 → 201");
    const createEvtId = String(createNew.data.event_id);

    console.log("\nPhase 9c: mention create → node main (0.32)");
    const dreamMentions = await json("POST", "/dreams/run");
    assert(dreamMentions.status === 202, `mention dream 202 got ${dreamMentions.status} ${JSON.stringify(dreamMentions.data)}`);
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dreamMentions.data.job_id &&
        (job?.status === "completed" || job?.status === "failed") &&
        (st2.dream_status === "pending_review" || st2.dream_status === "dream_incomplete"),
      60000,
    );
    const stAfterMention = await json("GET", "/status");
    assert(
      stAfterMention.data.dream_status === "pending_review",
      `mention dream pending_review got ${stAfterMention.data.dream_status} job=${JSON.stringify(stAfterMention.data.dream_job)}`,
    );
    const apMentions = await json("POST", "/dreams/approve", {});
    assert(apMentions.status === 200, "mention dream approve");
    const brandnew32Main = join(
      TEST_HOME,
      "memories/nodes/brandnew32/brandnew32.md",
    );
    assert(await Bun.file(brandnew32Main).exists(), "brandnew32 node main after approve");
    const brandnew32Body = await readFile(brandnew32Main, "utf8");
    assert(brandnew32Body.includes("## Identity"), "brandnew32 standing headings");
    void createEvtId;

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

    console.log("\nPhase 9b: attachments (0.29)");

    // Upload a test image
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0xFD, 0x33,
      0x1F, 0xCA, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]);

    const formData = new FormData();
    const blob = new Blob([pngBytes], { type: "image/png" });
    formData.set("file", blob, "test-menu.png");

    const uploadRes = await fetch(`${BASE}/attachments/uploads`, {
      method: "POST",
      body: formData,
    });
    assert(uploadRes.status === 201, `upload 201 got ${uploadRes.status}`);
    const uploadData = await uploadRes.json() as { path: string; day: string; filename: string };
    assert(typeof uploadData.path === "string" && uploadData.path.startsWith("_attachments/uploads/"), "upload path");
    assert(!uploadData.path.includes("/tmp"), "upload path never /tmp");
    assert(typeof uploadData.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(uploadData.day), "upload day");
    assert(typeof uploadData.filename === "string" && uploadData.filename.length > 0, "upload filename");

    // Verify tmp file exists on disk
    const tmpPath = join(TEST_HOME, "memories", "_attachments", "uploads", "tmp", uploadData.day, uploadData.filename);
    assert(await Bun.file(tmpPath).exists(), "tmp file exists on disk");

    // Verify .gitignore has tmp entry
    const gi2 = await readFile(join(TEST_HOME, ".gitignore"), "utf8");
    assert(gi2.includes("memories/_attachments/uploads/tmp/"), ".gitignore has attachments tmp");

    // Upload with invalid MIME (JSON)
    const badForm = new FormData();
    const jsonBlob = new Blob([JSON.stringify({ x: 1 })], { type: "application/json" });
    badForm.set("file", jsonBlob, "test.json");
    const badMime = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: badForm });
    assert(badMime.status === 400, `invalid mime 400 got ${badMime.status}`);
    const badMimeData = await badMime.json() as { error: string };
    assert(badMimeData.error === "invalid_mime", "invalid mime error");

    // Upload without file field
    const noFile = await fetch(`${BASE}/attachments/uploads`, {
      method: "POST",
      body: (() => { const f = new FormData(); f.set("other", "value"); return f; })(),
    });
    assert(noFile.status === 400, `missing file 400 got ${noFile.status}`);

    // Upload > lock check: upload should be accepted while no lock
    const uploadBeforeLock = await fetch(`${BASE}/attachments/uploads`, {
      method: "POST",
      body: (() => { const f = new FormData(); f.set("file", blob, "menu2.png"); return f; })(),
    });
    assert(uploadBeforeLock.status === 201, "upload while not locked");

    // DELETE tmp file (idempotent)
    const delRes = await fetch(
      `${BASE}/attachments/uploads/tmp?day=${uploadData.day}&filename=${uploadData.filename}`,
      { method: "DELETE" },
    );
    assert(delRes.status === 200, `delete tmp 200 got ${delRes.status}`);
    const delData = await delRes.json() as { deleted: boolean };
    assert(delData.deleted === true, "delete tmp ok");

    // DELETE missing file (idempotent 200)
    const delMissing = await fetch(
      `${BASE}/attachments/uploads/tmp?day=${uploadData.day}&filename=nonexistent.png`,
      { method: "DELETE" },
    );
    assert(delMissing.status === 200, "delete missing 200");

    // DELETE with bad params
    const delBad = await fetch(`${BASE}/attachments/uploads/tmp?day=bad`, { method: "DELETE" });
    assert(delBad.status === 400, "delete missing params 400");

    // Re-upload for activities test
    const formData2 = new FormData();
    formData2.set("file", blob, "menu.png");
    const upload2 = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: formData2 });
    assert(upload2.status === 201, "re-upload 201");
    const up2 = await upload2.json() as { path: string; day: string; filename: string };

    // Activities with attachment: symmetric success
    const rawWithEmbed = `Had lunch today\n\n![[${up2.path}]]\n`;
    const actWithAtt = await json("POST", "/activities", {
      raw: rawWithEmbed,
      attachments: [{ path: up2.path, relationship: "Lunch menu photo" }],
    });
    assert(actWithAtt.status === 201, `activity with attachment 201 got ${actWithAtt.status} ${JSON.stringify(actWithAtt.data)}`);

    // Verify event has attachments + appendix in raw
    const eventsWithAtt = await readFile(join(TEST_HOME, "memories/activities/events.jsonl"), "utf8");
    const lastEvent = JSON.parse(eventsWithAtt.trim().split("\n").pop()!) as Record<string, unknown>;
    assert(Array.isArray(lastEvent.attachments), "event has attachments array");
    assert((lastEvent.attachments as unknown[]).length === 1, "event has 1 attachment");
    assert(typeof lastEvent.raw === "string" && lastEvent.raw.includes("## Attachment relationships"), "event raw has appendix");
    assert(lastEvent.raw.includes("**name:** ![[") && lastEvent.raw.includes("**relationship:**"), "appendix has name/relationship");
    assert(lastEvent.raw.includes("Lunch menu photo"), "appendix has relationship text");

    // Verify formal file exists (moved from tmp)
    const formalPath = join(TEST_HOME, "memories", "_attachments", "uploads", up2.day, up2.filename);
    assert(await Bun.file(formalPath).exists(), "formal file exists after submit");

    // Verify tmp file is gone
    const tmpGone = await Bun.file(join(TEST_HOME, "memories", "_attachments", "uploads", "tmp", up2.day, up2.filename)).exists();
    assert(!tmpGone, "tmp file gone after submit");

    // STM should have the appendix
    const poolAtt = await readFile(join(TEST_HOME, "memories/short-term-memory/pool.jsonl"), "utf8");
    assert(poolAtt.includes("## Attachment relationships"), "STM pool has appendix");

    // Activities: embed without attachment list (upload a fresh file)
    const upEmbedForm = new FormData();
    upEmbedForm.set("file", blob, "embed-only.png");
    const uploadEmbed = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: upEmbedForm });
    const upEmbed = await uploadEmbed.json() as { path: string; day: string; filename: string };
    const actEmbedOnly = await json("POST", "/activities", {
      raw: `Test\n\n![[${upEmbed.path}]]\n`,
    });
    assert(actEmbedOnly.status === 400, "embed_without_attachment 400");
    assert(actEmbedOnly.data.error === "embed_without_attachment", "embed without attachment error");

    // Activities: attachment not in embeds (upload a fresh file, not submitted first)
    const upMismatchForm = new FormData();
    upMismatchForm.set("file", blob, "mismatch.png");
    const uploadMismatch = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: upMismatchForm });
    const upMismatch = await uploadMismatch.json() as { path: string; day: string; filename: string };
    const actMismatch = await json("POST", "/activities", {
      raw: "No embed here",
      attachments: [{ path: upMismatch.path, relationship: "orphan" }],
    });
    assert(actMismatch.status === 400, "attachment_not_in_embeds 400");
    assert(actMismatch.data.error === "attachment_not_in_embeds", "attachment not in embeds error");

    // Activities: empty relationship (upload a fresh file)
    const upEmptyRelForm = new FormData();
    upEmptyRelForm.set("file", blob, "empty-rel.png");
    const uploadEmptyRel = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: upEmptyRelForm });
    const upEmptyRel = await uploadEmptyRel.json() as { path: string; day: string; filename: string };
    const actEmptyRel = await json("POST", "/activities", {
      raw: `Test\n\n![[${upEmptyRel.path}]]\n`,
      attachments: [{ path: upEmptyRel.path, relationship: "  " }],
    });
    assert(actEmptyRel.status === 400, "empty_relationship 400");
    assert(actEmptyRel.data.error === "empty_relationship", "empty relationship error");

    // Activities: duplicate path (upload a fresh file)
    const upDupForm = new FormData();
    upDupForm.set("file", blob, "duplicate.png");
    const uploadDup = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: upDupForm });
    const upDup = await uploadDup.json() as { path: string; day: string; filename: string };
    const actDup = await json("POST", "/activities", {
      raw: `Test\n\n![[${upDup.path}]]\n`,
      attachments: [
        { path: upDup.path, relationship: "a" },
        { path: upDup.path, relationship: "b" },
      ],
    });
    assert(actDup.status === 400, "duplicate_attachment_path 400");
    assert(actDup.data.error === "duplicate_attachment_path", "duplicate path error");

    // Activities: double appendix (upload a fresh file)
    const upDoubleAppForm = new FormData();
    upDoubleAppForm.set("file", blob, "double-appendix.png");
    const uploadDoubleApp = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: upDoubleAppForm });
    const upDoubleApp = await uploadDoubleApp.json() as { path: string; day: string; filename: string };
    const actDoubleApp = await json("POST", "/activities", {
      raw: `Test\n\n## Attachment relationships\n\nSome content\n\n![[${upDoubleApp.path}]]\n`,
      attachments: [{ path: upDoubleApp.path, relationship: "test" }],
    });
    assert(actDoubleApp.status === 400, "double_appendix 400");
    assert(actDoubleApp.data.error === "double_appendix", "double appendix error");

    // Activities: invalid path (path traversal)
    const actBadPath = await json("POST", "/activities", {
      raw: "Test\n\n![[_attachments/uploads/2020-01-01/../../etc/passwd]]\n",
      attachments: [{ path: "_attachments/uploads/2020-01-01/../../etc/passwd", relationship: "test" }],
    });
    assert(actBadPath.status === 400, "invalid_attachment_path 400");

    // Activities: |alias variant → 400 (non_exact_attachment_wikilink)
    // With attachments list
    const upAliasForm = new FormData();
    upAliasForm.set("file", blob, "alias-test.png");
    const uploadAlias = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: upAliasForm });
    const upAlias = await uploadAlias.json() as { path: string; day: string; filename: string };
    const actAlias = await json("POST", "/activities", {
      raw: `Test\n\n![[${upAlias.path}|nice pic]]\n`,
      attachments: [{ path: upAlias.path, relationship: "alias test" }],
    });
    assert(actAlias.status === 400, `|alias with attachments → 400 got ${actAlias.status}`);
    assert(actAlias.data.error === "non_exact_attachment_wikilink", "non_exact_attachment_wikilink error");

    // |alias without attachments list → 400
    const actAliasNoAtt = await json("POST", "/activities", {
      raw: `Test\n\n![[${upAlias.path}|nice pic]]\n`,
    });
    assert(actAliasNoAtt.status === 400, `|alias without attachments → 400 got ${actAliasNoAtt.status}`);
    assert(actAliasNoAtt.data.error === "non_exact_attachment_wikilink", "alias no-att error");

    // Clean up alias tmp
    await fetch(`${BASE}/attachments/uploads/tmp?day=${upAlias.day}&filename=${upAlias.filename}`, { method: "DELETE" });

    // HEIC rejection
    const heicForm = new FormData();
    const heicBlob = new Blob([new Uint8Array(8)], { type: "image/heic" });
    heicForm.set("file", heicBlob, "photo.heic");
    const heicRes = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: heicForm });
    assert(heicRes.status === 400, `HEIC upload → 400 got ${heicRes.status}`);
    const heicData = await heicRes.json() as { error: string };
    assert(heicData.error === "invalid_mime", "HEIC invalid_mime");

    // file_too_large (exceeds max_bytes)
    const tooBigForm = new FormData();
    const bigBytes = new Uint8Array(11 * 1024 * 1024); // 11 MiB > default 10 MiB
    const bigBlob = new Blob([bigBytes], { type: "image/png" });
    tooBigForm.set("file", bigBlob, "big.png");
    const bigRes = await fetch(`${BASE}/attachments/uploads`, { method: "POST", body: tooBigForm });
    assert(bigRes.status === 400, `file_too_large → 400 got ${bigRes.status}`);
    const bigData = await bigRes.json() as { error: string };
    assert(bigData.error === "file_too_large", "file_too_large error");

    // Upload during lock → 409
    const lockPath = join(TEST_HOME, "dreams", "dream.lock");
    await Bun.write(lockPath, JSON.stringify({
      holder: "test-lock",
      token: "tok-test",
      acquired_at: new Date().toISOString(),
    }));
    const lockedUpload = await fetch(`${BASE}/attachments/uploads`, {
      method: "POST",
      body: (() => { const f = new FormData(); f.set("file", blob, "locked.png"); return f; })(),
    });
    assert(lockedUpload.status === 409, `upload during lock → 409 got ${lockedUpload.status}`);
    const lockedData = await lockedUpload.json() as { error: string };
    assert(lockedData.error === "dream_locked", "dream_locked error");
    await rm(lockPath);

    // Housekeep: create expired tmp dir and verify it's cleaned
    const oldDay = "2020-01-01"; // ~6 years ago > 2 day retention
    const oldTmpDir = join(TEST_HOME, "memories", "_attachments", "uploads", "tmp", oldDay);
    await mkdir(oldTmpDir, { recursive: true });
    await Bun.write(join(oldTmpDir, "old-file.png"), new Uint8Array(4));
    const hk = await json("POST", "/attachments/housekeep");
    assert(hk.status === 200, "housekeep 200");
    assert(Array.isArray(hk.data.removed), "housekeep has removed array");
    assert(hk.data.removed.includes(oldDay), `housekeep removed expired ${oldDay}: ${JSON.stringify(hk.data.removed)}`);
    const oldDirGone = await access(oldTmpDir).then(() => false).catch(() => true);
    assert(oldDirGone, "expired tmp dir removed by housekeep");

    // Clean up leftover tmp files from error tests
    for (const up of [upEmbed, upMismatch, upEmptyRel, upDup, upDoubleApp]) {
      await fetch(
        `${BASE}/attachments/uploads/tmp?day=${up.day}&filename=${up.filename}`,
        { method: "DELETE" },
      ).catch(() => {});
    }

    // ── 0.30 Clarify ──────────────────────────────────────────────
    console.log("\nPhase 0.30: Clarify aside → dream → approve → history");
    await stopServer(server);
    server = await startServer("mock-ok");

    // Ensure at least one live node so generate is not no-op
    const nodesBefore = await json("GET", "/memories/nodes");
    if (!(nodesBefore.data.nodes as unknown[])?.length) {
      await mkdir(join(TEST_HOME, "memories/nodes/acme"), { recursive: true });
      await Bun.write(
        join(TEST_HOME, "memories/nodes/acme/acme.md"),
        "## Identity\n\nAcme Corp.\n\n## Relation\n\n_None_\n\n## Standing facts\n\n_None_\n\n## Current situation\n\n_None_\n",
      );
      await Bun.write(join(TEST_HOME, "memories/nodes/acme/node.meta.yaml"), "id: acme\nkind: org\naliases: []\n");
      await Bun.write(join(TEST_HOME, "memories/nodes/acme/score.yaml"), "score: 100\nscore_timestamp: \"2026-01-01T00:00:00.000Z\"\n");
    }

    const aside = await json("POST", "/memories/clarify/aside", { raw: "Acme contract is two years not one." });
    assert(aside.status === 201 && aside.data.id, "clarify aside 201");
    const asideId = aside.data.id as string;

    // Seed an asking for submit／dismiss path (write into TEST_HOME; server already ensure'd dirs)
    const askingDir = join(TEST_HOME, "memories/clarify/asking");
    await mkdir(askingDir, { recursive: true });
    await Bun.write(
      join(askingDir, "phase30-ask-1.md"),
      [
        "---",
        'id: "phase30-ask-1"',
        "kind: prompt",
        'created_at: "2026-08-11T10:00:00.000+08:00"',
        'source_dream_run_id: "seed-run"',
        'related_nodes: ["acme"]',
        "---",
        "",
        "## Question",
        "",
        "Is Acme GA or beta?",
        "",
      ].join("\n"),
    );
    const askList0 = await json("GET", "/memories/clarify/asking");
    assert(
      (askList0.data.items as Array<{ id: string }>).some((x) => x.id === "phase30-ask-1"),
      "seeded asking present",
    );
    const submit = await json("POST", "/memories/clarify/asking/phase30-ask-1/submit", {
      answer: "Internal beta first.",
    });
    assert(submit.status === 200 && submit.data.queue === "pending", "clarify submit 200");
    await Bun.write(
      join(askingDir, "phase30-ask-dismiss.md"),
      [
        "---",
        'id: "phase30-ask-dismiss"',
        "kind: prompt",
        'created_at: "2026-08-11T10:01:00.000+08:00"',
        'source_dream_run_id: "seed-run"',
        "related_nodes: []",
        "---",
        "",
        "## Question",
        "",
        "Dismiss me",
        "",
      ].join("\n"),
    );
    const dismiss = await json("DELETE", "/memories/clarify/asking/phase30-ask-dismiss");
    assert(dismiss.status === 200, "clarify dismiss 200");
    const askAfterDismiss = await json("GET", "/memories/clarify/asking");
    assert(
      !(askAfterDismiss.data.items as Array<{ id: string }>).some((x) => x.id === "phase30-ask-dismiss"),
      "dismissed asking gone",
    );

    // dream_locked → 409
    const lockPath30 = join(TEST_HOME, "dreams", "dream.lock");
    await Bun.write(lockPath30, JSON.stringify({
      holder: "test-lock",
      token: "tok-30",
      acquired_at: new Date().toISOString(),
    }));
    const lockedAside = await json("POST", "/memories/clarify/aside", { raw: "should fail" });
    assert(lockedAside.status === 409 && lockedAside.data.error === "dream_locked", "clarify aside locked 409");
    await rm(lockPath30);

    const i30 = await json("POST", "/activities", { raw: "clarify pipeline activity", source: "api" });
    assert(i30.status === 201, "clarify activity");
    const d30 = await json("POST", "/dreams/run");
    assert(d30.status === 202 && d30.data.job_id, "clarify dream 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === d30.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
      30000,
    );

    // pending_review allows clarify writes
    const asideDuring = await json("POST", "/memories/clarify/aside", {
      raw: "Note while pending_review — stays for next cycle",
    });
    assert(asideDuring.status === 201, "aside during pending_review");

    const pend30 = await json("GET", "/dreams/pending");
    assert(pend30.data.present === true, "pending present");
    assert(pend30.data.draft_summary && typeof pend30.data.draft_summary === "object", "draft_summary object");
    assert(
      Array.isArray(pend30.data.draft_summary.clarify_distilled_node_ids),
      "clarify_distilled_node_ids array",
    );
    assert(
      typeof pend30.data.report === "string" && pend30.data.report.includes("## Clarify distill"),
      "report has Clarify distill",
    );

    const askingAfterGen = await json("GET", "/memories/clarify/asking");
    assert(askingAfterGen.status === 200, "list asking 200");
    assert(Array.isArray(askingAfterGen.data.items), "asking items array");
    const askingCount1 = (askingAfterGen.data.items as unknown[]).length;
    assert(askingCount1 >= 1 && askingCount1 <= 10, `asking 1..10 got ${askingCount1}`);

    // Discard must not clear asking
    const disc30 = await json("POST", "/dreams/discard", {});
    assert(disc30.status === 200, "discard");
    const askingAfterDisc = await json("GET", "/memories/clarify/asking");
    assert(
      (askingAfterDisc.data.items as unknown[]).length === askingCount1,
      "discard keeps asking",
    );
    // pending queue (asideDuring + possibly leftover) still on disk — re-aside path uses API only
    // Re-run dream after discard (need activity again)
    const i30b = await json("POST", "/activities", { raw: "clarify after discard", source: "api" });
    assert(i30b.status === 201, "activity after discard");
    // Re-add snapshot pending via aside if needed
    const aside2 = await json("POST", "/memories/clarify/aside", { raw: "Second aside for archive" });
    assert(aside2.status === 201, "aside2");
    const aside2Id = aside2.data.id as string;

    const d30b = await json("POST", "/dreams/run");
    assert(d30b.status === 202, "dream after discard");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === d30b.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
      30000,
    );
    const runId30b = d30b.data.job_id as string;
    const askingBeforeRetry = ((await json("GET", "/memories/clarify/asking")).data.items as Array<{ id: string; source_dream_run_id: string | null }>);
    const fromThisRun = askingBeforeRetry.filter((x) => x.source_dream_run_id === runId30b).length;

    // Retry clears asking from superseded run then regenerates ≤10
    const retry30 = await json("POST", "/dreams/retry", { reason: "clarify retry check" });
    assert(retry30.status === 202, "retry 202");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === retry30.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
      30000,
    );
    const askingAfterRetry = ((await json("GET", "/memories/clarify/asking")).data.items as Array<{ source_dream_run_id: string | null }>);
    assert(askingAfterRetry.length <= 10, `asking ≤10 after retry got ${askingAfterRetry.length}`);
    assert(
      !askingAfterRetry.some((x) => x.source_dream_run_id === runId30b),
      "retry cleared asking from superseded run",
    );
    void fromThisRun;
    void asideId;

    const ap30 = await json("POST", "/dreams/approve", {});
    assert(ap30.status === 200, "clarify approve");
    // Snapshot pending should be in history; asideDuring (after first snapshot) may still be pending
    const histPath = join(TEST_HOME, "memories/clarify/history", `${aside2Id}.md`);
    const histExists = await access(histPath).then(() => true).catch(() => false);
    assert(histExists, `history has archived aside2 ${aside2Id}`);

    // empty_patches still archives clarify snapshot
    await stopServer(server);
    server = await startServer("mock-empty-patches", { ENGRAM_CLARIFY_DISTILL_NOOP: "1" });
    const asideEmpty = await json("POST", "/memories/clarify/aside", { raw: "empty-patches archive me" });
    assert(asideEmpty.status === 201, "aside for empty_patches");
    const emptyAsideId = asideEmpty.data.id as string;
    const iEmptyClar = await json("POST", "/activities", { raw: "empty with clarify", source: "api" });
    assert(iEmptyClar.status === 201, "empty clarify activity");
    const dEmptyClar = await json("POST", "/dreams/run");
    assert(dEmptyClar.status === 202, "empty clarify dream");
    await waitForJob(
      (job, st2) =>
        job?.dream_run_id === dEmptyClar.data.job_id &&
        job?.status === "completed" &&
        st2.dream_status === "pending_review",
      30000,
    );
    const apEmptyClar = await json("POST", "/dreams/approve", {});
    assert(apEmptyClar.status === 200 && apEmptyClar.data.empty_patches === true, "empty_patches approve");
    const emptyHist = join(TEST_HOME, "memories/clarify/history", `${emptyAsideId}.md`);
    assert(
      await access(emptyHist).then(() => true).catch(() => false),
      "empty_patches still archives clarify pending",
    );

    console.log("\n✅ All self-checks passed (through 0.37)");
  } finally {
    await stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
