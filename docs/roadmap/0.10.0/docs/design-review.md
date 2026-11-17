# 0.10.0 設計審查

審查只認檔案。本檔是審查紀錄，不是已定案。

## 各輪日期

| 輪 | 日期 | 範圍 |
|----|------|------|
| 1 | 2026-11-17 | 初審。對照 INDEX、HOW、reasoning、HANDOFF、0.9.0，並抽樣 `engram-distill`、`docs/data-spec.md` Nodes、`docs/api.md` 的 node／distill 列。沒有對應 backlog 檔 |
| 2 | 2026-11-17 | 複審。核對 DR-M1、DR-L1、DR-L2 是否已寫進 INDEX 與 HOW。同一組錨點再讀一遍。沒有新的 backlog 檔 |
| 3 | 2026-11-17 | 複審。核對 DR-M2 是否已寫進 INDEX 已定案第 2 條與 HOW Rewrite。再抽樣 `engram-distill` 與 `docs/data-spec.md` Nodes。沒有新的 backlog 檔 |

## 對照基準

- 已定案與驗收：`docs/roadmap/0.10.0/INDEX.md`（狀態 `planned`；開工前仍須拍板：無）
- HOW：`docs/roadmap/0.10.0/docs/how.md`
- WHY：`docs/roadmap/0.10.0/docs/reasoning.md`
- 開工禁區：`docs/roadmap/0.10.0/HANDOFF.md`
- 上一版：`docs/roadmap/0.9.0/INDEX.md`（`shipped`）。空殼刪除、`node-create` 同輪不刪、distill 不維護 `activity_score`、聯絡細節不進 Standing facts，本版寫明沿用
- 產品硬契約：skills 寫 live memories；server 只做控制面與機械 I／O；無 dream staging／approve／report UI；無 setup wizard

## 總評

第 3 輪沒有未關閉 HIGH，也沒有未關閉 MEDIUM。提案可行：改寫只發生在本輪新建或更新的 node，兩段整段換掉，判斷留在 `engram-distill`，server 不評正文，也不掃未碰到的檔。

DR-M2 已寫進 INDEX 已定案第 2 條與 HOW Rewrite，本輪關閉。收成一幅現在時，一次性事件、版本號、菜單可以離開 Current situation，不必先被推翻，細節留在 chain；仍描述現在的句子留著，除非被這份 node 檔裡較晚的主張、本輪 pool 事件，或本輪吸收的釐清推翻。另一份日檔不能單獨證明現在已經不成立。

設計審查門檻通過。無未關閉 HIGH。同意的 MEDIUM 已寫進契約。開工前仍須拍板是空的。HANDOFF 有 paste-ready starter。非目標寫清：不全庫改寫、不加獨立清理 skill 或按鈕、不改 chain 文體、不改 Ask 的讀檔範圍、不維護 `activity_score`、不手改 live store。

## Findings

### DR-M1 — 覆蓋舊句的「後來事實」來源沒對齊

- **等級：** MEDIUM
- **狀態：** 關閉（第 2 輪）
- **問題：** 已定案第 3 條：Standing facts 裡被覆蓋的句子，來自「這份檔案裡較晚的事實，或本輪事件」。已定案第 6 條：不得新增檔案、本輪事件、已吸收釐清以外的事實。HOW Rewrite 只寫「後來的事實換掉它矛盾的那句」，沒有寫這個後來事實要落在檔內、本輪事件，還是已吸收釐清。HOW 的例子是虛構專案從上架轉到手機版，沒有標出來源。
- **為何要修：** 只讀第 3 條時，釐清答案可以新增事實，卻不夠格刪掉檔內仍寫著的舊句，兩句會並存。只讀 HOW 時，skill 可以拿本輪讀過的其他日檔來刪 Standing facts，變成對 chain 的第二輪掃除。兩種讀法都做得出主路徑，留下的 node 不一樣。
- **建議：** 在已定案第 3 條與 HOW Rewrite 用同一句寫來源：可覆蓋舊句的事實，只來自這份 node 檔裡較晚的主張、本輪 pool 事件，或本輪已吸收的釐清。其他日檔不用來單方面刪掉仍成立的 bullet。未在本輪開啟的 node 不因這條改寫。
- **關閉依據：** INDEX 已定案第 2、第 3 條與 HOW Rewrite 已用同一組來源：這份 node 檔裡較晚的主張、本輪 pool 事件、本輪吸收的釐清。另一份日檔不能單獨刪掉仍成立的句子或 bullet。第 6 條的可新增來源與此同向。

