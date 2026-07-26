# 0.13.0 Reasoning

← [INDEX](../INDEX.md)

做什麼以 [INDEX](../INDEX.md) 為準。本檔只留 **為何**、反例、否決過的方案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 為何要 per-workspace 檔，而不是只靠 `.env`

同一台機器可有多個 data 目錄（真人庫、`data-demo`、測試庫）。它們是**分開的記憶世界**，timezone／寫入語言應跟著資料走；搬移／備份 `ENGRAM_HOME` 時偏好不丟。  
進程級 `.env` 仍管埠、agent runner、虛擬時鐘開關——那些不是「這一庫的記憶語意」。

---

## 為何語言預設是 `en`，且永遠有有效值

曾考慮「未設定＝不注入、跟 0.12 一樣鬆」。否決原因：行為不可預測，驗收難寫，多庫並存時更容易混語。  
採用 **workspace → `ENGRAM_MEMORY_LANGUAGE` → `en`**：永遠三碼之一；無檔時明確為英文。  
這是對 0.12 的**有意行為差**（0.12 未約束），INDEX 驗收已標明。

只允許 `zh-Hant`｜`zh-Hans`｜`en`：避免用戶自由輸入造成 C1 拒啟或模型收到垃圾 tag。Wizard UI 顯示人類可讀名，內部才用 code。

---

## 為何壞設定要拒啟（C1），不要 warn 後忽略

Timezone 錯會讓日曆日、chain 關帳、future-sight sweep 全面偏一天；silent fallback 比起不來更難查。  
未知鍵拒啟可及早發現 typo／版本漂移，避免「以為設了其實沒讀到」。

---

## 為何不做 runtime 設定 API／Workbench 設定頁

本版要的是 **檔案跟著庫** + **首次 bootstrap**。日常改偏好：編輯 yaml 或重跑 setup（問覆寫）即可。  
若做 `GET|PUT /workspace/config`，會變成第二條寫入路徑，還要定義與 boot-time 快取／熱重載的關係——範圍膨脹。標非目標。

Wizard ≠ 日常設定 UI：wizard 是一次性寫盤工具，成功即退出。

---

## 為何 timezone 禁止「只填 +8」當最終值

同一 offset 對應多個 IANA（例如 `+08:00` → Hong Kong／Shanghai／Singapore），DST 與日曆語意不同。自由打 offset 也易打錯，卻會通過「看起來像數字」的校验。  
Wizard：偵測 IANA + 列表點選；若將來用 offset，只可當**篩選候選**，仍必須選中一個 IANA 才寫入。

---

## 為何不回溯改舊 L2／L0

L0 是 input log；改寫等於竄改事件。  
舊 L2／day 文是歷史理解；批量「翻譯成新語言」會弄髒時間線與人審過的內容。  
高階 week／month／year 本來就會整段 revise——重寫時用**當下**語言即可，不必掃庫翻譯。

---

## 為何 setup 用隨機 port + 同源 static，且寫完才 200

- **隨機 port**（`port: 0`）：避免與 8787／8788／本機其他服務碰撞。同源 serve + 相對 `POST /setup` 時，HTML **不需要**知道 port；opener／console 用 `server.url` 即可。
- **否決純 `file://`**：瀏覽器無法可靠寫入 repo；`file://` + `fetch` localhost 還有 CORS／瀏覽器限制。仍用 self-contained HTML，只是經 mini server 送出。
- **否決「先 200 再背景寫檔」**：與「問覆寫／校验失败要讓 UI 知道」矛盾。改為校验＋覆寫閘＋寫檔成功才 200；成功後 console + `stop()`。

---

## 為何堅持 Bun 原生 Server／Shell

Wizard 需求（random port、`server.url`、serve `Bun.file`、graceful `stop`、跑 `bun install`／opener）在 [Bun.serve](https://bun.com/docs/runtime/http/server) 與 [Bun Shell](https://bun.com/docs/runtime/shell) 已有一等支援。自造一層容易重複造輪子且較難跨平台。實作 agent 應先讀官方再寫 `setup-wizard/`。

---

## Data home 為何不做原生 folder picker

瀏覽器安全模型下，目錄挑選器不保證能得到可寫入 `ENGRAM_HOME` 的穩定絕對路徑字串。本版：推薦相對路徑按鈕 + 手動貼絕對路徑。Desktop shell 另議。
