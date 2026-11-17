# 0.9.0 設計審查

審查只認檔案。本檔是審查紀錄，不是已定案。

## 各輪日期

| 輪 | 日期 | 範圍 |
|----|------|------|
| 1 | 2026-11-17 | 初審。對照 INDEX、HOW、reasoning、HANDOFF、0.8.0、backlog `clarify-one-fact`，並抽樣錨點程式與 `docs/data-spec.md`、`docs/api.md` |
| 2 | 2026-11-17 | 對照修訂後的 INDEX、HOW、reasoning、HANDOFF，核對 DR-M1、DR-M2、DR-M3、DR-L1 是否寫入契約。重抽錨點程式與 `docs/data-spec.md`、`docs/api.md` |
| 3 | 2026-11-17 | 範圍加入 future-sight 到期改寫與 node sidecar。核對 DR-M1、DR-M2、DR-M3、DR-L1 仍關閉。抽樣 `server/future-sight/index.ts`、`server/worker/distill-gate.ts`、`server/nodes/score.ts`、`scripts/import-from-engram.ts`，以及 backlog `future-sight-close`、`node-sidecar-cleanup`（構想，不是契約） |
| 4 | 2026-11-17 | 核對 DR-M4、DR-L2 是否寫入契約。重抽 `server/worker/pi.ts`、`server/worker/distill-gate.ts`、`server/future-sight/index.ts`、`server/nodes/score.ts`，以及 `docs/data-spec.md`、`docs/api.md`。`scripts/node-sidecars.ts` 仍不存在 |

## 對照基準

- 已定案與驗收：`docs/roadmap/0.9.0/INDEX.md`（狀態 `in progress`；開工前仍須拍板：無）
- HOW：`docs/roadmap/0.9.0/docs/how.md`
- WHY：`docs/roadmap/0.9.0/docs/reasoning.md`
- 開工禁區：`docs/roadmap/0.9.0/HANDOFF.md`
- 上一版：`docs/roadmap/0.8.0/INDEX.md`（`shipped`）。缺日只進 `output.missing_days`，clarify-generate 不得拿缺日清單出題
- 構想（非契約）：`docs/roadmap/backlog/clarify-one-fact.md`、`future-sight-close.md`、`node-sidecar-cleanup.md`。契約以 INDEX 為準。backlog 裡的 `## Closed`、以及「meta 有未記載欄位就留下」，INDEX 已分別改成句子只進 day、以及 YAML mapping 整檔可刪
- 產品硬契約：skills 寫 live memories；server 只做控制面與機械 I／O；無 dream staging／approve／report UI；無 setup wizard

## 總評

第 4 輪沒有新的 HIGH，也沒有新的 MEDIUM 或 LOW。提案仍然可行。DR-M4、DR-L2 已寫進已定案第 16 條與 HOW「Node sidecars」，與先前關閉的 DR-M1、DR-M2、DR-M3、DR-L1 一併維持關閉。`--store` 是 store root，只走 `<dir>/memories/nodes/`。`--yes` 只在這次已把整數寫進 `{id}.md`，或主檔本來就有 0–100 的 `activity_score` 時刪 `score.yaml`；沒有主檔或旁檔沒有整數則留下。兩個整數時採用 `score`。這仍是機械複製、clamp 與刪檔，沒有把「有沒有發生」寫成規則引擎，也沒有 dream staging、approve、report UI 或 setup wizard。

設計審查門檻通過。未關閉 HIGH 沒有。仍開放的 MEDIUM 沒有。開工前仍須拍板是空的，HANDOFF 有 paste-ready starter，非目標已寫清。Track 1–3 的配額與 history 鍵已在現碼；Track 4 的 GET 仍會刪過期項並 append pending，Track 5 的 `scripts/node-sidecars.ts` 尚未建立。那是尚未實作，不是設計缺陷。

## Findings

### DR-M1 — 半答未覆蓋的子句，之後能不能再問

