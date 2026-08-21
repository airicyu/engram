# 0.41 — 鎖、快照、git（HOW）

← [INDEX](../INDEX.md) · 做什麼以 INDEX 已定案為準。

## 開跑凍結（偽碼）

取得 run mutex 且無 pending 之後、**spawn agent 之前**：

```text
const poolEntries = await withCaptureLock(async () => {
  return structuredClone(await readPoolEntries()); // 拷貝後釋放
});
const clarifyPending = await withClarifyWriteLock(async () => {
  return structuredClone(await listPendingItems()); // 拷貝後釋放
});
// 禁止持上述任一鎖去 await agent／rollup
if (poolEntries.length === 0 && !(await hasRollupCatchupWork())) throw nothing_to_dream;
scope = poolEntries.map(e => e.id);
await writeFile(dreams/runs/{id}.input.json, { pool_snapshot: poolEntries, clarify_snapshot: clarifyPending });
// yaml：scope、clarify_pending_snapshot_ids；正文只在 input.json
```

鎖順序：先 capture 再 clarify（若將來合併成一次函式）。現分兩段亦可：先 pool 鎖讀完釋放，再 pending 鎖讀完釋放；兩段之間極短，可被一筆 activity 插入——**可接受**（該筆不進 pool 快照，符合「開跑那一刻」略寬的視窗）。不要在兩段之間跑 agent。

`buildDreamContext`、`finalizeDreamReport`、`assertInvolvementsValidForPending`、rollup 若需 events：**只用** `pool_snapshot`。禁止 `readPoolEntriesForScope(scope)`。

Distill：只用 `clarify_snapshot` 正文。

## HTTP：誰 409

| 請求 | extract 中 | deploy 中 | pending_review 閒置 |
|------|------------|-----------|---------------------|
| `POST /activities` | 201（capture 鏈；deploy 時可能排在清 S／git 後才完成，仍是 201） | 同左 | 201 |
| `POST /attachments/uploads` | 201 | 201 | 201 |
| `DELETE …/uploads/tmp` | 現行不因 dream lock 擋；**本版不改** | 同左 | 同左 |
| clarify 寫 | 201／200（clarify 鏈） | 同左 | 同左 |
| `POST /dreams/run` | 409 `dream_locked` | 409 `dream_locked` | 409 `pending_review` |
| approve／discard／retry／amend | 409 `dream_locked` | 409 `dream_locked` | 允許 |

從 `handleActivities`／`handleUpload`／clarify **寫入** handler 刪除 `isLocked()→dream_locked`。

## Pipeline 寫 clarify

```text
await withClarifyWriteLock(async () => {
  // runClarifyGenerate 落盤 asking
  // 或失敗時 deleteAskingFile(本 job 已寫 ids) — 勿刪使用者其他 asking
});
```

Approve：

```text
await withCaptureLock(async () => {
  await withClarifyWriteLock(async () => {
    await commitDirtyMemorySnapshot(...); // git add memories
    // commitDraft L2 可在此或鎖外：L2 無人經 API 寫；若鎖外須確定不 add 正在寫的 jsonl
    await archivePendingToHistory(clarifyScopeIds);
    await clearShortTermMemoryScope(scope); // 清 pool 只需 capture；可把 archive 放內層、clear 仍在外層 capture 內
  });
});
```

`clearShortTermMemoryScope` 必須在 `withCaptureLock` **內部** `readPoolEntries`＋`persistPool`，不要鎖外先讀。

## Agent 可讀範圍

可讀：L2／chain／future-sight、draft、report、`dreams/runs/{id}.input.json` 與凍結 context。

不可讀（dream／distill／rollup 硬擋）：`pool.jsonl`、`events.jsonl`、`memories/clarify/pending/**`。

Ask **維持**可讀 pool。

## 現況對照（改前易漏）

- `runDream`：`listPoolEventIds()` 後二讀 live pool。
- Distill：rollup 後 `listPendingIds()`。
- Report：`readPoolEntriesForScope`。
- `handleActivities` 首行 `isLocked()`。
- Generate／rollback asking 未與人寫入同鎖。
- Approve：clear／archive／git 未進對應寫入鎖。
- `self-test.ts` assert lock 時 activities／aside 409。
- Integration skill：409 backoff。
