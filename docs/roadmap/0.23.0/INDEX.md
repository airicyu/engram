# 0.23.0 — Support Codex CLI

← [changelog](../../../changelog.md) · 上游：[0.22.0](../0.22.0/INDEX.md)（shipped）· current: [version](../../../version.md) `0.23.0` · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**（2026-08-06）  
> 第三個 live agent：`ENGRAM_AGENT=codex`（OpenAI Codex CLI `codex exec`）；寫入圍籬對齊 0.20 write-policy。**無** store migrate。

## 產品句

> 使用者可把 Dream／Ask／Rollup 的 agent CLI 設成 **Codex**（與 Claude Code、Cursor CLI 並列）；approve 前仍不可寫 live `memories/**`。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、驗收 |
| 2 | [docs/codex-provider.md](./docs/codex-provider.md) | argv、`--cd`／`--add-dir`、與 Claude／Cursor 對照 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何窄 `--cd`、不用 danger-full-access |

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | Mode | `ENGRAM_AGENT=codex`（workspace `agent: codex`）；**預設仍 `claude`** |
| 2 | Binary | `CODEX_BIN`／workspace `codex_bin` → 預設 `codex` |
| 3 | 非互動 | 一律 `codex exec`（對齊 `claude -p`／Cursor `-p`） |
| 4 | Sandbox | `--sandbox workspace-write`；**不**對 `exec` 傳 `--ask-for-approval`（該旗標僅頂層 `codex`；`exec` 預設 approval never）；**不用** `danger-full-access`／`--yolo` |
| 5 | Dream／Rollup `--cd` | `{storeDir}/dreams`（蓋 draft＋reports）；**不可** `--cd` 到整庫 `storeDir` |
| 6 | Ask `--cd` | Ask jobDir（既有 `cwd`）；加 `--skip-git-repo-check`（temp 常非 git 工作樹） |
| 7 | 其餘可寫根 | 不在 `--cd` 下者以重複 `--add-dir` 補上（如 dream temp workdir） |
| 8 | CLI 知識位置 | **僅** `server/src/agent/providers/codex.ts`；factory 串 dream／ask／rollup |
| 9 | Store | **不** bump `store_version`；無 HTTP 記憶契約變更 |
| 10 | Setup | setup-wizard 第三選項「Codex CLI」→ 寫入 `ENGRAM_AGENT=codex` |

## 非目標

- 改 dream／ask／rollup prompt 或業務交付契約
- 把 Codex 設成預設 agent
- Node merge、新 HTTP 端點、store migrate
- CI／單元測試強制本機已安裝並登入 Codex

## 實作軌道

### Track A — CodexInvoker＋write-policy helpers

- **做：** `CodexInvoker`；`codexCdRoot`／`codexAddDirs`（或等價）；config／factory 接受 `codex`
- **不要：** 在 ask／dream／rollup 業務檔複製 argv 長列表
- **驗收：** 見下方 checklist；`write-policy` 測試證明 dream 的 cd ≠ store 根

### Track B — Setup＋文件

- **做：** wizard 選項；README／server README／configurations／api-docs／AGENTS／version／changelog
- **不要：** 無關 UI 重構
- **驗收：** 文件列出 `codex`；wizard 可寫 `.env`

## 驗收

- [x] `ENGRAM_AGENT=codex` → `createAgentInvoker()` 為 `CodexInvoker`；非法 mode 明確失敗
- [x] argv 含 `exec`、`workspace-write`；**不含**對 `exec` 無效的 `--ask-for-approval`
- [x] Dream／Rollup：`--cd`＝`{store}/dreams`（非 store 根）
- [x] Ask：帶 `--skip-git-repo-check`
- [x] setup-wizard 可選 Codex 並寫入 `ENGRAM_AGENT=codex`
- [x] `bun test`：write-policy cd helper＋config；既有 mock 路徑不回歸
- [x] version／changelog／API 文件已列 `codex`

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/agent/providers/claude.ts`／`cursor.ts` | Invoker 風格對照 |
| `server/src/agent/factory.ts` | mode → invoker |
| `server/src/agent/shared/write-policy.ts` | 可寫根＋Codex cd／add-dir |
| `server/src/config.ts` | `AGENT_MODES`、bin 解析 |
| `setup-wizard/` | 首次選 agent |
| `docs/configurations.md` | 設定表 |

## 與上一版對照

| | 0.22.0 | 0.23.0 |
|--|--------|--------|
| Live agents | `claude`｜`cursor` | ＋`codex` |
| Dev UX | 一鍵 `bun run dev` | 不變 |
| Store | — | 無 migrate |