- **等級：** MEDIUM
- **狀態：** 關閉（第 2 輪）
- **問題：** 已定案第 8 條寫「不要為同一題沒答到的子句再開新的 asking 檔」。`docs/reasoning.md` 又寫：後來的 distill 若鏈或節點上仍看得到缺口，可以新開一題單事實問題，只是不重複舊題幹。HOW 只禁止吸收當下補開一題，沒寫之後的 distill。
- **為何要修：** 只讀 INDEX 的 skill 會永遠不再問那個事實；只讀 reasoning 的 skill 會在下一輪重問。兩種讀法都做得出可跑的主路徑，但產品結果相反。
- **建議：** 在已定案第 8 條或 HOW 寫明時點。吸收這一次不補開題。之後的 clarify-generate 可以為鏈或節點上仍可見的那一個事實新開一題，且不得複製舊題幹來蒐集沒答的子句。
- **第 2 輪：** 已定案第 8 條與 HOW「Absorb and dismiss」都寫明：這一次吸收不補開題；之後的 clarify-generate 可就鏈或節點上仍可見的剩餘事實新開一題，且不得複製舊題幹。reasoning 同此。關閉。
- **第 4 輪：** 上述句子仍在。維持關閉。

### DR-M2 — history 核對的對象沒寫進驗收

- **等級：** MEDIUM
- **狀態：** 關閉（第 2 輪）
- **問題：** 已定案第 6 條與 HOW 都只核對「蒸餾前就在 `clarify/pending/` 的 id」：仍留在 pending，或 history 副本不是恰好一個 `absorbed_at`／`dismissed_because`，才算 gap。驗收卻寫「一份 history 檔只有其中一鍵則不是 gap；兩鍵或都沒有則是 gap」，沒有限定是本輪那些 id 的副本。
- **為何要修：** 0.3.0 起移入 history 的檔可以沒有這兩個鍵。若實作掃整個 `clarify/history/`，之後每次 distill 都會因舊檔失敗。
- **建議：** 驗收與單元測試寫明：只對蒸餾前 pending id 的 history 副本套用這個謂詞。其餘 history 檔不進本版 gate。
- **第 2 輪：** 驗收已限定「只套用在 Session A 開始前就在 `clarify/pending/` 的 id」。不在該集合的 history（含只有 `dismissed: true`）不是 gap。HOW 寫清單外的 history 忽略。關閉。
- **第 4 輪：** 驗收與 HOW 仍限定該 id 清單。維持關閉。

### DR-M3 — HTTP 刪題的 `dismissed` 與 distill 的 `dismissed_because` 並列

- **等級：** MEDIUM
- **狀態：** 關閉（第 2 輪）
- **問題：** 現況 `DELETE /clarify/asking/{id}` 把檔移到 history 並寫 `dismissed: true`（`server/vault/memories.ts`）。本版非目標寫明不改 submit、delete、aside 的 HTTP 形狀。INDEX／HOW／data-spec 更新範圍都沒點名這個既有鍵。`docs/data-spec.md` 現在的 history 列是「已吸收，或 DELETE asking 時標 dismissed 後移入」。
- **為何要修：** Track 1 若把 history 改成一律要 `absorbed_at` 與 `dismissed_because` 二擇一，會把已出貨的刪題路徑寫成違約，或誘使實作去改 HTTP。
- **建議：** `docs/data-spec.md` 的 history 列分開寫。Distill 吸收或捨棄 pending 時用 `absorbed_at` 或 `dismissed_because`。DELETE asking 仍只寫 `dismissed: true`。Program 的 gap 不檢查 DELETE 產生的 history 檔。
- **第 2 輪：** 已定案第 10 條要求 data-spec 分開寫：distill 的 history 用 `absorbed_at` 或 `dismissed_because`；`DELETE /clarify/asking/{id}` 仍只寫 `dismissed: true`，且不改該 handler。HOW 與驗收都把該刪題檔排除在 gap 之外。現行 `docs/data-spec.md` 尚未改句，屬 Track 1 待辦。關閉。
- **第 4 輪：** 現行 `docs/data-spec.md` history 列已分開兩個 distill 鍵與 `dismissed: true`。契約句子仍在。維持關閉。

