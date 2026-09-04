# 0.46.0 HANDOFF

← [INDEX](./INDEX.md)

**產品一句：** 第四個 live CLI＝`ENGRAM_AGENT=pi`（binary `pi`）；approve 前仍不可寫 live memories。

**讀檔順序：** `AGENTS.md` → 本檔 → `INDEX.md` → `docs/pi-provider.md` → `docs/reasoning.md`。對照 `docs/roadmap/0.23.0/`（Codex 加 provider 的厚度）。

**Track：** A（PiInvoker＋config＋factory＋單測）→ B（wizard＋文件＋version／changelog）。

**禁區：** 改 prompts／HTTP／UI／store_version；傳 `--model`；允許 bash；`pi-agent` 當合法 mode。

**完成時：** INDEX 驗收全勾；`cd server && bun test src/agent/providers/pi.test.ts src/config.test.ts`；`bun run test:phases`；**Do not commit unless the user asks**。

**對使用者回應：** 繁體中文書面語。

---

## Paste-ready starter prompt

```text
你是 0.46.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.46.0/HANDOFF.md → INDEX.md 與其連結。
依 Track A 再 Track B 做。禁非目標。INDEX 已定案勿再問。
不要 commit，除非使用者要求。
```
