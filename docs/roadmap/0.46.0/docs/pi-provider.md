# 0.46.0 — Pi provider（HOW）

← [INDEX](../INDEX.md)

> Pi CLI（`@earendil-works/pi-coding-agent`，binary `pi`）的 argv 與 write-policy 對應。產品語意不變；交付真相仍是磁碟檔案（`requireFiles`），不是 stdout。對照套件說明以本機 `pi --help`（實作時對過 **0.85.0**）。

---

## 1. 指令形狀

```text
{piBin} -p
  --no-session
  --no-context-files
  --no-extensions
  --no-skills
  --no-prompt-templates
  --no-approve
  --tools read,grep,find,ls,edit,write
  --append-system-prompt <fence>
  --
  <prompt>
```

| 旗標 | 值／規則 |
|------|----------|
| `-p` | 非互動，處理完退出 |
| `--tools` | **固定 allowlist**（見 INDEX #4）。順序可依實作，集合必須恰好這六個名字 |
| `--append-system-prompt` | `piWriteFence(job.writePolicy)`：列 writable roots；禁止寫 `{storeDir}/memories` |
| `--` | 其後唯一位置參數＝完整 prompt |
| binary | `config.piBin`（`PI_BIN`／`pi_bin`／預設 `pi`） |

**禁止：** `--tools` 含 `bash` 或 `powershell`；傳 `--provider`／`--model`／`--api-key`；用 `--mode json` 當交付；省略 `--no-session`（避免每次入夢寫 session jsonl）。

---

## 2. cwd 與 Read store

| Job | `AgentJob.cwd`（既有） | Pi 行為 |
|-----|------------------------|---------|
| Dream／amend | dream temp workdir | 進程 cwd＝該目錄；draft／reports 以絕對路徑寫入（prompt 已有） |
| Rollup write | rollup temp workdir | 同上 |
| Clarify distill／generate | 既有 temp | generate **無** Claude 式 `--add-dir` store；輸入已在 JSON |
| Ask | ask jobDir | 寫 `result.json`；讀 store 靠絕對路徑 |

Pi **沒有** `--add-dir`。不要發明等價旗標。若實機 Read 擋絕對路徑，另開修復，不在本版改業務契約。

---

## 3. `piWriteFence` 內容（機械）

英文、短、無業務寫作規則。至少包含：

1. 一行說明只可 Write／Edit 下列目錄  
2. 每個 `writePolicy.writableRoots` 各一行絕對路徑  
3. 明確不得寫入 `join(storeDir, "memories")`  
4. 一句：deliverables are files on disk; do not use bash

---

## 4. 與 Claude／Cursor／Codex 對照

| | Claude | Cursor | Codex | Pi（本版） |
|--|--------|--------|-------|------------|
| 非互動 | `claude -p` | `agent -p` | `codex exec` | `pi -p` |
| 寫入圍籬 | `Edit(//{root}/**)`＋禁 Bash | `--yolo`＋僅 writable `--add-dir` | `workspace-write`＋窄 `--cd` | 工具 allowlist（無 bash）＋fence 句；**無** path-scoped Edit |
| 讀 store | `--add-dir` store | Ask：`cursorExtraAddDirs` | 絕對路徑 | 絕對路徑 |
| 輸出 | `--output-format text` | `--output-format json` | 預設 | 預設 text；不解析 |

---

## 5. 程式落點

| 檔 | 職責 |
|----|------|
| `server/src/agent/providers/pi.ts` | **唯一** Pi argv／spawn／log；匯出 `buildPiCmd`、`piWriteFence` 供單測 |
| `server/src/agent/factory.ts` | `case "pi"` |
| `server/src/config.ts` | `AGENT_MODES`＋`pi_bin`／`PI_BIN` |
