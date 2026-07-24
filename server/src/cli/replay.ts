/**
 * Day-by-day time replay: set virtual clock → capture fixture events → dream → approve.
 *
 * Prerequisites:
 *   - Server running with ENGRAM_ALLOW_VIRTUAL_CLOCK=1
 *   - Prefer a dedicated ENGRAM_HOME (reset before long runs)
 *
 * Usage:
 *   bun run replay -- --fixture=fixtures/replay-sample.jsonl
 *   bun run replay -- --fixture=path.jsonl --pause
 *   bun run replay -- --fixture=path.jsonl --dream-at=22:00:00
 *   bun run replay -- --fixture=path.jsonl --dream-next-day
 *   bun run replay -- --fixture=path.jsonl --base-url=http://127.0.0.1:8787
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as readline from "node:readline";

interface FixtureEvent {
  ts: string;
  raw: string;
  source?: string;
  node_refs?: string[];
}

interface DayBucket {
  day: string;
  events: FixtureEvent[];
}

function usage(): never {
  console.error(`Usage: bun run replay -- --fixture=<path.jsonl> [options]

Options:
  --fixture=PATH       JSONL of { "ts", "raw", "source?", "node_refs?" }
  --base-url=URL       Engram API (default http://127.0.0.1:8787)
  --dream-at=HH:mm:ss  Dream time on the event day (default 23:30:00)
  --dream-next-day     Dream at next calendar day 00:30:00 instead
  --pause              After each dream, wait for Enter (approve if still pending)
`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let fixture: string | null = null;
  let baseUrl = "http://127.0.0.1:8787";
  let dreamAt = "23:30:00";
  let dreamNextDay = false;
  let pause = false;

  for (const a of argv) {
    if (a === "--help" || a === "-h") usage();
    if (a.startsWith("--fixture=")) fixture = a.slice("--fixture=".length);
    else if (a.startsWith("--base-url=")) baseUrl = a.slice("--base-url=".length).replace(/\/$/, "");
    else if (a.startsWith("--dream-at=")) dreamAt = a.slice("--dream-at=".length);
    else if (a === "--dream-next-day") dreamNextDay = true;
    else if (a === "--pause") pause = true;
    else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      usage();
    }
  }

  if (!fixture) usage();
  if (!/^\d{2}:\d{2}:\d{2}$/.test(dreamAt)) {
    console.error("--dream-at must be HH:mm:ss");
    process.exit(1);
  }

  return { fixture: resolve(fixture!), baseUrl, dreamAt, dreamNextDay, pause };
}

async function api(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

function calendarDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function parseFixture(path: string): Promise<FixtureEvent[]> {
  const text = await readFile(path, "utf8");
  const events: FixtureEvent[] = [];
  for (const [i, line] of text.split("\n").entries()) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(t);
    } catch {
      throw new Error(`fixture line ${i + 1}: invalid JSON`);
    }
    if (!obj || typeof obj !== "object") {
      throw new Error(`fixture line ${i + 1}: expected object`);
    }
    const rec = obj as Record<string, unknown>;
    if (typeof rec.ts !== "string" || !rec.ts.trim()) {
      throw new Error(`fixture line ${i + 1}: ts required`);
    }
    if (typeof rec.raw !== "string" || !rec.raw.trim()) {
      throw new Error(`fixture line ${i + 1}: raw required`);
    }
    if (Number.isNaN(new Date(rec.ts).getTime())) {
      throw new Error(`fixture line ${i + 1}: invalid ts`);
    }
    events.push({
      ts: rec.ts.trim(),
      raw: rec.raw,
      source: typeof rec.source === "string" ? rec.source : undefined,
      node_refs: Array.isArray(rec.node_refs)
        ? rec.node_refs.filter((x): x is string => typeof x === "string")
        : undefined,
    });
  }
  if (events.length === 0) throw new Error("fixture has no events");
  return events;
}

function groupByDay(events: FixtureEvent[], timeZone: string): DayBucket[] {
  const map = new Map<string, FixtureEvent[]>();
  for (const e of events) {
    const day = calendarDay(e.ts, timeZone);
    const list = map.get(day) ?? [];
    list.push(e);
    map.set(day, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, evs]) => ({ day, events: evs }));
}

async function waitForDreamPending(
  baseUrl: string,
  timeoutMs = 600_000,
): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await api(baseUrl, "GET", "/status");
    if (st.status !== 200) {
      throw new Error(`status ${st.status}: ${JSON.stringify(st.data)}`);
    }
    const dreamStatus = st.data.dream_status;
    const job = st.data.dream_job as Record<string, unknown> | null;
    if (dreamStatus === "pending_review") return st.data;
    if (job && job.status === "failed") {
      throw new Error(`dream failed: ${JSON.stringify(job.error ?? job)}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("timeout waiting for pending_review");
}

function promptEnter(msg: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolveDone) => {
    rl.question(msg, () => {
      rl.close();
      resolveDone();
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const events = await parseFixture(opts.fixture);

  const clock0 = await api(opts.baseUrl, "GET", "/clock");
  if (clock0.status !== 200) {
    throw new Error(`Cannot reach Engram at ${opts.baseUrl} (GET /clock → ${clock0.status})`);
  }
  if (!clock0.data.allow_set) {
    throw new Error(
      "Server has allow_set=false. Restart with ENGRAM_ALLOW_VIRTUAL_CLOCK=1",
    );
  }
  const timeZone = String(clock0.data.timezone ?? "Asia/Hong_Kong");

  const days = groupByDay(events, timeZone);
  console.log(
    `Replay: ${events.length} events across ${days.length} day(s); timezone=${timeZone}`,
  );
  console.log(
    `Dream policy: ${opts.dreamNextDay ? "next day 00:30:00" : `same day ${opts.dreamAt}`}` +
      (opts.pause ? "; pause between days" : "; auto-approve"),
  );

  for (const bucket of days) {
    console.log(`\n=== ${bucket.day} (${bucket.events.length} event(s)) ===`);

    for (const ev of bucket.events) {
      const set = await api(opts.baseUrl, "PUT", "/clock", { now: ev.ts });
      if (set.status !== 200) {
        throw new Error(`PUT /clock failed: ${JSON.stringify(set.data)}`);
      }
      const cap = await api(opts.baseUrl, "POST", "/capture", {
        raw: ev.raw,
        source: ev.source ?? "replay",
        node_refs: ev.node_refs,
      });
      if (cap.status !== 201) {
        throw new Error(`POST /capture failed: ${JSON.stringify(cap.data)}`);
      }
      console.log(`  capture ${cap.data.event_id} @ ${ev.ts}`);
    }

    const dreamDay = opts.dreamNextDay ? addDays(bucket.day, 1) : bucket.day;
    const dreamTime = opts.dreamNextDay ? "00:30:00" : opts.dreamAt;
    const clockDream = await api(opts.baseUrl, "PUT", "/clock", {
      day: dreamDay,
      time: dreamTime,
    });
    if (clockDream.status !== 200) {
      throw new Error(`PUT /clock (dream) failed: ${JSON.stringify(clockDream.data)}`);
    }
    console.log(`  clock → ${clockDream.data.now} (dream)`);

    const run = await api(opts.baseUrl, "POST", "/dream/run");
    if (run.status !== 202 && run.status !== 200) {
      throw new Error(`POST /dream/run failed: ${JSON.stringify(run.data)}`);
    }
    console.log(`  dream submitted (${run.data.job_id ?? run.data.dream_run_id ?? "ok"})`);

    const pending = await waitForDreamPending(opts.baseUrl);
    const pendingSummary = pending.dream_pending as { dream_run_id?: string } | null;
    console.log(`  pending_review ${pendingSummary?.dream_run_id ?? ""}`);

    if (opts.pause) {
      await promptEnter(
        "  Review pending dream (approve/discard via API or UI), then press Enter… ",
      );
      const st = await api(opts.baseUrl, "GET", "/status");
      if (st.data.dream_status === "pending_review") {
        const ap = await api(opts.baseUrl, "POST", "/dream/approve");
        if (ap.status !== 200) {
          throw new Error(`POST /dream/approve failed: ${JSON.stringify(ap.data)}`);
        }
        console.log("  approved (was still pending)");
      } else {
        console.log(`  skipped approve (dream_status=${st.data.dream_status})`);
      }
    } else {
      const ap = await api(opts.baseUrl, "POST", "/dream/approve");
      if (ap.status !== 200) {
        throw new Error(`POST /dream/approve failed: ${JSON.stringify(ap.data)}`);
      }
      console.log("  approved");
    }
  }

  console.log("\nReplay complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
