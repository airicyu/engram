const API = "/api";

/** @typedef {{
 *   engram_home?: string,
 *   lock: boolean,
 *   l1_empty: boolean,
 *   pending_dlq_count: number,
 *   dream_status: string,
 *   dream_pending?: { dream_run_id: string, scope_count: number, patch_count: number } | null,
 *   dream_job?: object | null,
 * }} Status */

const state = {
  /** @type {Status | null} */
  status: null,
  /** @type {{ present: boolean, dream_run_id?: string|null, scope?: string[], report?: string|null, draft_summary?: object|null } | null} */
  pending: null,
  scene: "capture",
  dreaming: false,
  pollTimer: null,
};

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

function setMsg(el, text, kind = "") {
  el.textContent = text || "";
  el.classList.remove("is-error", "is-ok");
  if (kind) el.classList.add(kind === "error" ? "is-error" : "is-ok");
}

function lightState(status) {
  if (!status) return "unknown";
  if (status.lock) return "dreaming";
  return status.dream_status || "unknown";
}

function lightLabel(status) {
  if (!status) return "離線";
  if (status.lock) return "dreaming";
  return status.dream_status;
}

function renderStatusLight() {
  const s = state.status;
  const dot = document.querySelector(".status-dot");
  const label = $("status-label");
  const light = $("status-light");
  const key = lightState(s);
  if (dot) dot.setAttribute("data-state", key);
  label.textContent = lightLabel(s);
  light.title = s
    ? `lock=${s.lock} · L1 ${s.l1_empty ? "empty" : "present"} · DLQ ${s.pending_dlq_count}`
    : "無法連線 Engram API";
}

function adviceFor(status) {
  if (!status) return "無法取得狀態。確認 server 是否在 :8787 運行。";
  if (status.lock) return "Dream／commit 進行中——請稍候。pending_review 期間仍可 Capture。";
  if (status.dream_status === "pending_review") {
    return "有待審 dream：讀報告後 Approve（寫入 L2 並清本輪 L1）或 Discard／再次 Dream（取代）。";
  }
  if (status.dream_status === "l1_clear_pending") {
    return "已 commit 但 L1 清理未完成——再按一次 Approve 只重試清 L1。";
  }
  if (status.dream_status === "dream_incomplete") {
    return "上次 extract／materialize 失敗（L1 仍保留）。可重試 Dream。";
  }
  if (status.dream_status === "dead_letter_pending") {
    return `有 ${status.pending_dlq_count} 筆 DLQ 待人工處理；仍可繼續 Dream。`;
  }
  if (status.l1_empty) {
    if (status.dream_status === "never_dreamed") {
      return "尚無短時記憶。先到 Capture 寫入幾筆。";
    }
    return "L1 已空——沒有需要整理的短時記憶。";
  }
  return "L1 有內容，可以 Dream 產出待審報告。";
}

