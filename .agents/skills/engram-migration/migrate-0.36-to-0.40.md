# Migrate Engram store：0.36–0.39 → 0.40

← 路由器：[SKILL.md](./SKILL.md)

> **Hop：** 0.36.x–0.39.x → **0.40.0**。未來視雙檔 **`hot.md`／`later.md` → `upcoming.md`／`longTerm.md`**；`zone` 與 workspace `future_sight_hot_days` 同步改名。  
> **全程離線**。 **不做：** discard pending；改錨點正文；改 window 天數語意。

## 何時用本檔

- 使用者要升級 **0.36–0.39** 記憶庫以配合 **0.40+** server（boot gate ≥ 0.40）。
- 線索：仍有 `memories/future-sight/hot.md` 或 `later.md`；或 `store_version` major.minor ∈ 0.36–0.39。

若已是 ≥ **0.40** 且無 `hot.md`／`later.md` → 可能已遷移；腳本直接退出。  
若仍是 **0.28–0.35** → **先** `migrate-0.28-to-0.36`。

## 前置

1. `ENGRAM_STORE_DIR` 絕對路徑。
2. **備份**整個 store。**未備份不得改。**
3. **不必**先啟動 server。

## 結構差

| 項目 | 0.36–0.39 | 0.40 |
|------|-----------|------|
| 即將區檔 | `hot.md`，`zone: hot` | `upcoming.md`，`zone: upcoming` |
| 長遠區檔 | `later.md`，`zone: later` | `longTerm.md`，`zone: longTerm` |
| workspace | `future_sight_hot_days` | `future_sight_upcoming_days` |
| `store_version` | `0.36.x`–`0.39.x` | **`0.40.0`** |

## 步驟

```bash
bun ./scripts/migrate-0.36-to-0.40.ts "$ENGRAM_STORE_DIR"
```

1. live 與 `dreams/draft/*/memories/future-sight/`：改檔名並改 frontmatter `zone`。
2. 若有 `future_sight_hot_days` → 改名 `future_sight_upcoming_days`。
3. Stamp `0.40.0`；store git 則 commit。

## 自檢

- [ ] 無 `hot.md`／`later.md`
- [ ] 有 `upcoming.md`／`longTerm.md`（若該區本來有檔或 hop 寫過）
- [ ] frontmatter `zone: upcoming`／`longTerm`
- [ ] `store_version: 0.40.0`
- [ ] 無 `future_sight_hot_days`
