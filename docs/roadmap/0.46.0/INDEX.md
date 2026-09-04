# 0.46.0 — Support Pi agent CLI

← [changelog](../../../changelog.md) · 上游：[0.45.0](../0.45.0/INDEX.md)（in progress；本版與之正交）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**（2026-09-05）  
> 第四個 live agent：`ENGRAM_AGENT=pi`（npm 套件 `@earendil-works/pi-coding-agent`，可執行檔 **`pi`**，俗稱 pi-agent）。寫入圍籬對齊 0.20 write-policy（禁 bash、只開 read／edit／write 類工具）。**無** store migrate、**不**改 HTTP 動詞／UI、boot 仍 ≥ **0.40**。**預設仍 `claude`。**  
> **開工前仍須拍板：無。**

## 產品句

> 使用者可把 Dream／Ask／Rollup／Clarify 的 agent CLI 設成 **Pi**（與 Claude Code、Cursor CLI、Codex CLI 並列）；approve 前仍不可寫 live `memories/**`。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作交接 |
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/pi-provider.md](./docs/pi-provider.md) | argv、工具 allowlist、與 Claude／Cursor／Codex 對照 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何禁 bash、不傳 `--model`、mode 名為 `pi` |

對照：[0.23 Codex](../0.23.0/INDEX.md) · [0.20 AgentInvoker](../0.20.0/INDEX.md)

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | Mode | `ENGRAM_AGENT=pi`（workspace `agent: pi`）。**禁止**另立 `pi-agent` 別名（非法 mode 仍啟動失敗）。文件可用「Pi／pi-agent」當產品名，契約值只有 `pi`。 |
| 2 | Binary | `PI_BIN`／workspace `pi_bin` → 預設 `pi`（PATH 上的可執行檔）。 |
| 3 | 非互動 | 一律 `pi -p`（對齊 `claude -p`／Cursor `-p`）。Prompt 以 `--` 之後的單一參數傳入，避免以 `-` 開頭的 prompt 被當成旗標。 |
| 4 | 工具圍籬 | `--tools read,grep,find,ls,edit,write`。**禁止**列入 `bash`／`powershell`。**不要**用「全開再 `--exclude-tools bash`」當唯一圍籬（擴充套件可能再註冊 shell）。 |
| 5 | 隔離旗標 | 每次 spawn **必帶**：`--no-session`、`--no-context-files`、`--no-extensions`、`--no-skills`、`--no-prompt-templates`、`--no-approve`。用意：不寫 `~/.pi` session、不讀 store 內 AGENTS.md／CLAUDE.md、不載入使用者全域 extension／skill（避免繞過工具 allowlist）。 |
| 6 | 模型 | **不**傳 `--provider`／`--model`／`--api-key`。用使用者本機 `~/.pi/agent/settings.json` 與既有 env（如 `OPENROUTER_API_KEY`）。Engram 不替 Pi 選模型。 |
| 7 | stdout | 交付真相仍是磁碟 `requireFiles`（0.20）。`--mode` 維持預設 text；**不要**解析 json event stream 當答案。 |
| 8 | cwd | 沿用既有 `AgentJob.cwd`（Ask＝jobDir；dream／clarify／rollup＝既有 temp workdir）。Pi **沒有** `--add-dir`／`--cd`：Read live store 靠 prompt 內絕對路徑（與 Codex 相同假設）。Clarify generate 的 `addStoreDir: false` 對 Pi **無額外 argv**（本來就沒有 store add-dir）。 |
| 9 | 系統提示圍籬 | `--append-system-prompt` 附一段**機械**英文短文：列出 `writePolicy.writableRoots`，並寫明不得寫 `{storeDir}/memories`。**不要**改 `server/prompts/*` 業務稿。 |
| 10 | CLI 知識位置 | **僅** `server/src/agent/providers/pi.ts`；`factory.ts` 把 `pi` 與 `claude`／`cursor`／`codex` 並列（dream／ask／rollup／clarify distill／generate）。 |
| 11 | Store／HTTP | **不** bump `store_version`；無記憶契約變更；無新端點。 |
| 12 | Setup | setup-wizard 第四選項「Pi CLI」→ 寫入 `ENGRAM_AGENT=pi`。 |
| 13 | PATH | Server 進程必須能 `exec` 到 `pi`（其 shebang 為 `#!/usr/bin/env node`，故 **node 也須在同一 PATH**）。Engram **不**包 nvm／不改 shebang。文件一句即可。 |

---

## 非目標

- 把 Pi 設成預設 agent
- 為 Pi 特製 dream／ask／rollup prompt 或改業務交付契約
- 在 Engram 設定裡選 OpenRouter 模型／thinking level
- CI／phases **強制**本機已安裝並登入 Pi（單測只驗 argv／config）
- Node merge、新 HTTP、store migrate、抬 boot
- 實作 OS sandbox／path-scoped Edit（Pi 0.85 無 Claude 式 `Edit(//path/**)`）

---

## 實作軌道

### Track A — PiInvoker＋config＋factory

- **做：** `PiInvoker`＋`buildPiCmd`；`AGENT_MODES` 加 `pi`；`piBin`；factory 五處 live switch 加 `pi`。
- **不要：** 在 ask／dream／rollup 業務檔複製 argv；傳 `--model`。
- **驗收：** `ENGRAM_AGENT=pi` → invoker 為 `PiInvoker`；cmd 含 `-p`、`--tools` 無 bash、含 `--no-session`；prompt 在 `--` 之後。

### Track B — Setup＋文件＋出貨戳記

- **做：** wizard 選項；`.env.example`；`docs/configurations.md`；api-docs；README／server README；AGENTS 技術棧一句與版本脈絡；`version.md`／`changelog.md`。
- **不要：** 無關 UI 重構。
- **驗收：** 文件列出 `pi`；wizard 可寫 `.env`。

---

## 驗收

- [x] `ENGRAM_AGENT=pi` → `createAgentInvoker()` 為 `PiInvoker`；`pi-agent` 等非法字串啟動失敗
- [x] `buildPiCmd`：含 `-p`、`--tools`＝`read,grep,find,ls,edit,write`、**不含** `bash`／`powershell`；含定案第 5 列全部旗標；`--` 後為 prompt
- [x] **不**含 `--provider`／`--model`
- [x] `--append-system-prompt` 字串含每個 writable root，且含 store 的 `memories` 路徑或明確「do not write …/memories」
- [x] setup-wizard 可選 Pi 並寫入 `ENGRAM_AGENT=pi`
- [x] `bun test`：`pi.test.ts`＋config `ENGRAM_AGENT=pi`；既有 mock 路徑不回歸
- [x] `cd server && bun run test:phases` 全綠（仍走 mock，不呼叫真實 `pi`）
- [x] version／changelog／API／configurations 已列 `pi`；本 INDEX → **shipped**；**無** migrate

---

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `server/src/agent/providers/claude.ts`／`codex.ts` | Invoker 風格對照 |
| `server/src/agent/factory.ts` | mode → invoker |
| `server/src/config.ts` | `AGENT_MODES`、`WORKSPACE_KEYS`、`piBin` |
| `setup-wizard/index.html`、`setup-wizard/server.ts` | 首次選 agent |
| `docs/configurations.md`、`.env.example` | 設定表 |

## 與上一產品版對照

| | 0.44（目前 version.md）／0.45 管線 | 0.46 |
|--|------|------|
| Live agents | `claude`｜`cursor`｜`codex` | ＋`pi` |
| 入夢契約 | 0.45 改 spawn 次數／名片 JSON | **不變** |
| Store | boot ≥0.40 | 無 migrate |
