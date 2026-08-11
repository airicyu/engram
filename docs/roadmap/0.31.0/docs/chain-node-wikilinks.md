# 0.31 — Chain 寫入時 node wikilinks

← [INDEX](../INDEX.md) · 對齊：[0.28 structure-growth](../../0.28.0/docs/structure-growth.md)（Relation P1）

做什麼以 INDEX 已定案 C 為準；本檔寫 **寫入對象、存在判定、prompt 應加的句子、非回填**。

---

## 1. 寫入對象

| 產物 | 路徑（draft／live 相對 store） | 本版互指 |
|------|--------------------------------|----------|
| Day summary | `memories/chain/days/{YYYY-MM}/{day}.summary.md` | ✅ 整檔敘事提已知 node → P1 |
| Day ledger block | `memories/chain/days/…/{day}.md` 本輪 append | ✅ 該 block 正文提已知 node → P1 |
| Week／month／year summary | `memories/chain/weeks|months|years/…/*.summary.md` | ✅ 同左（rollup writer 為主） |

Future-sight、clarify、short-term：**不在**本版強制互指範圍（維持現狀）。

---

## 2. 存在判定（寫入當下）

**可 link 的 id 集合**＝

1. Frozen context 的 live nodes：`l2_current`／`existing_nodes`（與 dream-files Relation 規則同一來源），**加上**
2. **本輪**已在 draft 建立、或本輪 extract 將建立的 node id

**不可 link：**

- 寫入時不在上述集合、本輪也不新建 → 只寫人名／作品名散文
- 之後某次 dream 才 `create` 的 node → **不**回頭改舊日 summary／ledger（見 §4）

與 Relation 一致：不要為路人發明 node id 只為了掛 link。

---

## 3. 形態

機器寫入（dream／rollup／amend／mock）：

```text
[[nodes/{id}/{id}|{id}]]
```

例：day summary 一句

```markdown
與 [[nodes/nara/nara|nara]] 討論北灣行程；晚上改 [[nodes/harbor/harbor|harbor]]。
```

- Vault 相對 `memories/`；**禁止** `[[memories/nodes/…]]`
- 顯示名預設＝id（與 0.28 #24 同）；不強制人類可讀名

---

## 4. 非回填（產品邊界）

| 情境 | 行為 |
|------|------|
| 寫 day D 時尚無 node `X`，之後建立 `X` | 歷史 D **保持**無 link |
| 之後 dream **再次 rewrite** day D summary | 可依**新的**存在集合補上 P1（順帶改寫，非獨立 backfill job） |
| Migrate／離線腳本掃全庫改 chain | **本版不做** |

理由見 [reasoning](./reasoning.md)。

---

## 5. Prompt 應補的契約（實作時寫進檔案）

### `dream-files.md`

在「Media attachments」附近或獨立小節 **Chain node wikilinks**：

- When writing **day summary** or **day ledger** blocks, if you mention an L2 node that is in `l2_current`／`existing_nodes` or that you create this round → include P1 `[[nodes/{id}/{id}|{id}]]`.
- Do **not** invent links for entities you are not treating as nodes.
- Do **not** rewrite unrelated historical days just to add links.

### `rollup-write-{week,month,year}.md`

- Same rule when fusing lower summaries：若提及仍存在於 live／本輪的 node → P1；從下層 copy 來的已有 `[[nodes/…]]` **保留**；下層只有散文、但 node 現已存在 → **本輪 rollup 可寫入** P1（這是寫新高階檔，不是改歷史 day 的 backfill）。

### `amend-dream.md`

- 若 instruction 導致改 chain 正文：適用同一「當時存在才 link」；**不要**為了互指而擴大改寫範圍到未提及的日子。

---

## 6. Soft lint（summary only）

擴 `structure-notes.ts`（或平行函式，仍注入 report）：

- 掃描 draft 下 `**/*.summary.md`（days／weeks／months／years）
- Heuristic 對齊 node Relation：正文出現已知 peer id 字樣卻無任何 `[[` → warning 一行
- **不**掃描 ledger 全歷史（成本高、區塊多）；ledger 靠 prompt＋mock

警告**不**失敗 dream、**不**擋 approve。

---

## 7. Mock／phases

- Day summary 或 ledger 示例至少含一個指向測試用既有 node（如 `acme`／`mak`）的 P1
- Assert approve 後 live 檔 `includes("[[nodes/")`

---

## 8. 與 UI Track 的關係

Chain 檔經 Memory 的 `MdBlock` 同樣 preprocess → 時間軸上的互指可點進 node（依賴 INDEX Track A／B）。
