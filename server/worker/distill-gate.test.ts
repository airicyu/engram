import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dayToWeekId, weekMonthKey } from "../chain/time.ts";
import { distillGaps, snapshotDistill } from "./distill-gate.ts";

const today = "2026-10-31";

async function memories(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "engram-gate-"));
  const mem = join(root, "memories");
  await mkdir(join(mem, "pool"), { recursive: true });
  await mkdir(join(mem, "clarify", "pending"), { recursive: true });
  await mkdir(join(mem, "clarify", "history"), { recursive: true });
  await mkdir(join(mem, "chain", "days", "2026-10"), { recursive: true });
  await mkdir(join(mem, "chain", "weeks", "2026-10"), { recursive: true });
  return mem;
}

test("closed week touched this run requires a newer week file", async () => {
  const mem = await memories();
  try {
    expect(dayToWeekId("2026-10-19")).toBe("2026-W43-1019");
    const before = await snapshotDistill(mem);
    const day = join(mem, "chain", "days", "2026-10", "2026-10-19.md");
    await writeFile(day, "## 一事\n\n正文。\n");
    await utimes(day, new Date(2_000), new Date(2_000));
    const missing = await distillGaps(mem, before, today);
    expect(missing.some((g) => g.kind === "week" && g.weekId === "2026-W43-1019")).toBe(true);

    const week = join(mem, "chain", "weeks", "2026-10", "2026-W43-1019.md");
    await writeFile(week, "## 一週\n\n正文。\n");
    await utimes(week, new Date(3_000), new Date(3_000));
    const done = await distillGaps(mem, before, today);
    expect(done.some((g) => g.kind === "week")).toBe(false);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("open week and untouched closed-week days are not gaps", async () => {
  const mem = await memories();
  try {
    const day = join(mem, "chain", "days", "2026-10", "2026-10-26.md");
    await writeFile(day, "## 一事\n\n正文。\n");
    const before = await snapshotDistill(mem);
    const gaps = await distillGaps(mem, before, today);
    expect(gaps.filter((g) => g.kind === "week")).toEqual([]);

    const closed = join(mem, "chain", "days", "2026-10", "2026-10-19.md");
    await writeFile(closed, "## 舊日\n\n正文。\n");
    await utimes(closed, new Date(1_000), new Date(1_000));
    const seen = await snapshotDistill(mem);
    const later = await distillGaps(mem, seen, today);
    expect(later.filter((g) => g.kind === "week")).toEqual([]);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("closed month touched via a week requires a newer month file", async () => {
  const mem = await memories();
  const later = "2026-11-08";
  try {
    await mkdir(join(mem, "chain", "days", "2026-11"), { recursive: true });
    await mkdir(join(mem, "chain", "months", "2026"), { recursive: true });
    const before = await snapshotDistill(mem);
    const day = join(mem, "chain", "days", "2026-11", "2026-11-01.md");
    await writeFile(day, "## 一日\n\n正文。\n");
    await utimes(day, new Date(2_000), new Date(2_000));
    const week = join(mem, "chain", "weeks", "2026-10", "2026-W44-1026.md");
    await writeFile(week, "## 一週\n\n正文。\n");
    await utimes(week, new Date(3_000), new Date(3_000));

    const missing = await distillGaps(mem, before, later);
    expect(missing.some((g) => g.kind === "week")).toBe(false);
    expect(missing.some((g) => g.kind === "month" && g.monthId === "2026-10")).toBe(true);
    expect(missing.some((g) => g.kind === "month" && g.monthId === "2026-11")).toBe(false);

    const month = join(mem, "chain", "months", "2026", "2026-10.md");
    await writeFile(month, "## 十月\n\n正文。\n");
    await utimes(month, new Date(4_000), new Date(4_000));
    const done = await distillGaps(mem, before, later);
    expect(done.filter((g) => g.kind === "month")).toEqual([]);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("closed year touched this run requires a newer year file", async () => {
  const mem = await memories();
  const later = "2027-01-02";
  try {
    await mkdir(join(mem, "chain", "days", "2026-12"), { recursive: true });
    await mkdir(join(mem, "chain", "months", "2026"), { recursive: true });
    await mkdir(join(mem, "chain", "years"), { recursive: true });
    const before = await snapshotDistill(mem);
    const dayId = "2026-12-28";
    const day = join(mem, "chain", "days", "2026-12", `${dayId}.md`);
    await writeFile(day, "## 一日\n\n正文。\n");
    await utimes(day, new Date(2_000), new Date(2_000));
    const weekId = dayToWeekId(dayId);
    await mkdir(join(mem, "chain", "weeks", weekMonthKey(weekId)), { recursive: true });
    const week = join(mem, "chain", "weeks", weekMonthKey(weekId), `${weekId}.md`);
    await writeFile(week, "## 一週\n\n正文。\n");
    await utimes(week, new Date(3_000), new Date(3_000));
    const month = join(mem, "chain", "months", "2026", "2026-12.md");
    await writeFile(month, "## 十二月\n\n正文。\n");
    await utimes(month, new Date(4_000), new Date(4_000));

    const missing = await distillGaps(mem, before, later);
    expect(missing.some((g) => g.kind === "month")).toBe(false);
    expect(missing.some((g) => g.kind === "year" && g.yearId === "2026")).toBe(true);
    expect(missing.some((g) => g.kind === "year" && g.yearId === "2027")).toBe(false);

    const year = join(mem, "chain", "years", "2026.md");
    await writeFile(year, "## 一年\n\n正文。\n");
    await utimes(year, new Date(5_000), new Date(5_000));
    const done = await distillGaps(mem, before, later);
    expect(done.filter((g) => g.kind === "year")).toEqual([]);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("starting pool lines and clarify files must leave pending", async () => {
  const mem = await memories();
  try {
    const line = JSON.stringify({ id: "evt_test", raw: "一件事" });
    await writeFile(join(mem, "pool", "pending.jsonl"), `${line}\n`);
    await writeFile(join(mem, "clarify", "pending", "cla_test.md"), "---\nid: cla_test\n---\n\n問？\n");
    const before = await snapshotDistill(mem);

    const stuck = await distillGaps(mem, before, today);
    expect(stuck.map((g) => g.kind).sort()).toEqual(["clarify", "pool"]);

    await writeFile(join(mem, "pool", "pending.jsonl"), "");
    await writeFile(join(mem, "pool", "archived.jsonl"), `${line}\n`);
    await writeFile(
      join(mem, "clarify", "history", "cla_test.md"),
      "---\nid: cla_test\nabsorbed_at: 2026-10-31T12:00:00+08:00\n---\n\n問？\n",
    );
    await rm(join(mem, "clarify", "pending", "cla_test.md"));
    const done = await distillGaps(mem, before, today);
    expect(done).toEqual([]);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("only the pre-run pending id needs exactly one history marker", async () => {
  const mem = await memories();
  try {
    await writeFile(join(mem, "clarify", "pending", "cla_pending.md"), "---\nid: cla_pending\n---\n\n問？\n");
    await writeFile(
      join(mem, "clarify", "history", "cla_deleted.md"),
      "---\nid: cla_deleted\ndismissed: true\n---\n\n舊題。\n",
    );
    const before = await snapshotDistill(mem);

    const stillPending = await distillGaps(mem, before, today);
    expect(stillPending.some((g) => g.kind === "clarify" && g.id === "cla_pending")).toBe(true);

    const history = join(mem, "clarify", "history", "cla_pending.md");
    await writeFile(history, "---\nid: cla_pending\n---\n\n問？\n");
    await rm(join(mem, "clarify", "pending", "cla_pending.md"));
    const neither = await distillGaps(mem, before, today);
    expect(neither.some((g) => g.kind === "clarify")).toBe(true);

    await writeFile(
      history,
      "---\nid: cla_pending\nabsorbed_at: 2026-10-31T12:00:00+08:00\ndismissed_because: no fact\n---\n\n問？\n",
    );
    const both = await distillGaps(mem, before, today);
    expect(both.some((g) => g.kind === "clarify")).toBe(true);

    await writeFile(
      history,
      "---\nid: cla_pending\ndismissed_because: '  '\n---\n\n問？\n",
    );
    const blank = await distillGaps(mem, before, today);
    expect(blank.some((g) => g.kind === "clarify")).toBe(true);

    await writeFile(
      history,
      "---\nid: cla_pending\ndismissed_because: no fact\n---\n\n問？\n",
    );
    const dismissed = await distillGaps(mem, before, today);
    expect(dismissed.filter((g) => g.kind === "clarify")).toEqual([]);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("an expired future-sight item is a gap until its end is today or later", async () => {
  const mem = await memories();
  try {
    await mkdir(join(mem, "future-sight"), { recursive: true });
    const zone = join(mem, "future-sight", "upcoming.md");
    await writeFile(
      zone,
      "---\nzone: upcoming\nupdated_at: 2026-01-01T00:00:00+08:00\n---\n\n## fs-past\n```yaml\nanchor_start: 2026-01-01\nanchor_end: 2026-01-02\nkind: dated\n```\n\n虛構過期。\n",
    );
    await writeFile(
      join(mem, "future-sight", "longTerm.md"),
      "---\nzone: longTerm\nupdated_at: 2026-01-01T00:00:00+08:00\n---\n",
    );
    const before = await snapshotDistill(mem);
    const expired = await distillGaps(mem, before, today);
    expect(expired.some((g) => g.kind === "future" && g.id === "fs-past")).toBe(true);

    await writeFile(
      zone,
      "---\nzone: upcoming\nupdated_at: 2026-10-31T00:00:00+08:00\n---\n\n## fs-past\n```yaml\nanchor_start: 2026-10-31\nanchor_end: 2026-10-31\nkind: dated\n```\n\n改期到今天。\n",
    );
    const current = await distillGaps(mem, before, today);
    expect(current.filter((g) => g.kind === "future")).toEqual([]);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("open week touched this run requires a newer file with open: true", async () => {
  const mem = await memories();
  try {
    const before = await snapshotDistill(mem);
    const day = join(mem, "chain", "days", "2026-10", "2026-10-28.md");
    await writeFile(day, "## 一事\n\n正文。\n");
    await utimes(day, new Date(2_000), new Date(2_000));
    const weekId = dayToWeekId("2026-10-28");
    const missing = await distillGaps(mem, before, today);
    expect(missing.some((g) => g.kind === "week" && g.open && g.weekId === weekId)).toBe(true);

    const week = join(mem, "chain", "weeks", weekMonthKey(weekId), `${weekId}.md`);
    await mkdir(join(mem, "chain", "weeks", weekMonthKey(weekId)), { recursive: true });
    await writeFile(week, "## 一週\n\n正文。\n");
    await utimes(week, new Date(3_000), new Date(3_000));
    const unmarked = await distillGaps(mem, before, today);
    expect(unmarked.some((g) => g.kind === "week" && g.weekId === weekId)).toBe(true);

    await writeFile(week, "---\nopen: true\n---\n## 一週\n\n本週至今。\n");
    await utimes(week, new Date(4_000), new Date(4_000));
    const done = await distillGaps(mem, before, today);
    expect(done.some((g) => g.kind === "week")).toBe(false);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});

test("closed week that still has open: true stays a gap", async () => {
  const mem = await memories();
  try {
    const before = await snapshotDistill(mem);
    const day = join(mem, "chain", "days", "2026-10", "2026-10-19.md");
    await writeFile(day, "## 一事\n\n正文。\n");
    await utimes(day, new Date(2_000), new Date(2_000));
    const weekId = "2026-W43-1019";
    const week = join(mem, "chain", "weeks", "2026-10", `${weekId}.md`);
    await writeFile(week, "---\nopen: true\n---\n## 一週\n\n至今。\n");
    await utimes(week, new Date(3_000), new Date(3_000));
    const missing = await distillGaps(mem, before, today);
    expect(missing.some((g) => g.kind === "week" && g.weekId === weekId && g.open === false)).toBe(true);

    await writeFile(week, "## 一週\n\n收成。\n");
    await utimes(week, new Date(4_000), new Date(4_000));
    const done = await distillGaps(mem, before, today);
    expect(done.some((g) => g.kind === "week")).toBe(false);
  } finally {
    await rm(join(mem, ".."), { recursive: true, force: true });
  }
});