### DR-L1 — 空的 `dismissed_because` 算不算有鍵

- **等級：** LOW
- **狀態：** 關閉（第 2 輪）
- **問題：** 已定案只要求 frontmatter「有」`dismissed_because`。空白或只有空白的值能否通過檔案核對，HOW 沒寫。Program 不評正文，這條可以維持「鍵存在即可」。
- **建議：** HOW 加半句：值經 trim 後必須非空，否則仍是 gap。不做也可以開工。
- **第 2 輪：** 已定案第 6 條寫缺值或只有空白不算存在。HOW 寫 `dismissed_because` 須 trim 後非空。驗收把只有空白的值列為 gap。關閉。
- **第 3 輪：** 已定案第 6 條與 HOW「Absorb and dismiss」仍在。維持關閉。
- **第 4 輪：** 仍在。維持關閉。

### DR-M4 — `score.yaml` 在沒合併成功時仍被刪掉

- **等級：** MEDIUM
- **狀態：** 關閉（第 4 輪）
- **問題：** 已定案第 16 條寫：主檔沒有合法 `activity_score` 就把旁檔的 `score` 或 `activity_score` clamp 後抄進 frontmatter；已有合法分數則不覆蓋；然後只要 `--yes` 就刪除 `score.yaml`。這段「然後刪除」沒有限定合併已發生，或主檔本來就有合法分數。`scripts/import-from-engram.ts` 呼叫的 `parseActivityScoreFromYaml` 只在主檔與旁檔都在、且讀到整數時才寫入，而且不刪旁檔。旁檔同時有兩個不同整數時，現有解析先取 `score`。HOW 只說 dry-run 不寫、`--yes` 可以改 frontmatter 並刪除。
- **為何要修：** 主路徑（有整數、主檔缺分數、或主檔已有合法分數）兩種讀法都能做。旁路會分叉：沒有 `{id}.md`、或旁檔沒有整數時，一種實作刪掉唯一副本，另一種留下。這和同版第 17 條「meta 不是 YAML mapping 就留下」相反。
- **建議：** 在已定案第 16 條寫明三件事。寫入的 frontmatter 鍵是 `activity_score`。`--yes` 只在兩種情況下刪除 `score.yaml`：這次已把整數寫進主檔，或主檔本來就有 0–100 的整數 `activity_score`。沒有 `{id}.md`，或旁檔沒有整數 `score`／`activity_score` 時，dry-run 只列相對路徑，`--yes` 留下檔案。兩個鍵都是整數時採用 `score`。
- **第 4 輪：** 已定案第 16 條與 HOW「Node sidecars」都寫了上述三件事。HOW 並寫整數 `score` 優先，否則才讀整數 `activity_score`。驗收主路徑與此不衝突。關閉。

### DR-L2 — `--store` 指到哪一層目錄

- **等級：** LOW
- **狀態：** 關閉（第 4 輪）
- **問題：** 已定案寫 `bun run nodes:sidecars -- --store <dir>`，沒寫 `<dir>` 是含 `memories/` 的 store root，還是 vault 本身。`import:engram` 的 `--to` 是 store root。
- **建議：** HOW 加半句：`--store` 是 store root，只處理 `<dir>/memories/nodes/`。不做也可以開工。
- **第 4 輪：** 已定案第 16 條與 HOW 都寫 `--store` 是 store root，只走 `<dir>/memories/nodes/`。關閉。

## 驗收對照

