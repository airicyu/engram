---
name: engram-lite-reset
description: 把 Engram Lite 記憶庫重設成初始空狀態（清空 pending／archived／chain／nodes／clarify／attachments uploads／jobs，保留 workspace.yaml 與目錄骨架）。在使用者說 reset、清空記憶、恢復 initial data 時使用。破壞性：先確認再跑 script。
---

# 重設記憶庫

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)

記憶庫：`engram-lite.yaml` 的 `store_dir` 或 `ENGRAM_LITE_STORE_DIR`（預設 `./../engram-lite-data`）。不要用倉庫內舊的 `engram-lite/data/`。

這是**破壞性**操作。先向使用者確認要清空目前所有事件、日記、節點、釐清檔、附圖、job。沒有明確同意就停止。

## 初始狀態（做完後應如此）

保留：

- `workspace.yaml`（時區、語言、`pi_model` **不要重置成預設**，除非檔案不存在）
- `{store}/.gitignore`、`workspace.yaml`
- `memories/pool/.gitkeep`、`memories/chain/.gitkeep`、`memories/nodes/.gitkeep`、`memories/_attachments/uploads/.gitkeep`、`memories/clarify/{asking,pending,history}/.gitkeep`（若 script 有建）、`jobs/.gitkeep`

變成空檔／空樹：

- `memories/pool/pending.jsonl`、`memories/pool/archived.jsonl`（零位元組或僅檔案存在、無列）
- `memories/chain/`、`memories/nodes/`、`memories/_attachments/uploads/`、`memories/clarify/{asking,pending,history}/`、`jobs/` 底下除 `.gitkeep` 外全部刪除

**不要**改 skills、server、docs。

## 步驟

1. 確認使用者同意。
2. **跑機械 script，不要用手刪或讓模型逐檔猜：**

```bash
# 在倉庫根目錄
bun run .agents/skills/engram-lite-reset/scripts/reset-store.ts --yes
```

自訂記憶庫：

```bash
ENGRAM_LITE_STORE_DIR=/path/to/store bun run .agents/skills/engram-lite-reset/scripts/reset-store.ts --yes
```

沒有 `--yes` 時 script 會拒絕執行。

3. 向使用者報告：清掉了哪些目錄、`workspace.yaml` 是否保留。短。