function renderPendingPanel() {
  const panel = $("pending-panel");
  const p = state.pending;
  if (!p?.present) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const ds = p.draft_summary;
  const meta = [
    p.dream_run_id ? `run ${p.dream_run_id}` : null,
    p.scope ? `scope ${p.scope.length}` : null,
    ds ? `draft ${ds.entry_count} paths` : null,
    Array.isArray(p.patches) ? `patches ${p.patches.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  $("pending-meta").textContent = meta;
  const report = $("pending-report");
  report.textContent = p.report?.trim() || "（無報告）";
  report.classList.toggle("is-empty", !p.report?.trim());
}

function renderConsolidate() {
  const s = state.status;
  $("st-dream").textContent = s ? s.dream_status : "—";
  $("st-lock").textContent = s ? String(s.lock) : "—";
  $("st-l1").textContent = s ? (s.l1_empty ? "empty" : "present") : "—";
  $("st-dlq").textContent = s ? String(s.pending_dlq_count) : "—";
  $("status-advice").textContent = adviceFor(s);
  renderPendingPanel();

  const btn = /** @type {HTMLButtonElement} */ ($("dream-run"));
  const pending = s?.dream_status === "pending_review";
  const clearRetry = s?.dream_status === "l1_clear_pending";
  btn.disabled = !s || s.lock || state.dreaming || (s.l1_empty && !pending && !clearRetry);
  if (s?.lock || state.dreaming) {
    btn.textContent = "Dreaming…";
  } else if (pending) {
    btn.textContent = "Dream（取代）";
  } else {
    btn.textContent = "Dream";
  }

  const approve = /** @type {HTMLButtonElement} */ ($("dream-approve"));
  const discard = /** @type {HTMLButtonElement} */ ($("dream-discard"));
  const canReview = !!(pending || clearRetry) && !s?.lock && !state.dreaming;
  if (approve) approve.disabled = !canReview && !clearRetry;
  if (discard) discard.disabled = !pending || !!s?.lock || state.dreaming;
  if (approve && clearRetry) approve.disabled = !!s?.lock || state.dreaming;
}

function applyCaptureLock() {
  // Only lock capture while extract/commit holds the dream lock — not during pending_review
  const locked = !!(state.status?.lock || state.dreaming);
  const raw = /** @type {HTMLTextAreaElement} */ ($("capture-raw"));
  const refs = /** @type {HTMLInputElement} */ ($("capture-refs"));
  const submit = /** @type {HTMLButtonElement} */ ($("capture-submit"));
  raw.disabled = locked;
  refs.disabled = locked;
  submit.disabled = locked;
  $("capture-lock-hint").hidden = !locked;
}

async function refreshPending() {
  const { ok, data } = await api("/dream/pending");
  if (!ok) {
    state.pending = null;
    return;
  }
  state.pending = data;
}

async function refreshStatus() {
  const { ok, data } = await api("/status");
  if (!ok || data?.error === "engram_unreachable") {
    state.status = null;
    state.pending = null;
    renderStatusLight();
    renderConsolidate();
    applyCaptureLock();
    return false;
  }
  state.status = data;
  if (data.dream_status === "pending_review" || data.dream_status === "l1_clear_pending") {
    await refreshPending();
  } else {
    state.pending = { present: false };
  }
  renderStatusLight();
  renderConsolidate();
  applyCaptureLock();
  schedulePoll();
  return true;
}

function schedulePoll() {
  if (state.pollTimer) clearTimeout(state.pollTimer);
  const locked = !!(state.status?.lock || state.dreaming);
  const pending = state.status?.dream_status === "pending_review";
  const ms = locked ? 2000 : pending ? 5000 : 8000;
  state.pollTimer = setTimeout(async () => {
    await refreshStatus();
  }, ms);
}

function formatL1(packet) {
  if (!packet?.l1) return { text: "（無資料）", empty: true };
  const { present, summary, node_notes } = packet.l1;
  if (!present) {
    return { text: "（L1 已清空）", empty: true };
  }
  const parts = [];
  if (summary?.trim()) {
    parts.push(summary.trim());
  } else {
    parts.push("（summary 空白）");
  }
  const notes = node_notes && Object.keys(node_notes).length
    ? Object.entries(node_notes)
        .map(([id, md]) => `### ${id}\n${md || "（空）"}`)
        .join("\n\n")
    : null;
  if (notes) parts.push("---\nnode notes\n\n" + notes);
  return { text: parts.join("\n\n"), empty: false };
}

async function refreshL1() {
  const el = $("l1-content");
  const { ok, data } = await api("/recall");
  if (!ok) {
    el.textContent = data?.message || data?.error || "無法載入 L1";
    el.classList.add("is-empty");
    return;
  }
  const { text, empty } = formatL1(data);
  el.textContent = text;
  el.classList.toggle("is-empty", empty);
}

function switchScene(name) {
  state.scene = name;
  document.querySelectorAll(".scene-btn").forEach((btn) => {
    const on = btn.getAttribute("data-scene") === name;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".scene").forEach((sec) => {
    const on = sec.getAttribute("data-scene") === name;
    sec.classList.toggle("is-active", on);
    /** @type {HTMLElement} */ (sec).hidden = !on;
  });
  if (name === "capture") refreshL1();
  if (name === "consolidate") refreshStatus();
}

function parseNodeRefs(raw) {
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function onCapture(e) {
  e.preventDefault();
  const msg = $("capture-msg");
  const rawEl = /** @type {HTMLTextAreaElement} */ ($("capture-raw"));
  const refsEl = /** @type {HTMLInputElement} */ ($("capture-refs"));
  const raw = rawEl.value.trim();
  if (!raw) {
    setMsg(msg, "請輸入內容", "error");
    return;
  }
  if (state.status?.lock) {
    setMsg(msg, "正在整理記憶，暫時無法寫入。", "error");
    return;
  }

  const body = { raw, source: "web" };
  const refs = parseNodeRefs(refsEl.value);
  if (refs.length) body.node_refs = refs;

  setMsg(msg, "寫入中…");
  const { ok, status, data } = await api("/capture", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (status === 409 || data?.error === "dream_locked") {
    setMsg(
      msg,
      data?.message || "正在整理記憶（dream_locked），請稍後再試。",
      "error",
    );
    await refreshStatus();
    return;
  }
  if (!ok) {
    setMsg(msg, data?.message || data?.error || `寫入失敗 (${status})`, "error");
    return;
  }

  setMsg(msg, `已寫入 ${data.event_id}`, "ok");
  rawEl.value = "";
  await Promise.all([refreshStatus(), refreshL1()]);
}

async function onDreamRun() {
  const msg = $("dream-msg");
  const result = $("dream-result");
  const body = $("dream-result-body");

  if (state.status?.lock || state.dreaming) {
    setMsg(msg, "Dream 已在進行中。", "error");
    return;
  }
  if (state.status?.l1_empty && state.status?.dream_status !== "pending_review") {
    setMsg(msg, "L1 為空，無需 Dream。", "error");
    return;
  }

  state.dreaming = true;
  applyCaptureLock();
  renderConsolidate();
  setMsg(msg, "Dream 執行中（可能需要數分鐘）…");

  const { ok, status, data } = await api("/dream/run", { method: "POST" });

  if (status === 409) {
    state.dreaming = false;
    result.hidden = false;
    body.textContent = data?.message || data?.error || "rejected";
    setMsg(msg, data?.message || data?.error || "dream rejected", "error");
    await refreshStatus();
    return;
  }

  if (!ok) {
    state.dreaming = false;
    result.hidden = false;
    body.textContent = JSON.stringify(data, null, 2);
    setMsg(msg, data?.message || data?.error || `失敗 (${status})`, "error");
    await refreshStatus();
    return;
  }

  setMsg(msg, "已提交 — 等待 pending_review…", "ok");
  body.textContent = `job_id: ${data.job_id}\n${data.message || ""}`;
  result.hidden = false;

  // Poll until lock clears / pending_review or failed
  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1500));
    await refreshStatus();
    if (!state.status?.lock) break;
  }
  state.dreaming = false;
  renderConsolidate();

  if (state.status?.dream_status === "pending_review") {
    setMsg(msg, "待審報告已就緒。", "ok");
  } else if (state.status?.dream_job?.status === "failed") {
    setMsg(
      msg,
      `失敗（${state.status.dream_job.phase || "?"}）：${state.status.dream_job.error || ""}`,
      "error",
    );
  }
  if (state.scene === "capture") await refreshL1();
}

async function onDreamApprove() {
  const msg = $("dream-msg");
  setMsg(msg, "Approve 中…");
  const { ok, status, data } = await api("/dream/approve", {
    method: "POST",
    body: "{}",
  });
  if (status === 409) {
    setMsg(msg, data?.message || data?.error || "無法 approve", "error");
    await refreshStatus();
    return;
  }
  if (!ok) {
    setMsg(msg, data?.message || data?.error || `失敗 (${status})`, "error");
    return;
  }
  const note = data.empty_patches
    ? "已批准：無 L2 寫入，已清本輪 L1。"
    : data.l1_clear_pending
      ? "已 commit；L1 清理未完成，請再 Approve 一次。"
      : `已寫入 ${data.committed?.length ?? 0} 個路徑並清本輪 L1。`;
  setMsg(msg, note, data.l1_clear_pending ? "error" : "ok");
  $("dream-result").hidden = false;
  $("dream-result-body").textContent = JSON.stringify(data, null, 2);
  await refreshStatus();
  if (state.scene === "capture") await refreshL1();
}

async function onDreamDiscard() {
  const msg = $("dream-msg");
  setMsg(msg, "Discard 中…");
  const { ok, status, data } = await api("/dream/discard", {
    method: "POST",
    body: "{}",
  });
  if (!ok) {
    setMsg(msg, data?.message || data?.error || `失敗 (${status})`, "error");
    await refreshStatus();
    return;
  }
  setMsg(msg, "已丟棄 pending（L1／L2 未改）。", "ok");
  await refreshStatus();
}

function renderRecallPacket(data) {
  const l1 = formatL1(data);
  const l1El = $("recall-l1");
  l1El.textContent = l1.text;
  l1El.classList.toggle("is-empty", l1.empty);

  const chainEl = $("recall-chain");
  const chain = data.chain?.content?.trim();
  if (chain) {
    const day = data.chain.day_id ? `# ${data.chain.day_id}\n\n` : "";
    chainEl.textContent = day + chain;
    chainEl.classList.remove("is-empty");
  } else {
    chainEl.textContent = "（無 day chain）";
    chainEl.classList.add("is-empty");
  }

  const nodesRoot = $("recall-nodes");
  nodesRoot.innerHTML = "";
  const nodes = data.nodes ?? [];
  if (!nodes.length) {
    const pre = document.createElement("pre");
    pre.className = "md-block is-empty";
    pre.textContent = "（無匹配 nodes）";
    nodesRoot.appendChild(pre);
    return;
  }
  for (const n of nodes) {
    const card = document.createElement("div");
    card.className = "node-card";
    const h = document.createElement("h3");
    h.innerHTML = `${escapeHtml(n.node)} <span>· ${escapeHtml(n.match_reason || "")}</span>`;
    const pre = document.createElement("pre");
    pre.className = "md-block";
    const what = (n.what_current || "").trim();
    if (what) {
      pre.textContent = what;
    } else {
      pre.textContent = "（無 what）";
      pre.classList.add("is-empty");
    }
    card.appendChild(h);
    card.appendChild(pre);
    nodesRoot.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function onRecall(e) {
  e.preventDefault();
  const msg = $("recall-msg");
  const q = /** @type {HTMLInputElement} */ ($("recall-q")).value.trim();
  setMsg(msg, "查詢中…");
  const path = q ? `/recall?q=${encodeURIComponent(q)}` : "/recall";
  const { ok, data } = await api(path);
  if (!ok) {
    setMsg(msg, data?.message || data?.error || "召回失敗", "error");
    return;
  }
  const meta = [
    data.dream_status ? `dream_status=${data.dream_status}` : null,
    data.sources?.length ? `sources=${data.sources.join(",")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  setMsg(msg, meta || "完成", "ok");
  renderRecallPacket(data);
}

function bind() {
  document.querySelectorAll(".scene-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchScene(btn.getAttribute("data-scene"));
    });
  });
  $("capture-form").addEventListener("submit", onCapture);
  $("refresh-l1").addEventListener("click", () => refreshL1());
  $("refresh-status").addEventListener("click", () => refreshStatus());
  $("dream-run").addEventListener("click", onDreamRun);
  $("dream-approve").addEventListener("click", onDreamApprove);
  $("dream-discard").addEventListener("click", onDreamDiscard);
  $("recall-form").addEventListener("submit", onRecall);
}

async function init() {
  bind();
  const up = await refreshStatus();
  if (!up) {
    setMsg(
      $("capture-msg"),
      "連不上 Engram API（預設 localhost:8787）。請先 cd server && bun run start",
      "error",
    );
  }
  await refreshL1();
}

init();
