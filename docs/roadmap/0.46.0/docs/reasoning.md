# 0.46.0 — Reasoning（WHY）

← [INDEX](../INDEX.md) · HOW：[pi-provider.md](./pi-provider.md)

> 做什麼以 INDEX／pi-provider 為準。本檔只留動機與否決方案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 為何要支援 Pi

使用者已可選 Claude Code、Cursor CLI、Codex。Pi（`pi` CLI）是另一套本機 coding harness，可用 OpenRouter 等既有設定跑非 Anthropic／OpenAI 官方 CLI。0.20 的 `AgentInvoker` 正是為「換 CLI、不改業務」而設。本版只加 provider＋設定／文件。

Mode 用 **`pi`** 而非 `pi-agent`：與 `claude`／`codex` 一樣跟 **PATH 上的 binary 名**對齊，避免兩個合法字串。產品敘述仍可寫 pi-agent。

---

## 為何必須禁 bash

Claude 路徑用 `--disallowedTools Bash`，因為 shell 可 `cat > memories/...` 繞過 Edit 圍籬。Pi 內建工具含 `bash`（Windows 另有 `powershell`）。Pi **沒有** Codex 的 `workspace-write`＋`--cd`，也沒有 Claude 的 `Edit(//abs/**)`。若允許 bash，live `memories/**` 在 approve 前可被任意改寫。

因此硬邊界是 **工具 allowlist 不含 shell**。僅 `--exclude-tools bash` 不夠：使用者 glob 安裝的 extension 可能再註冊自訂 shell 工具。故同時 `--no-extensions` 與 allowlist。

已知限制：`edit`／`write` 在 Pi 0.85 **不**按目錄沙盒。惡意模型仍可能對任意路徑呼叫 write。本版以（1）無 bash、（2）`--append-system-prompt` 列 writable roots、（3）既有 prompt 的 WRITABLE_ROOTS、（4）approve 前 git 不把 agent 寫入當 live 真相——與 Cursor `--yolo` 同級的「提示＋信任模型」防線。**不要**因此改成 `danger` 式全開 bash「比較穩」。

---

## 為何不傳 `--model`

Pi 的模型在 `~/.pi/agent/settings.json`（使用者已 setup）。Engram 若硬編碼 provider／model，會與本機設定打架，且要把 API key 決策拉進產品範圍。0.45 已否決為職務分流 model。本版同樣 **不**傳 `--model`。

---

## 為何 `--no-session`／`--no-context-files`

每次 dream spawn 若寫入 `~/.pi/agent/sessions/`，會在使用者家目錄堆 jsonl，且可能 `--continue` 串到上一場夢。`--no-context-files` 避免 cwd 落在 store／draft 時把 vault 的 `AGENTS.md` 當 coding-agent 憲法，與 Engram 自己的 extract prompt 衝突。

---

## 為何不改 prompt／業務契約

交付仍是檔案。Pi 只需能寫那些路徑並 exit 0。為 Pi 特製 `dream-files.md` 會造成四套語意。
