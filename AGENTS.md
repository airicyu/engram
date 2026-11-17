# Engram — agent guide

This repo is **Engram**, a personal memory prototype. **Skills write the vault.** The Bun server and static UI only read files, do mechanical writes, and dispatch jobs. You can run skills with **pi-agent** from the repo root without starting the server.

The repo stands alone. Do not depend on another product repo. There is **no** dream staging, approve/discard, activities/short-term split, or in-process cron.

Current shipped version: [`version.md`](version.md) (**0.7.0**). Unscheduled ideas: [`docs/roadmap/backlog/INDEX.md`](docs/roadmap/backlog/INDEX.md). Deliver one version with [`.agents/skills/roadmap-version/SKILL.md`](.agents/skills/roadmap-version/SKILL.md).

## Language

**Replies to the user are Traditional Chinese written prose.** Proper names, paths, APIs, and file names stay in English.

**Documents default to English** unless the user says otherwise, or a spec already requires another language. That includes `INDEX.md`, `reasoning.md`, `how.md`, `HANDOFF.md`, review reports, and other roadmap prose. Identifiers, paths, commands, JSON keys, and enums are English.

Roadmap prose already written (through the open version) stays as it was written. Do not rewrite it only to change language.

Memory text language is `memory_language` in `workspace.yaml`, default `zh-Hant`. Timezone is `workspace.yaml`, then `ENGRAM_TZ`, then `Asia/Hong_Kong`.

---

## Repo layout (intent)

| Path | Role |
|------|------|
| [`.agents/skills/`](.agents/skills/) | Pi skills that write or read the vault |
| [`server/`](server/) | Optional Bun server: read, mechanical write, 202 dispatch |
| [`web/`](web/) | Static UI (hash routes). No React, no Vite |
| [`docs/data-spec.md`](docs/data-spec.md) | Vault contract |
| [`docs/api.md`](docs/api.md) | HTTP contract |
| [`docs/architecture/orchestration.md`](docs/architecture/orchestration.md) | Why a control-plane pipeline is in the program |
| [`docs/code-design-principles.md`](docs/code-design-principles.md) | File size, headers, folder cuts for `server/` and `web/` |
| [`docs/roadmap/`](docs/roadmap/GUIDELINES.md) | Version contracts |
| [`changelog.md`](changelog.md) / [`version.md`](version.md) | Ship log and current shipped version |
| `{store}/memories/` | Vault (Obsidian opens this). Default store `./demo-engram-data` via `ENGRAM_STORE_DIR` |

| Vault path | Role |
|------------|------|
| `memories/pool/pending.jsonl` | Events not yet distilled (`archived.jsonl` after) |
| `memories/clarify/{asking,pending,history}/` | Clarify questions, answers, absorbed |
| `memories/chain/days\|weeks\|months\|years/` | Day / week / month / year narrative |
| `memories/nodes/{id}/{id}.md` | One understanding file per subject. Optional frontmatter `aliases:` |
| `memories/_attachments/uploads/{day}/` | Images, written straight to the final directory |
| `memories/future-sight/upcoming.md`, `longTerm.md` | Future-sight zones |
| `{store}/jobs/` | Dispatch state. Not in the vault. Store git ignores it |

---

## What to read first

| Situation | Read |
|-----------|------|
| Implementing a scheduled version | That version's `docs/roadmap/X.Y.Z/INDEX.md` and its links. Follow [`docs/roadmap/GUIDELINES.md`](docs/roadmap/GUIDELINES.md) and [`docs/roadmap/agent-workflow.md`](docs/roadmap/agent-workflow.md) |
| User names a version or `/roadmap-version` | [`.agents/skills/roadmap-version/SKILL.md`](.agents/skills/roadmap-version/SKILL.md) |
| How a memory file is shaped | [`docs/data-spec.md`](docs/data-spec.md) |
| HTTP | [`docs/api.md`](docs/api.md) |
| Why distill then clarify-generate is two sessions | [`docs/architecture/orchestration.md`](docs/architecture/orchestration.md) |
| How to split a server or UI file | [`docs/code-design-principles.md`](docs/code-design-principles.md) |

**Priority:** a version INDEX decision > GUIDELINES architecture bans > [`docs/code-design-principles.md`](docs/code-design-principles.md) (privacy and path checks, then smallest design, then file layout) > [`docs/data-spec.md`](docs/data-spec.md) and [`docs/api.md`](docs/api.md).

---

## Architecture rules

These hold until an INDEX explicitly replaces one.

