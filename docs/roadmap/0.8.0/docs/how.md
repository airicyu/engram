# 0.8.0 HOW

## 進行中週記

「現在」仍是 prompt 給的當地今天；沒有該行時用 `workspace.yaml` timezone。ISO 週為週一至週日。檔名公式不變。

本批任一事件的當地日期落在尚未結束的當週時，`engram-distill` 讀該週已有日檔（不只本批），整份寫入同一週記路徑。檔頭：

```markdown
---
open: true
---
## 題材

本週至今……
```

`open: true` 是唯一機器標記。標題仍是題材，不是週號。正文可以寫「本週至今」，但收成時必須拿掉這類未完成口吻與過程旁白。

週已結束且本批碰到該週（或該週檔仍帶 `open: true` 且本批寫過其日檔）：再整份取代，**不要** frontmatter `open`。取捨規則與現有週記相同，不是七篇日文串接。

使用者這次明說寫本週、而週尚未結束：同樣整份取代，並保留 `open: true`。

進行中的月、年：不新建、不改寫，除非使用者這次明說要月記或年記。

寫已結束月記時，跳過 `open: true` 的週檔，改讀那些日子的 day。年記仍只優先讀月記。

Program 不從使用者語句判斷這次有沒有點名寫週。點名仍由 skill 履行。檔案核對只看 day 是否在本批被寫過。

## Program 核對

沿用蒸餾前後的檔案快照（mtime）。新增的機械條件：

- 本批寫過的 day 落在尚未結束的 ISO 週 → 該週檔 mtime 較新，且檔案含 frontmatter `open: true`。
- 本批寫過的 day 落在已結束的 ISO 週 → 該週檔 mtime 較新，且檔案不含 `open: true`。
- 不為進行中的月、年新增「必須寫檔」條件。

不含散文評分。

## 缺日

派 `engram-distill` 之前，program 只讀 `pool/pending.jsonl`。可解析的 `ts` 轉成當地 `YYYY-MM-DD`；解析失敗的列跳過。整份 distill job 成功之後才寫 `output.missing_days`；失敗不寫這個欄位。`output.text` 維持不變。至少有一個可解析日期時，檢查 `[min, max]` 內每個日曆日的 day 檔，缺的升序放入陣列。沒有可解析日期時（早退，或池空而只有 clarify）成功的 job 寫 `[]`。

不讀 clarify 來擴大區間。不建立 day 檔。不把清單寫進 `memories/`。`engram-clarify-generate` 的 prompt 不附這份清單，skill 正文禁止拿「哪幾天沒日記」出題。

## Ask

讀週檔時若 YAML frontmatter 有 `open: true`，回答裡說明這是進行中的本週短稿。已無該標記的週檔維持現有讀法。