### DR-L1 — HOW 的 Identity 只寫 who

- **等級：** LOW
- **狀態：** 關閉（第 2 輪）
- **問題：** 已定案第 4 條是「who or what the node is，或與其他 node 的關係」。HOW 寫成「who the node is or a relationship」。專案節點的「是什麼」只在 INDEX。
- **建議：** HOW 補上 what。不做也可以開工。
- **關閉依據：** HOW Rewrite 已寫「who or what the node is, or a relationship」，與已定案第 4 條對齊。

### DR-L2 — 「不讀」容易被寫成連對檔都不讀

- **等級：** LOW
- **狀態：** 關閉（第 2 輪）
- **問題：** HOW 寫本輪沒有為了建立或更新而打開的 node，「not read for this rewrite」。現有 skill 仍要讀可能對上的 node，才知道要不要更新。已定案第 1 條禁止的是掃整庫改寫。
- **建議：** HOW 改成：不為了本規則另開、也不再存檔本輪沒有建立或更新的 node。對上 id 時的讀檔保留。不做也可以開工。
- **關閉依據：** HOW Rewrite 已寫：不為了套用本規則才打開 node，也不存檔本輪沒有建立或更新的 node；為了判斷本輪要不要更新而讀檔，維持現況。

### DR-M2 — 現況段裡仍成立的一次性句子能否拿掉

- **等級：** MEDIUM
- **狀態：** 關閉（第 3 輪）
- **問題：** 已定案第 2 條同時寫了兩句。一句是整段換成一幅現在，一次性事件、版本號、菜單留在 chain。另一句是：句子只能被這份 node 檔裡較晚的主張、本輪 pool 事件，或本輪吸收的釐清換掉；另一份日檔不能單獨刪掉仍成立的句子。HOW Rewrite 複述這兩句。HOW 例子只示範拿掉已被推翻的舊段（手機版尚未開始），沒有示範現況段裡一句仍為真的版本號或菜單。
- **為何要修：** 主路徑是本輪更新一份已有 as-of 堆疊的 node。堆疊裡若有一句「版本號已上架」且沒有後來主張推翻它，一種讀法把它留在 Current situation，因為它仍成立；另一種讀法在收成一幅現在時把它拿掉，細節只留在 day。兩種讀法都做得出整段取代，留下的現況段不一樣。Standing facts 的「仍成立就不要為了變短而刪」與此分開，本項只指 Current situation。
- **建議：** 在已定案第 2 條與 HOW Rewrite 用同一句寫死：收成一幅現在時，一次性事件、版本號、菜單可以離開 Current situation，不必先被推翻，細節留在 chain。仍描述現在、且沒有被那三個來源推翻的句子留著。不要拿另一份日檔單獨證明這句現在已經不成立。
- **關閉依據：** INDEX 已定案第 2 條與 HOW Rewrite 已用同一句：收成一幅現在時，一次性事件、版本號、菜單可以離開 Current situation，不必先被推翻；細節留在 chain（HOW 寫 day file，day 是 chain 的必寫層，本版非目標不改 chain）。仍描述現在的句子留著，除非被這份 node 檔裡較晚的主張、本輪 pool 事件，或本輪吸收的釐清推翻。另一份日檔不能單獨證明這句現在已經不成立。HOW 例子仍只示範已被推翻的舊段，規則句本身已把兩種讀法收成一種。

## 驗收對照