1. **Judgment stays in skills.** The server only does control plane: step order, locks, job/202, flags, mechanical I/O (read, append, move, path/MIME checks). It does not classify how to write a diary, whether to open a node, what clarify question to ask, or prose style.
2. **Thin pipeline is allowed.** `POST` → job → skill is fine. Putting "how memory understands the world" into TypeScript is not.
3. **A fixed pipeline needs its own note** (order, why those steps are in the program, what the program must not decide). Authority: [`docs/architecture/orchestration.md`](docs/architecture/orchestration.md).
4. **No** dream staging, approve/discard, or dream report. Store git is local-only, commits only after a successful server-listed write, and never pushes. A skill run straight from pi-agent does **not** auto-commit.
5. **Distill gate.** Day is required. Week / month / year are written only when that period has ended, or the user explicitly asks this run. Do not edit an open week, month, or year.
6. **Nodes.** Do not merge two nodes by name similarity. Merge and delete only when the user names the ids, via `engram-node`. Do not maintain `activity_score` in distill.
7. **UI** stays static files under `web/`. Do not add React or Vite.

### Privacy (hard)

Real personal memory is a runtime store only (gitignored or outside the repo). Tests use `mkdtemp` or another isolated path. `demo-engram-data/` may contain only obviously fictional people and plots.

Do not copy a real vault into tests, demos, fixtures, or roadmap prose. If demo data is identifiable as a real person, clear it and report that. This is an incident, not a style nit.

### Skills

| Skill | Role |
|-------|------|
| `engram-ingest` | Pi-agent turns speech into pending events. UI / `POST /events` does not use this skill and does not create clarify questions |
| `engram-distill` | Absorb `clarify/pending/`, write chain and nodes, archive the pool. Does **not** write `asking` |
| `engram-clarify-generate` | Second distill session: create 3–5 questions in `clarify/asking/` (skip if nothing was distilled) |
| `engram-ask` | Read chain, pending, and future-sight. Read one node file only when the question names it |
| `engram-node` | Merge or delete a node the user named, and rewrite wikilinks. No UI, no HTTP |
| `engram-reset` | Empty the store after confirmation. Runs the skill script |

Chain: first line is a `##` subject title; life-line prose in full sentences. Week, month, and year files select; they are not a bound volume of the days.

### Server (optional)

`bun run dev` → `127.0.0.1` and `ENGRAM_PORT` (else `8797`).

- Sync reads: `GET /search`, `/clarify/*`, `/nodes/graph`, `/attachments/file`, chain, nodes, pool, jobs.
- Mechanical writes: `POST /events`, `POST /attachments`, clarify submit / delete / aside.
- 202 dispatch: `POST /distill` and `POST /ask`.

No in-process cron. A system crontab may `POST /distill`. Pi model for the server SDK: `ENGRAM_PI_MODEL` / `PI_MODEL`, then `workspace.yaml` `pi_model`, then `deepseek/deepseek-v4.1-flash`. That does not change the interactive `pi` CLI.

UI hashes: `#/events` `#/seek` `#/clarify` `#/memory`.

---

## Working habits

- **Do not commit unless the user asks.** **Do not push unless the user asks.**
- Anything discussed in chat but not written into the roadmap or a contract file **does not exist** for the next agent.
- When a contract changes, update `docs/data-spec.md` and `docs/api.md` in the same work. Change `version.md` and `changelog.md` only when that version ships.
- Do not reset a real `ENGRAM_STORE_DIR` unless the user asks.

### Cutting a version

`version.md` is the latest **shipped** version. A version's status (`planned`, `in progress`, `shipped`) lives on that version's INDEX.

A version proceeds by writing the INDEX, then changing code. While that happens the INDEX is `in progress`. Only after the user explicitly says ship: set that INDEX to `shipped`, set `version.md`, and add the changelog section. Do not mark shipped, and do not delete the backlog file, unless the user says ship.

If the previous version is not `shipped`, do not open a new version. This is a soft rule: remind the user, do not hard-block. If they still want it opened, open it.

While a version is `in progress`, further work for that effort goes into that INDEX. Do not open the next version number for it.

---

## Links

| Doc | Use |
|-----|-----|
| [README.md](README.md) | Project home |
| [docs/data-spec.md](docs/data-spec.md) | Vault shape |
| [docs/api.md](docs/api.md) | HTTP |
| [docs/architecture/orchestration.md](docs/architecture/orchestration.md) | Control plane vs skill |
| [docs/code-design-principles.md](docs/code-design-principles.md) | How server and UI source is split |
| [docs/roadmap/GUIDELINES.md](docs/roadmap/GUIDELINES.md) | How to write a version contract |
| [docs/roadmap/agent-workflow.md](docs/roadmap/agent-workflow.md) | Review gates and Track flow |
| [docs/roadmap/backlog/INDEX.md](docs/roadmap/backlog/INDEX.md) | Unscheduled ideas |
| [changelog.md](changelog.md) | Shipped summary |
| [version.md](version.md) | Current shipped version |
