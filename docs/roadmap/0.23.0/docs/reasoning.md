# 0.23.0 — Reasoning（WHY）

← [INDEX](../INDEX.md) · HOW：[codex-provider.md](./codex-provider.md)

> 做什麼以 INDEX／codex-provider 為準。本檔只留動機與否決方案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 為何要支援 Codex

使用者已可選 Claude Code 或 Cursor CLI。OpenAI Codex CLI（`codex exec`）是第三種常見本機 coding agent；Engram 的 generic `AgentInvoker`（0.20）正是為「換 CLI、不改業務」而設。本版只加 provider＋設定／文件，不碰記憶契約。

---

## 為何不用 `danger-full-access`／`--yolo`

Cursor 路徑因歷史與 WSL 限制，預設 OS sandbox `disabled`＋`--yolo`，寫入主要靠「只 `--add-dir` 可寫根」＋prompt。Codex 的預設非互動 sandbox 是 **read-only**，自動化寫檔需顯式放寬。

可選方案：

| 方案 | 結果 | 決定 |
|------|------|------|
| `danger-full-access` | 與 Cursor yolo 風險近似；OS 幾乎不擋 live store | **否決**——Codex 有較可用的 `workspace-write`，應收斂 |
| `workspace-write`＋`--cd`＝整庫 `storeDir` | `apply_patch` 可改 `memories/**` | **否決**——違反 0.20「approve 前不可寫 live」 |
| `workspace-write`＋窄 `--cd`（`dreams/` 或 jobDir）＋必要 `--add-dir` | patch 圍籬落在 staging／temp；live 在 cd 外 | **採用** |

Approval：早期文件假設可對 `codex exec` 傳 `--ask-for-approval never`。Codex CLI **0.114** 上該旗標只屬於頂層 `codex`，對 `exec` 會 `unexpected argument` 並立刻失敗。`exec` 預設已是 approval=`never`，故 argv **省略**該旗標。

---

## 為何 Dream `--cd`＝`{store}/dreams`

Dream 可寫根：`dreams/draft/{run}`、`dreams/reports/`、以及 `/tmp` 下 temp workdir。共同父目錄若取 `storeDir`，會把 `memories/` 納入 patch 範圍。

取 `{storeDir}/dreams`：

- draft＋reports 都在其下 → `apply_patch` 可寫 staging
- `memories/`、`engram.workspace.yaml`、`.git` 在 `dreams/` **外** → 不被 `--cd` 圍籬涵蓋
- temp workdir 在 store 外 → `--add-dir` 補上（shell／工具層可寫；即便 add-dir 對 patch 有已知缺口，主交付檔仍在 `dreams/` 下）

已知限制（上游）：部分版本上 `--add-dir` 對 `apply_patch` 圍籬不完整，**真正硬邊界是 `--cd`**。因此「窄 cd」是安全定案的核心，不是裝飾。

---

## 為何 Ask 要 `--skip-git-repo-check`

`codex exec` 預設要求在 git repo 內執行。Ask job 目錄在 `ENGRAM_TEMP_DIR`（預設 `/tmp`），通常**不是** git 工作樹。不加 `--skip-git-repo-check` 會無謂失敗。Dream／Rollup 的 `--cd` 在 store 的 `dreams/` 下時，父層 store 已是 git，通常不需此旗標；實作可用「cd 是否在 git 內」啟發式，或 Ask 路徑固定加旗標（INDEX 驗收要求 Ask 帶此旗標）。

---

## 為何不改 prompt／業務契約

交付仍是檔案（report、draft、ask `result.json`、rollup plan／summary）。stdout 不是答案來源（0.20）。Codex 只需能寫那些路徑並 exit 0；prompt 已注入 `WRITABLE_ROOTS`／絕對路徑。本版不為 Codex 特製 prompt，避免三套語意分叉。
