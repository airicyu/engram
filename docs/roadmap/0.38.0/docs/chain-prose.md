# 0.38 — Chain 敘事契約（給 prompt／mock）

← [INDEX](../INDEX.md)

做什麼以 INDEX 已定案為準。本檔寫 **各層海拔、分段規則、可省略什麼、必須寫進哪些 prompt 句子、好／壞例、mock 可測形狀**。實作 agent 改 `server/prompts/*` 時以本檔核對，不要自行發明第三套文風。

---

## 1. 產物與誰來寫

| 產物 | 誰寫 | 本版要改的味道 |
|------|------|----------------|
| Day ledger `…/{day}.md` 本輪 append | extract／dream-files | **不**要求文章化（維持碎片） |
| Day summary `…/{day}.summary.md` | extract `summary` 欄，或 dream-files 整檔 rewrite | 可碎、須分題／分段、完整句子 |
| Week／month／year `*.summary.md` | rollup writer；amend 若改到這些檔 | 回顧文章；取捨；禁止合訂本 |

語言：正文仍用 `{{MEMORY_LANGUAGE}}`（`zh-Hant`／`zh-Hans`／`en`）。Prompt 本體維持英文（與現檔一致）。

---

## 2. 海拔（升一層丢掉一層）

寫手先問該層的問題，再決定留什麼。

| 層 | 讀者要的答案 | 預設保留 | 預設省略（留給更低層） |
|----|----------------|----------|------------------------|
| **Day** | 這天發生了哪些有內容的事？（可多則、可不相干） | 具體情節：誰、何處、重要數字／鐘點、當天感受一句 | 不要把「尚未發生的週回顧」寫進日；不要為了順把無關線焊在一起 |
| **Week** | 這週**重心**是哪幾條線？線內大致何時發生？ | 轉折、決定、會影響後續的事、一兩筆有意味的日常 | 菜單、完整地址／門牌、gym 每台機器分鐘數、**每一次**版號（改寫成「本週連發 0.29–0.34」之類） |
| **Month** | 這個月過的**節奏**與轉折 | 上旬／中旬／下旬的走向、線與線的關係 | 單日店名＋菜名、週層已列的鐘點表、版號逐日清單 |
| **Year** | 這年被什麼定義 | 季節或上／下半年通過線 | 月層段落的複述、專案每次小版本 |

省略合法：週可以不提「某頓晚飯等太久」若該週重心是體檢與專案上線；日層仍在。禁止把省略理解成「資料刪除」或「search 會找不到」——search 仍掃日 summary。

---

## 3. 標題與段落

### 標題

- 內容衍生，短（既有 2–8 words 量級）。
- **一個標題＝一條生命線**（或一條明顯同一主題的弧）。
- 禁止併題：不要用逗號把三條無關線寫進同一個 `##`。
- Day：≥2 條有內容的線 → ≥2 個 `##`。只有一條線時可以一個 `##`。
- Week／month／year：維持 2–4 節為常見（薄時段可 1 節）；節的排序＝對**該時段**的重要性，不是日曆順序。

### 段落

- 預設：**一事（或同一弧的一拍）一段**。
- 同一 `##` 下可以 2、3、4 段；不要自我設限「每節只准一段」。
- 只有當連續幾拍明顯是同一條時間弧（例如「接通 bot → 當日架本機 → 晚上發版」）才寫成連續段落。
- 禁止用分號／逗號把 brunch 踩雷、買日用品、運動、便當計畫接成一段牆。

### 文章化（最低）

- 完整句子；有時間錨（日：當天情節自明；週：週一／週末／`YYYY-MM-DD`；月：上旬／下旬；年：季節或月份）。
- 維持既有禁令：不要無指涉的「這天／今日」。
- 不要把路徑、port、future-sight id 當敘事主幹（日層若系統標記到期，一句帶過即可，不要跟晚飯焊在同一句）。

---

## 4. Wikilink 密度（相對 0.31）

**仍必須互指（存在判定與 0.31 相同）：** live `l2_current`／`existing_nodes` 或本輪新建。形態仍是 `[[nodes/{id}/{id}|{id}]]`。非回填仍成立。

**密度改為：**

- 每個 `##` 節裡，對每個被提及的已知 node：**第一次**用 P1；其後可用名字。
- 不要每個主語都掛一次（避免句子被字幕打斷）。
- Rollup **不要**為了「lower 裡有這個 link」而把該句抄上來。整拍省略則 link 省略。
- 若該 node 在本層仍被提到 → 該節首次 P1。

Relation／node 主檔規則**不**因本版放寬（node 檔仍依 0.28／0.31）。

---

## 5. 必須寫進 prompt 的義務（句子級）

實作時用英文寫入對應檔；語意必須覆蓋下列各點（可改寫，不可刪意）。

### `extract.md` — `chain.summary` 欄

現行「Fused full-day narrative — absorb prior … Prefer short `##` …」改為（語意）：

- Summary 是**給人讀的當天敘事**，吸收 prior＋本輪事實；不是只重複 ledger `content`。
- 不同生命線 → 不同 `##`；禁止把無關線併進同一標題或同一段。
- 線內若是不相干的小事 → 多段，不要熔成一段牆。
- 完整句子；不要專名清單。
- 提及已知 node → 該節首次 P1（見 §4）。

### `dream-files.md` — day summary 段

- 同上分段／分題／文章化。
- Chain wikilink 段：把「if you mention → include P1」改成 **per-section first mention**；明文允許同節後文口語名。
- 維持：不發明路人 link；不為補 link 而改無關歷史日。

