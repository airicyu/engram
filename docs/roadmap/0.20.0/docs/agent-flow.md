# 0.20.0 — Generic agent flow＋目錄結構

← [INDEX](../INDEX.md) · 閘門：[phase-gates.md](./phase-gates.md#phase-7--generic-agent-flow目錄)

> **Phase 7 HOW。** 產品 HTTP／記憶語意不變。先收斂「怎麼叫 agent」，再依流程分夾；禁止把 dream／approve 業務編排塞進 generic 層。

---

## 1. 目標分層

```
Domain（業務）                         Generic flow（機械）
─────────────────                      ──────────────────
dream/execute、approve…                agent/flow：AgentJob → spawn → 檢查交付檔
seek/ask-run                           agent/providers：Claude／Cursor（＋mock）
dream/rollup cascade 編排              agent/shared：subprocess、write-policy、prompt…
agent/dream｜ask｜rollup：
  gather／選 prompt／render、
  約定可寫根與交付 path、
  read＋parse＋業務後處理
```

**一句話：** Domain 決定「叫誰、寫哪、讀回什麼意思」；Invoker 只負責「用哪個 CLI 把這次 job 跑完」。

### Generic 可放

| 項目 | 說明 |
|------|------|
| `AgentJob` | 已 render 的 prompt、`cwd`、`writePolicy`、`processKey`、`onPid?`、`requireFiles?` |
| `AgentInvoker.run(job)` | 組 CLI argv、呼叫 `runAgentCommand`、結束後確認 `requireFiles` 存在 |
| write-policy 套用 | Claude allowed／disallowed tools；Cursor add-dir／sandbox 旗標 |
| log／PID | 與現況等價的 spawn／result／cancel 掛點 |

### Generic 不可放

| 項目 | 應留在 |
|------|--------|
| 組 `DreamContext`、凍結 scope、prepare draft | `dream/*` |
| Ask job 狀態機、輪詢、cancel HTTP | `seek/ask-run`＋store tmp |
| Rollup cascade（哪幾層、plan→write 次數） | `dream/rollup.ts` |
| Parse Ask JSON／plan JSON、strip writer preamble | `agent/ask`／`agent/rollup` |
| Report finalize、involvements、score、approve／git | `dream/*` |
| 「stdout 當答案」 | **禁止**（交付真相仍是檔案） |

---

## 2. 介面契約（名稱可微調，語意不可弱）

```ts
/** One spawn. Deliverable is on disk; stdout is not the source of truth. */
export type AgentJob = {
  processKey: string;
  prompt: string;           // domain 已 render 完畢
  cwd: string;
  writePolicy: WritePolicy; // 既有 Phase 1 政策型別
  onPid?: (pid: number) => void | Promise<void>;
  /** After process exits 0: each path must exist or run() throws */
  requireFiles?: string[];
};

export interface AgentInvoker {
  run(job: AgentJob): Promise<void>;
}
```

- **Ask：** `requireFiles = [resultPath]` → domain `read`＋`parse`。
- **Rollup plan：** `requireFiles = [plan.json]` → domain parse。
- **Rollup write：** `requireFiles = [output_path]` → domain strip／品質檢查。
- **Dream：** `requireFiles` 至少含 `report_path`；draft 多檔由 domain／finalize 負責，**不要**逼 generic 枚舉整棵 draft。

Factory：`createAgentInvoker()`（依 `ENGRAM_AGENT`）供三條路徑共用；`createDreamRunner`／`createAskRunner`／`createRollupAgent` 可保留為 **薄 facade**（對內呼叫 invoker＋domain 包裝），避免一次改爆所有 import。

Mock：`mock-*` mode 仍可走「不 spawn 的 domain mock」；若加 `MockInvoker`，須遵守同一 `WritePolicy`（對齊 Phase 1 惡意寫 live 測試）。

---

## 3. 目標目錄（直觀、按流程分組）

實作完成後，`server/src/agent/` **應**接近下列樹（檔名允許小幅調整，**分組鍵不可改**：flow／providers／shared／dream／ask／rollup）：

```
server/src/agent/
  factory.ts                 # resolveAgentMode；createAgentInvoker；既有 create* facade
  flow/
    types.ts                 # AgentJob、AgentInvoker
    run-job.ts               # 可選：共用 requireFiles 檢查等（若非塞進各 provider）
  providers/
    claude.ts                # ClaudeInvoker（唯一 Claude CLI argv 知識）
    cursor.ts                # CursorInvoker
  shared/
    subprocess.ts
    write-policy.ts
    write-policy.test.ts
    prompt-template.ts
    temp-context.ts
    log.ts                   # 現 extract-log 可改名或保留檔名於 shared/
    cursor-envelope.ts       # 若僅 Cursor 用，也可放 providers/；勿留在根平鋪
  dream/
    runner.ts                # 原 claude-code／cursor-cli 的 domain 包裝：temp context、render、invoker.run
    mock.ts                  # dream mock runners
    types.ts                 # DreamContext 等（或 re-export）
  ask/
    runner.ts                # 原 ask-claude／ask-cursor 合併為「選 invoker＋render＋read」
    mock.ts
    types.ts
    build-prompt.ts          # 原 ask-invoke 的 prompt 部分
    parse.ts
    process.ts               # kill／processKey
  rollup/
    agent.ts                 # CliRollupAgent：plan／write 呼叫 invoker
    mock.ts
    parse.ts                 # plan JSON／strip preamble（自肥檔拆出）
```

### 擺放原則

1. **第一層＝怎麼用 agent**（flow／providers／shared）＋**哪條業務**（dream／ask／rollup），不要再用 `ask-` 前綴平鋪根目錄。
2. **Claude／Cursor 的 CLI 差異只住在 `providers/`**；業務檔禁止再複製一長串 `cmd = [bin, "-p", …]`。
3. **產品編排不搬進 `agent/`**：`dream/execute.ts`、`seek/ask-run.ts`、`dream/rollup.ts`（cascade）留原處；它們 import `agent/*`。
4. **一次搬一個子樹**（建議：先引入 `flow`＋`providers` 並讓 Ask 改走 invoker → Rollup → Dream → 再刪舊平鋪檔）。每步跑 Phase 7 閘門子集或全套 `test:phases`。
5. 根目錄 `agent/*.ts` 平鋪在 Phase 7 結束後應 **清空或僅剩 `factory.ts`**（加極薄 re-export 過渡期可，出貨前刪掉誤導性舊路徑）。

### 刻意不搬

| 路徑 | 原因 |
|------|------|
| `server/src/dream/*`、`seek/*`、`store/*`、`api/*` | 已按產品邊界切；本 Phase 不重做整棵 server |
| `server/prompts/*.md` | 可維持現位；domain 用 path 指向即可 |
| `web/` | Phase 5 已處理；本 Phase 不動 |

---

## 4. 遷移步驟（建議順序）

| Step | 做什麼 | 驗收 |
|------|--------|------|
| A | 新增 `flow/types`＋`providers/claude|cursor`；行為對齊現況 write-policy | unit 或既有 write-policy 測試仍過 |
| B | Ask domain 改呼叫 `createAgentInvoker().run`；刪／瘦身 `ask-claude`／`ask-cursor` 重複 argv | Ask 快樂路徑＋mock ask 測試過 |
| C | Rollup `CliRollupAgent` 改走 invoker；拆 `parse` 若檔仍過肥 | rollup phase（self-test）過 |
| D | Dream runner 改走 invoker；刪 `claude-code`／`cursor-cli` 重複 | dream／approve 主路徑過 |
| E | 實體搬檔至目標樹；修全庫 import；清根目錄平鋪 | G7 全過；無殘留雙實作 |

禁止：只搬家不抽 invoker（結構變了、重複還在）；或抽 invoker 卻把 cascade／approve 塞進 `flow/`。

---

## 5. 與 Phase 1／4 的關係

- Phase 1 **write-policy** 保留；Invoker **必須**吃同一政策（不可倒退整庫可寫）。
- Phase 4 **factory** 保留並延伸：`createAgentInvoker` 為核心；舊 `createDreamRunner` 等可當 facade。
- Phase 4 已拆的 `dream/execute|approve|context` **不要**為本 Phase 再大搬。

---

## 非本檔範圍

- 新 agent 供應商（除 claude／cursor／既有 mock）
- 改 prompt 產品語意或 draft 佈局
- Shared Zod monorepo、approve journal
