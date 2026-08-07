# 0.25.0 reasoning

← [INDEX](../INDEX.md)

做什麼以 INDEX／[standing-understanding.md](./standing-understanding.md) 為準。本檔只留動機與否決項。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 要防什麼

1. **角色錯位**：`what.md` 變成第二條時間軸 → Seek／Memory 讀不到「這是誰」，只看到流水。
2. **與 chain 重複**：同一情節寫兩遍，維護成本高、易不一致。
3. **範圍膨脹**：一開始就開 who／open 多檔或改 API 名 → 本版真正要驗的「寫對理解」被橫向改動淹沒。

## 為何單檔四段（不開多 facet 檔）

- 現行管線與 UI **已經**只圍繞單一 `what.md`／`what_current`；先把契約做對，成本最低。
- 固定英文 `##` 標題可 mock assert，又不需 `store_version` migrate。
- 舊 0.1 多 facet 設計與現行 file pipeline 未接線；本版明確**不**復活，避免半套幽靈語意（如 `resolve_open`）。

## 為何空段留標題 + `_None_`

- 省略空節會讓「忘了寫 Relation」與「不適用」無法區分，骨架約束變軟。
- `_None_` 與既有 report 空段習慣接近；UI 可接受短暫空洞，優先契約可檢查。

## 為何 D1 懶改寫（不做 D2 回填）

- 全庫回填要新 job／大量人審，超出「先修寫入行為」的本版目標。
- 懶改寫保證：**之後被 dream 碰到的 node** 會變好；冷 node 維持舊樣可接受。

## 為何本版不改 `what_current`

- 使用者體感來自 markdown，不來自 JSON 鍵。
- 改名牽 server／web／文件／測試／skill，與「prompt 行為」正交且易拖慢出貨。
- 已單列 backlog，**依賴 0.25 出貨後**再做。

## 為何 approve 不做硬校驗缺標題

- 過渡期 draft、人手改檔、舊 pending 可能缺骨架；硬 4xx 會卡死 Consolidate。
- 本版以 prompt＋mock／測試建立期望；若日後要硬閘門，另開版本並定義錯誤碼。

## 否決／不做

| 方案 | 為何不做（本版） |
|------|------------------|
| 恢復 open.md／多 facet 檔 | 路徑與讀取面未設計；與「單檔先做對」衝突 |
| Identity + Notes 兩段 | 過鬆，日記易復發 |
| 與 API 改名同版 | 複雜度偏高、收益偏低 |
| Approve schema reject | 過渡期操作風險 |