### `rollup-write-week.md`／`month`／`year`

**刪或改寫衝突句：**

- 「For each kept thread, write **one short paragraph** (or two if needed)」→ 改為可多段，碎則分段。
- 「fuse related beats into flowing prose」→ 只熔**同一弧**；無關則分段或**整拍省略**。
- 「Preserve any `[[nodes/…]]` already present in `lower[]`」→ 改為 §4（省略則不保留）。

**必須新寫：**

- 本層問題（週重心／月節奏／年通過線）。
- 明確 **selection**：下層有的不必都出現；合訂本是失敗寫法。
- 各層預設省略清單（對齊本檔 §2；週＝菜單門牌逐次版號等）。
- 外層仍＝生活維度 `##`；內層仍＝時間序（維持 0.11 以後的 spine，不要改回週一→週日當頁脊）。
- 第一行 `##`；禁止過程旁白（維持）。

Year 維持「比月更抽象、更少日細節」，並加上「不要貼月份段落」。

### `amend-dream.md`

- 若 instruction 導致改 day／week／month／year summary：遵守同一海拔、分段、#8 wikilink；**不要**為了「補完整」把已省略的下層細節加回來，除非人的 instruction 明確要求補某事。

---

## 6. 好／壞例（實作與審查用）

以下為**虛構**契約說明，**不是**任何 live 記憶庫內容。人物／店／診所／專案皆捏造。語言可中可英；模型輸出仍跟 `MEMORY_LANGUAGE`。

### Day — 壞（併題＋牆段）

```markdown
## 北灣體檢排期，燈塔晚飯與河邊散步，Harbor 1.4

nara 上午已完成北灣體檢；下一步 2026-03-21 …（地址全文）… 晚間與林家在燈塔茶餐廳食飯；同日 harbor 發布 1.4。
```

### Day — 好（分題、可碎）

```markdown
## 北灣體檢

[[nodes/nara/nara|nara]] 上午完成就診。下一步 2026-03-21 10:45–11:45 檢查，2026-04-05 由林醫師睇報告。同日牙醫與提早到達撞期，打算自行改期。

## 燈塔與河邊

晚間與林家在燈塔茶餐廳吃飯；之後與 [[nodes/po/po|po]] 到河邊散步。

## Harbor

同日發布 [[nodes/harbor/harbor|harbor]] 1.4。
```

### Week — 壞（合訂本）

把週一到週日的店名、菜、運動分鐘、每次 `1.0`…`1.4` 全寫進兩三段，幾乎等於七篇日文串接。

### Week — 好（取捨）

```markdown
## Harbor／助理

本週產品線從附件與釐清連發，到週四接通測試用 bot、架起本機與雲端對齊，週末再到 1.4。重心是「助理可從手機叫醒、資料對齊」，不是每一版的功能清單。

## 體檢

週六完成北灣體檢；檢查約在 2026-03-21，報告約在 2026-04-05。牙醫撞期要自己改。

## 二人日常

試妝、看展、樓下吃飯與河邊散步仍在。週末 brunch 踩雷後改去會所運動；[[nodes/po/po|po]] 打算開始做上班午餐盒。
```

（週可以提「連發」，不必把 1.0–1.4 的 release note 重寫一遍。）

### Month — 壞

月文幾乎是兩週原文拼接，仍出現「燈塔茶餐廳」點菜與 1.0 到 1.9 逐日。

### Month — 好

下旬開始密集發版（記憶鏈升到週月年、入夢可 retry、future-sight）；同時敲定旅行與拍攝檔期。餘暇（球類、音樂、一頓終於訂到的晚飯）點到為止。
---

## 7. Mock 可測形狀

`fuseMockNarrative` 現況：從 `lower[]` 抽 grains 再按 life dimension 拼接——易變成合訂本，且可能單段。本版 mock **仍須確定性**，但輸出須滿足：

1. `trimStart()` 後第一行 match `^##\s+\S+`
2. 不含過程句（與 lint 同一組針；見 INDEX #10）
3. 至少一個 P1 `[[nodes/{id}/{id}|…]]`（0.31 phases）
4. **禁止**把某一 `lower[].current` 的全文（trim 後）當作輸出裡的連續子字串整段貼上（允許引用短句／專名）
5. 當 `lower` 有 ≥2 個非空 current 且 level 為 week 或 month：輸出至少 **兩個** `##`，且至少有一節在標題後含 **兩個** 以空行分隔的段落（示範「可多段」）

Day mock（`server/src/agent/dream/mock.ts` 裡 summary 字串）：若現行是單段併題，改成 ≥1 個 `##`＋完整句；多線 fixture 則 ≥2 個 `##`。不要為 mock 編造過程旁白。

`test:phases` 對 rollup 的既有 assert（有 `##`、非 id-bullet、無 `summary (mock) for`、含 P1）**保留**，並加上：無過程針、非 lower 全文 paste（實作可對 fixture 的 known lower blob 做 `not.includes`）。

---

## 8. Soft lint（過程句）

只掃 draft `*.summary.md`（與 0.31 同一批檔）。

建議針（大小寫不敏感即可；實作可微調，但須能打中下列）：

- `Reading the write context`
- `Writing the summary`
- `已寫入`

命中 → 一條 Structure notes，帶相對路徑，例如：`summary memories/chain/weeks/…/….summary.md: process narration`。

**不**因此 fail job、**不**擋 approve。既有「整檔完全沒有 `[[` 且提到 known id」警告維持。不要用 lint 去數段落或字數。