| 驗收 | 設計是否覆蓋 | 備註 |
|------|----------------|------|
| clarify-generate：一題一事實；0–5，5 為上限；無缺口時一句原因；已答缺口不重問 | 是 | 半答子句的「之後」已寫入已定案第 8 條與 HOW（DR-M1 關閉） |
| distill：每份 pending 吸收或捨棄並移入 history；半答只寫答到的事實 | 是 | 與「不把 clarify 檔抄進 pool」一致。核對範圍限 Session A 開始前的 pending id |
| data-spec、orchestration 不再要求至少三題或 retry | 是 | 現文已是 0–5，沒有下限與 retry。已定案第 10 條並分開 DELETE 的 `dismissed: true` |
| api.md 記載 `output.clarify_skip_reason` | 是 | 僅 Session B 新建 0 檔且回覆非空時出現；早退不寫。現文已記載，並與 `missing_days` 並列 |
| AGENTS.md 改為 0–5 | 是 | 現文已是 0–5 |
| 隔離目錄單元測試：pending 殘留、history 鍵二擇一、prompt／skill 不再要求至少三題 | 是 | 驗收已限定本輪 id，並把空白值、雙鍵、以及只有 `dismissed: true` 的舊檔寫進謂詞 |
| `bun test`、無真人記憶 | 是 | HANDOFF 已禁真人正文 |
| distill 寫明 dated／intent 的結尾、沒有證據不得標成已發生、聯絡細節不進 Standing facts | 是 | 已定案第 11–13 條與 HOW「Future-sight rewrite」。句子進 day，不留 `## Closed`。現有週／月／年 gate 仍適用於這次新建的 day，HOW 沒有豁免 |
| data-spec 寫 `kind`；api 寫 GET 只列出過期 id、不移除 | 是 | 欄位名仍是 `swept_expired`，語意改成「仍在檔內且 `anchor_end` 早於今天」。現文仍是 expire-only 刪除並 append pending，屬 Track 4 |
| 過期項仍在 zone 是 gap；`anchor_end` 在今天或之後不是；GET 不 append pending | 是 | 已定案第 14–15 條。比較用的今天與現有 distill prompt 相同，是 workspace timezone。future-sight-only 不寫 `clarify_skip_reason`，也不改 0.8.0 的 `missing_days` 演算法 |
| `nodes:sidecars` dry-run 不寫；`--yes` 補缺分數、不覆蓋合法分數、刪 mapping meta、留下非 mapping、空目錄不變 | 是 | 沒有主檔或沒有整數時留下 `score.yaml` 已寫進第 16 條與 HOW（DR-M4、DR-L2 關閉）。驗收句列主路徑；旁路以已定案為準 |

## 現碼抽樣

抽樣用來確認提案與現況能否接上。現碼尚未實作的新條款，不構成設計 HIGH。