| 驗收 | 設計是否覆蓋 | 備註 |
|------|----------------|------|
| `engram-distill` 寫明：本輪有寫的 node 整段換掉 Standing facts 與 Current situation；現況是一幅現在；穩定事實是仍成立的 bullet，合併重複、刪掉被覆蓋的主張；Identity／Relation 只在身分或關係有變時改；沒碰到的 node 不動 | 是 | 四段分工、整段取代、不掃未碰到的檔，INDEX 與 HOW 一致。覆蓋來源已對齊（DR-M1 關閉）。現況段可拿掉的一次性句子已寫死（DR-M2 關閉）。現 skill 尚未改寫這些句子，屬 Track 1，不是設計缺口 |
| `docs/data-spec.md` 寫同一條取代規則 | 是 | Track 2。現文仍是「穩定事實（較少改）」「目前狀態（隨沉澱更新）」，屬待改，不是設計衝突 |
| 沒有 server 程式為這條分類或改寫 node 正文 | 是 | 已定案第 8 條、HOW Program、reasoning 否決 server diff。非目標含全庫改寫、獨立清理 skill、新路由 |
| `bun test` 通過 | 是 | 行為鎖在 skill 與 data-spec 句子。現有 `server/test/clarify-skill.test.ts`、`node-rewrite.test.ts` 只鎖吸收、別名、空殼，不鎖本版句子。HOW 寫明不新增程式核對 |

## 現碼抽樣

抽樣用來確認提案與現況能否接上。現碼尚未實作的新條款，不構成設計 HIGH。第 3 輪未見與提案互斥的新程式路徑。

| 位置 | 現況 | 與提案 |
|------|------|--------|
| `.agents/skills/engram-distill/SKILL.md` 步驟 4、6、6a、6c、6d | 步驟 4 讀可能對上的 nodes。可新建或更新四段；不要把日記抄進 node；別名沿 0.7.0；空殼只刪本批開始前就存在、兩段仍空或佔位、且本批寫不出事實的檔；`node-create` 骨架同輪不刪 | 提案是在「本輪有寫這份檔」時整段換兩段，空殼條件放在改寫之後。讀檔判斷要不要更新，與 DR-L2 關閉後的 HOW 一致。現文沒有「不要在舊段下再疊 as of」。屬 Track 1 |
| `docs/data-spec.md` Nodes | 四段標題在；Standing facts 寫較少改，Current situation 寫隨沉澱更新。distill 不維護 `activity_score` | Track 2 改成與 INDEX 相同的整段取代。空殼句已與已定案第 7 條同向 |
| `docs/api.md` | `POST /distill` 仍是 202 job。`GET /nodes`、`GET /nodes/{id}`、`GET /nodes/graph` 只讀 | 無新路由。圖的邊仍是掃 wikilink，不評正文 |
| `server/`（`*.ts` 搜 Standing facts／Current situation） | 這兩段只出現在 `server/test/node-rewrite.test.ts` 的合併／刪除 fixture | 沒有 server 改寫 node 散文。`node-rewrite` 測試鎖的是 `engram-node` 改 wikilink，不是本版文體 |

判斷留在 skill：哪句仍是現在、哪條事實仍成立、身分或關係有沒有變。Program 不評。這與非目標及硬契約一致。

## 修復追蹤

| ID | 等級 | 狀態 | 寫進契約 |
|----|------|------|----------|
| DR-M1 | MEDIUM | 關閉（第 2 輪） | INDEX 已定案第 2、第 3 條；HOW Rewrite |
| DR-L1 | LOW | 關閉（第 2 輪） | HOW Rewrite（who or what） |
| DR-L2 | LOW | 關閉（第 2 輪） | HOW Rewrite（不為本規則另開；對上時的讀檔保留） |
| DR-M2 | MEDIUM | 關閉（第 3 輪） | INDEX 已定案第 2 條；HOW Rewrite |

## 歷審摘要

第 1 輪：無 HIGH，提案可行。門檻未過，因為覆蓋舊句的來源在已定案第 3 條、第 6 條與 HOW 之間沒有同一句。沒有 dream staging、approve、report UI、setup wizard，也沒有把改寫做成 server 規則。

第 2 輪：DR-M1、DR-L1、DR-L2 已寫進 INDEX 與 HOW，關閉。無 HIGH，提案仍可行，未判不可行。門檻未過，因為 Current situation 的「一幅現在」與「仍成立的句子只能被三個來源換掉」在主路徑上會留下不同的現況段（DR-M2）。

第 3 輪：DR-M2 已寫進 INDEX 已定案第 2 條與 HOW Rewrite，關閉。無未關閉 HIGH、無未關閉 MEDIUM。提案可行，未判不可行。設計審查門檻通過。
