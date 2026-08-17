# Migrate 契約：結構代 0.28–0.35 → 0.36（刪殘留索引／STM 衍生檔）

← [INDEX](../INDEX.md) · 執行真相：[engram-migration `migrate-0.28-to-0.36.md`](../../../../.agents/skills/engram-migration/migrate-0.28-to-0.36.md)

> **執行步驟以 skill 目錄檔為準。** 本檔是 roadmap 契約／WHY。

0.35 廢 STM `summary.md`／`nodes/`、rollup 廢 `initialized_*.yaml` 時採啟動懶清、**未**開 hop。0.36 補正式結構代：離線刪殘檔並 stamp `0.36.0`，boot gate **≥ 0.36**。

| 項目 | From | To |
|------|------|-----|
| Chain indexes | 可能殘留 yaml | 刪 |
| STM 衍生 | `summary.md`／`nodes/` | 刪（空 pool 可先從 summary 回填） |
| `store_version` | 0.28.x–0.35.x | **0.36.0** |
| Boot | ≥0.28 | **≥0.36** |

**不做：** pending discard、改 L0、改 HTTP。
