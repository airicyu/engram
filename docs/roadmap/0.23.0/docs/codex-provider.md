# 0.23.0 — Codex provider（HOW）

← [INDEX](../INDEX.md)

> Codex CLI 的 argv 與 write-policy 對應。產品語意不變；交付真相仍是磁碟檔案（`requireFiles`），不是 stdout。

---

## 1. 指令形狀

```text
{codexBin} exec
  --sandbox workspace-write
  --cd <narrowRoot>
  [--add-dir <writableRoot> ...]
  [--skip-git-repo-check]
  <prompt>
```

| 旗標 | 值／規則 |
|------|----------|
| 子命令 | 固定 `exec`（非互動） |
| `--sandbox` | 固定 `workspace-write` |
| `--cd` | 見下節 `codexCdRoot` |
| `--add-dir` | 每個「不在 `--cd` 底下」的 `writePolicy.writableRoots` 各一次 |
| `--skip-git-repo-check` | 當 `--cd` **不**位於某 git 工作樹內時必加（Ask jobDir 在 `ENGRAM_TEMP_DIR` 時典型為真） |
| binary | `config.codexBin`（`CODEX_BIN`／`codex_bin`／預設 `codex`） |

**不要**對 `codex exec` 傳 `--ask-for-approval`：該旗標只存在於頂層 `codex`（互動 CLI）；`exec` 本身預設 approval=`never`（Codex CLI 0.114+）。傳了會直接 exit 2（`unexpected argument`）。

**禁止：** `--sandbox danger-full-access`、`--yolo`、`--full-auto`（後者已 deprecated／語意不同）。

---

## 2. `--cd`／`--add-dir` 對應 write-policy

| Job | `writePolicy` 來源 | `--cd`（`codexCdRoot`） | `--add-dir` |
|-----|-------------------|-------------------------|-------------|
| Dream | `dreamWritePolicy`：draft＋reports＋temp workdir | `{storeDir}/dreams` | temp workdir（及其他不在 `dreams/` 下的可寫根） |
| Rollup | `rollupWritePolicy`：workdir±draft | 若 draft 在 store：`{storeDir}/dreams`；否則若僅 workdir → 該 workdir | 其餘不在 cd 下的 writable roots |
| Ask | `askWritePolicy`：僅 jobDir | jobDir（＝既有 `AgentJob.cwd`） | （通常無）；**必** `--skip-git-repo-check` |

**硬規則：** Dream／Rollup **不得**把 `--cd` 設成 `storeDir` 本身——否則 `apply_patch` 可寫 live `memories/**`（Codex 以 `--cd` 為 patch 圍籬；見 reasoning）。

Store 唯讀：不把 `storeDir` 當 writable `--add-dir`。Agent 透過 prompt 內絕對路徑讀 `memories/**`（假設 Read 可讀 `--cd` 外路徑；若實機擋讀，另開修復，不在本版改業務契約）。

---

## 3. 與 Claude／Cursor 對照

| | Claude | Cursor | Codex（本版） |
|--|--------|--------|---------------|
| 非互動 | `claude -p` | `agent -p` | `codex exec` |
| 寫入圍籬 | `Edit(//writable/**)`＋禁 Bash | `--yolo`＋僅 writable `--add-dir` | `workspace-write`＋窄 `--cd`＋補 `--add-dir` |
| 讀 store | `--add-dir` store | Ask：`cursorExtraAddDirs`＝store | 絕對路徑讀（不把 store 當可寫根） |
| 輸出 | `--output-format text` | `--output-format json` | 預設（交付靠檔案，不解析 stdout 當答案） |

---

## 4. 程式落點

| 檔 | 職責 |
|----|------|
| `server/src/agent/providers/codex.ts` | **唯一** Codex argv／spawn／log |
| `server/src/agent/shared/write-policy.ts` | `codexCdRoot`、`codexAddDirs`、`codexNeedsSkipGitRepoCheck`（名稱可微調） |
| `server/src/agent/factory.ts` | `case "codex"` → `CodexInvoker` |
| `server/src/config.ts` | `AGENT_MODES`＋`codexBin` |

`AgentJob` 不必為 Codex 新增欄位；`--cd` 由 policy＋storeDir 推得。Ask 的 jobDir 已是 `writableRoots[0]`／`cwd`。
