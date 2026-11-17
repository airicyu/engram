# Code design principles

How a change under `server/` or `web/` is designed, split, and grouped. An INDEX overrides this file when it names the rule it replaces. Vault shape is [`data-spec.md`](data-spec.md). Standing bans (skills own judgment, no dream/approve) are in [`AGENTS.md`](../AGENTS.md) and [`roadmap/GUIDELINES.md`](roadmap/GUIDELINES.md).

## 1. Smallest design

Smallest design applies only when section 2 and the architecture bans are already satisfied. Make the smallest change that meets the contract: one straight path a reader can maintain.

- Do not add a layer, mode, fallback, or framework the INDEX did not ask for.
- Do not walk records one by one when one pass does the same work.
- Do not build the next case early. Add it when a contract asks for it.
- Do not shrink a privacy fix or an architecture ban to keep the diff small.

## 2. Untrusted input

Page text, uploaded bytes, query strings, and model output are untrusted. Memory files are private.

- Do not concatenate that input into HTML, a script, a URL, or a shell command. Do not assign it to `innerHTML`, or pass it through `eval` or `Function`.
- Paths stay inside the store. Reject `..`, absolute paths, and symlink escapes. Attachment writes keep the existing MIME and size checks.
- Do not copy vault prose into logs, tests, demos, or docs. That rule is the privacy section in [`AGENTS.md`](../AGENTS.md).

## 3. One responsibility

A file does one thing a reader can name in a sentence. The neighboring step (the route, the disk write, the skill) is a different file.

- Do not grow a file so that one comment has to say "and".
- Do not split one responsibility into one file per function.
- Tests sit next to the module they exercise, or under `server/test/` when that is where this repo already keeps them. Do not invent a second test root.

## 4. File header

A new `.ts` file under `server/`, and a `.js` file under `web/` that you create, starts with an English block comment: one responsibility, in sentences, not a bullet list or a method catalog. At most 150 words. If you edit a file that has no header, add the header in that change. Do not stop a version to header every old file.

## 5. When to split

Count code lines only. Blank lines and full-line comments do not count.

- If one change touches a `.ts`, `.js`, or `.css` file over **400** code lines, review whether to split it. New files from that split stay under 400. The review does not by itself schedule the split.
- A split does not change behavior, routes, or on-disk names unless the INDEX says so.
- Do not split a large file in the same change that moves it to another folder.

## 6. Folders

A folder is a module boundary.

- `server/` is the process. `web/` is the static UI. Do not add a `features/` tree that holds both.
- Group by what changes together (`server/nodes/`, `server/future-sight/`). Do not add `utils/`, `helpers/`, or `types/` as the primary cut. A type lives with the module that owns the value.
- A helper used by one area stays in that area.
- CSS and copy are catalogs. `web/style.css` and `web/i18n.js` stay searchable files. Do not scatter them beside each hash route unless those classes belong to one component alone.

## 7. What a change may mix

A single change is one of these, not several:

- A behavior change the INDEX describes.
- A file split (same folder, same names, smaller files).
- A folder move (same files, new paths, imports updated).

The skill-versus-server ban still applies. A layout change does not move judgment into the server.
