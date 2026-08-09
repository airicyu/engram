# 結構生長與圍護（0.28）

← [INDEX](../INDEX.md) · 佈局：[node-layout.md](./node-layout.md)

> 目標：讓 AI（dream／amend）**自然**把內容寫進我們要的結構，而不是事後靠人肉改正、或只靠一句「請遵守」。  
> **硬拒範圍以 INDEX 已定案／待拍板為準**；本檔描述分層策略與本版建議落點。

---

## 1. 原則：生長 ≠ 懲罰優先

| 層級 | 手段 | 作用 |
|------|------|------|
| **L0 形狀** | 磁碟只暴露正確主檔路徑；舊 path 從白名單移除 | 錯地方根本寫不進 draft |
| **L1 種子** | 新建 node 必帶四段骨架檔 | 空白起點已是合法形狀 |
| **L2 示範** | 凍結 context 裡的 `understanding` 若已是好骨架，成為 few-shot；若像日記，prompt 明示「本輪 rewrite」 | 跟著現況長，而不是抽象說教 |
| **L3 規則** | prompt 寫死：骨架順序、Relation 須 wikilink、事件進 chain | 行為契約 |
| **L4 可見回饋** | report 結構提示（軟校驗） | 人審／amend 看得到漂移 |
| **L5 硬閘** | approve 4xx（本版預設不做） | 成本高；舊稿／半寫易卡死 |

0.25 已做 L1–L3 的大部分（對 `what.md`）。0.28 藉 **換主檔** 重置 L0，並把 **互指** 納入 L3；L4 依 INDEX **P2**。

---

## 2. 本版要 AI「長出」的結構

1. **檔級：** 只維護 `nodes/{id}/{id}.md`（外加 meta／score 由 script，不交給敘事 agent 亂寫）。
2. **段級：** 四段 standing understanding（Identity／Relation／Standing facts／Current situation）。
3. **邊級：** 與其他 node 的關係用 **wikilink** 落在 Relation（必要時 Standing facts），相對 vault `memories/`。
4. **分工級：** 情節 → chain；穩定認知 → node；檔期 → future-sight（不變）。

「生長」＝每一輪 dream **在既有骨架上 rewrite／補邊**，不是 append 日記，也不是只產報告不改檔。

---

## 3. 圍護設計（實作清單）

### 3.1 Write-policy（L0）

- Allow：`draft/.../memories/nodes/{id}/{id}.md`（及既有 chain／future-sight 規則）。
- Deny：`.../understand/what.md`、任意 `nodes/**/INDEX.md` 當敘事主檔（若仍允許改 meta，保持既有；**不要**讓 agent 重建 stub INDEX）。
- 測試：嘗試寫舊 path → 拒絕或不可見於可寫集合。

### 3.2 Seed（L1）

新建 node（dream create／server helper）寫入：

```markdown
## Identity

_None_

## Relation

_None_

## Standing facts

_None_

## Current situation

_None_
```

檔名 `{id}.md`。若本輪已知道與 `mak` 的關係，第一輪 rewrite 就應把 Relation 從 `_None_` 換成含 wikilink 的句子——不必先留空等多輪。

### 3.3 Prompt 契約（L3）— 須寫進 `dream-files.md`／`amend-dream.md`

除 0.25 骨架外，新增至少：

| 規則 | 說明 |
|------|------|
| 路徑 | 只更新 `nodes/{id}/{id}.md`；禁止 `understand/what.md` |
| Vault | 正文內連結相對 `memories/` vault（例 `[[nodes/mak/mak\|Mak]]`）；勿加 `memories/` 前綴 |
| 互指 | 當 Relation／事實涉及**另一個 L2 node**（已在 context 的 `l2_current`、或本輪新建 id）→ **必須**留下可點開的 wikilink；口語名可保留在顯示文字中 |
| 非 node | 一次性路人、不可建 node 的詞 → **不要**假造連結 |
| 壞形狀 | 若讀到的 understanding 缺四段或像日記 → 本輪整檔 rewrite 為骨架，情節下沉 chain |

Wikilink 形態（**已定 P1**）：Engram 機器寫入一律 `[[nodes/{id}/{id}|顯示名]]`。

### 3.4 Mock（回歸）

- 更新既有 node：寫入 `{id}.md`，含四段；Relation 含至少一個符合 P1 的範例 link（指向測試用另一 node 或自洽 path）。
- 新建：無 `understand/`、無 stub INDEX。

### 3.5 軟校驗（L4）— 已定 P2

Finalize draft 後寫入 report **`## Structure notes`**（警告，不失敗 job、不擋 pending）：

| 檢查 | 警告例 |
|------|--------|
| 主檔缺四段小標（順序） | `node eric: missing heading Standing facts` |
| Relation 提及疑似其他已知 node id／顯示名但無 `[[` | `node eric: Relation mentions mak without wikilink` |
| `[[...]]` 指向不存在的主檔且非本輪 draft 新建 | `broken link nodes/foo/foo` |

無問題時該節為 **`_None_`**（節本身保留，形狀穩定）。

**P3／P4：** approve **不**因缺小標或死連而 4xx。  
**不要**在軟校驗裡自動改檔（那是 amend／人審的事）。

---

## 4. 為何這比「只加長 prompt」有效

- **錯 path 寫不進** → 結構不會在舊巢穴裡繼續長。
- **種子已是骨架** → 模型傾向填空而非發明第三種標題體系。
- **互指變成完成態條件**（prompt＋可選 lint）→ Relation 從散文變成可導航圖的生長點。
- **人看得見 Structure notes** → 與 amend-dream（0.27）形成閉環：警告 → 自由句小修 → 再審。

---

## 5. 非本版／勿混淆

| 題 | 說明 |
|----|------|
| 反思補問（系統問人） | backlog；不是本版「圍護寫入結構」 |
| Typed `links.yaml` | 可與 graph UI 另版；本版邊長在 md |
| 自動全庫 backfill wikilink | 不做；靠後續 dream 觸及改寫 |

---

## 6. 驗收對照

| 項 | 通過長相 |
|----|----------|
| L0 | 測試拒絕舊 what 路徑寫入 |
| L1 | 新 node 磁碟為帶四段之 `{id}.md` |
| L3 | prompt 含路徑＋wikilink＋骨架；mock 符合 |
| L4 | 缺標題／死連 fixture → report 有 Structure notes；approve 仍成功 |
| 端到端 | mock dream → approve → live `nodes/{id}/{id}.md` 存在且可被 search 讀出 |
| Migrate | 未開 server 可完成 hop；有 draft 時 hop 後 pending／draft 已清空 |