| 位置 | 現況 | 與提案 |
|------|------|--------|
| `server/worker/pi.ts` | 只有 `CLARIFY_GENERATE_MAX = 5`，沒有 `CLARIFY_GENERATE_MIN`。新建 0 檔要非空回覆，超過 5 失敗。Session B 只在蒸餾前 pool 列數加 pending 檔數大於 0、且 Session A 成功後才開。pool 與 clarify 都是 0 時整份 distill 早退 | Track 1–3 的配額已接上。早退尚未因 zone 裡的過期項改開 Session A，屬 Track 4 |
| 同檔 Session A | 同一 session 最多 continue 一次，仍有 `distillGaps` 則失敗，且不跑 Session B | HOW 的「continue 一次再失敗」是沿用這條，不是新的寫作迴圈 |
| `server/worker/distill-gate.ts` | 蒸餾前 pending id 若仍在 pending、不在 history，或 history 不是恰好一個非空 `absorbed_at`／`dismissed_because`，即 gap。不讀 future-sight | history 謂詞已接上（DR-M2 關閉）。過期項仍留在 zone 的 gap 尚未進這個檔，屬 Track 4 |
| `server/jobs/index.ts`、`docs/api.md` | distill 成功輸出可含 `text`、`missing_days`、`clarify_skip_reason` | 欄位已記載。GET future-sight 現文仍寫過期項移除並 append pending |
| `.agents/skills/engram-clarify-generate/SKILL.md`、`docs/data-spec.md`、`docs/architecture/orchestration.md`、`AGENTS.md` | 題數為 0–5，沒有下限與 retry。data-spec history 列分開 distill 兩鍵與 `dismissed: true` | Track 1 的契約句已落地。本版沒有把 dream staging、approve 或 report UI 加回來 |
| `server/future-sight/index.ts` | 沒有 `kind`。`sweepFutureSight` 在 `anchor_end < today` 時刪條目，並把截斷後的條目文字 append 到 pending。`today` 來自 vault timezone | 提案改為 parse／render 保留 `kind`，GET 不刪、不 append。`swept_expired` 改列仍留在檔內的過期 id。日期比較仍是機械條件，三種結尾留在 skill。現碼這段與提案相反，屬 Track 4 |
| `server/nodes/score.ts`、`scripts/import-from-engram.ts` | 整數 `score` 優先於 `activity_score`，clamp 後寫入主檔鍵 `activity_score`。沒有主檔、或沒有整數，則跳過，且不刪 `score.yaml` | 提案的 `scripts/node-sidecars.ts` 尚未建立。刪除條件已在第 16 條寫死（DR-M4 關閉），與 import「不刪旁檔」是兩支腳本。Distill 仍不更新分數 |

判斷仍在 skill：缺口種類、半答寫哪一句、捨棄理由、以及未來視這條是已發生、改期還是放棄。Program 沒有分類表。Sidecar 腳本只做複製、clamp 與刪檔。這與非目標及硬契約一致。

## 修復追蹤

| ID | 等級 | 狀態 | 關閉條件 |
|----|------|------|----------|
| DR-M1 | MEDIUM | 關閉（第 2 輪） | INDEX 或 HOW 寫明半答子句在「這一次吸收」與「之後的 generate」各做什麼 |
| DR-M2 | MEDIUM | 關閉（第 2 輪） | 驗收寫明只核對蒸餾前 pending id 的 history 副本 |
| DR-M3 | MEDIUM | 關閉（第 2 輪） | data-spec（及必要時 HOW）分開 distill 的兩個鍵與 DELETE 的 `dismissed: true` |
| DR-L1 | LOW | 關閉（第 2 輪） | 可選：空白 `dismissed_because` 仍算 gap |
| DR-M4 | MEDIUM | 關閉（第 4 輪） | `--yes` 僅在已寫入 `activity_score`、或主檔本有合法分數時刪 `score.yaml`；沒有主檔或沒有整數則留下 |
| DR-L2 | LOW | 關閉（第 4 輪） | `--store` 指 store root 下的 `memories/nodes/` |

第 4 輪沒有新增 ID。未關閉 HIGH：無。仍開放的 MEDIUM：無。

## 歷審摘要

- **2026-11-17（第 1 輪）：** 配額、跳過句、吸收／捨棄分工與 0.8.0 缺日清單可以接上，無 HIGH，提案可行。開放 DR-M1、DR-M2、DR-M3、DR-L1。
- **2026-11-17（第 2 輪）：** 四項都已寫進 INDEX 與 HOW，全部關閉。沒有新 finding。設計審查門檻通過，可以開工。現碼與現行 data-spec／api 仍是舊配額，留給 Track 實作。
- **2026-11-17（第 3 輪）：** 舊四項仍關閉。future-sight 改寫與 sidecar 腳本接得上硬契約，無 HIGH，提案可行。DR-M4 仍開，門檻未通過。DR-L2 不擋開工。
- **2026-11-17（第 4 輪）：** DR-M4、DR-L2 已寫進已定案第 16 條與 HOW，全部關閉。沒有新 finding。設計審查門檻通過。Track 4、5 現碼仍是舊行為，留給實作。
