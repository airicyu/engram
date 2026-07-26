# Data workspace config（backlog）

← [backlog](./INDEX.md) · **已排進 [0.13.0](../0.13.0/INDEX.md)**

> **狀態：** 已併入 **0.13.0**（見該版 INDEX + reasoning）。  
> 同版另含首次 **setup wizard**（`setup-wizard/`、`bun run setup`）。

## 定案摘要（0.13.0）

- 檔：`{ENGRAM_HOME}/engram.workspace.yaml`（`timezone`、`memory_language`）
- 語言三碼：`zh-Hant`｜`zh-Hans`｜`en`；priority：workspace → `ENGRAM_MEMORY_LANGUAGE` → **`en`**
- Timezone：workspace → `ENGRAM_TZ` → `Asia/Hong_Kong`；非法／未知鍵 → 拒啟
- Boot-time merge；無 runtime 設定 API；不回溯 L0／舊 L2
- Setup：`bun run setup` → random port 同源 HTML → 寫 `.env` + data home + workspace yaml

細節、軌道、驗收、反例：[0.13.0 INDEX](../0.13.0/INDEX.md) · [reasoning](../0.13.0/docs/reasoning.md)

## 非目標

- 多租戶 auth；取代 server `.env` 進程項；UI i18n 與記憶語言綁死；日常 Workbench 設定頁
