import { initI18n, setLocale, t } from "./i18n.js";

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
  /** @type {{ present: boolean, dream_run_id?: string|null, scope?: string[], report?: string|null, draft_summary?: object|null, patches?: unknown[] } | null} */
  pending: null,
  scene: "capture",
  dreaming: false,
  pollTimer: null,
  seekMode: "search",
  memoryMode: "chain",
  askJobId: null,
  askPolling: false,
  /** Last search packet for re-render on locale change. */
  lastSearch: null,
  chainDays: null,
  nodesList: null,
  selectedDayId: null,
  selectedNodeId: null,
  nodesFilter: "",
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
  if (!status) return t("status.offline");
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
    ? t("status.tooltip", {
        lock: String(s.lock),
        l1: s.l1_empty ? "empty" : "present",
        dlq: s.pending_dlq_count,
      })
    : t("status.unreachable_title");
}

function adviceFor(status) {
  if (!status) return t("advice.none");
  if (status.lock) return t("advice.lock");
  if (status.dream_status === "pending_review") return t("advice.pending_review");
  if (status.dream_status === "l1_clear_pending") return t("advice.l1_clear_pending");
  if (status.dream_status === "dream_incomplete") return t("advice.dream_incomplete");
  if (status.dream_status === "dead_letter_pending") {
    return t("advice.dlq", { count: status.pending_dlq_count });
  }
  if (status.l1_empty) {
    if (status.dream_status === "never_dreamed") return t("advice.never_dreamed");
    return t("advice.l1_empty");
  }
  return t("advice.ready");
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
  report.textContent = p.report?.trim() || t("pending.no_report");
  report.classList.toggle("is-empty", !p.report?.trim());
}

function formatElapsed(startedAt) {
  if (!startedAt) return "0s";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function dreamEventLabel(ev) {
  const key = `consolidate.log.${ev.event}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return ev.message || ev.event;
}

function renderDreamProgress() {
  const panel = $("dream-progress");
  const meta = $("dream-progress-meta");
  const log = $("dream-progress-log");
  const s = state.status;
  const job = /** @type {{ status?: string, phase?: string, started_at?: string, log_tail?: Array<{ ts?: string, event?: string, message?: string, level?: string }> } | null} */ (
    s?.dream_job ?? null
  );
  const active = !!(s?.lock || state.dreaming || job?.status === "running");
  panel.hidden = !active;
  if (!active) return;

  const phase = job?.phase || (s?.lock ? "extract" : "—");
  meta.textContent = t("consolidate.progress_phase", {
    phase,
    elapsed: formatElapsed(job?.started_at),
  });

  const events = job?.log_tail ?? [];
  log.replaceChildren();
  for (const ev of events) {
    const li = document.createElement("li");
    li.className = ev.level === "error" ? "is-error" : "";
    const time = ev.ts ? new Date(ev.ts).toLocaleTimeString() : "";
    li.textContent = time ? `${time}  ${dreamEventLabel(ev)}` : dreamEventLabel(ev);
    log.appendChild(li);
  }
  if (events.length) {
    log.scrollTop = log.scrollHeight;
  }
  const cancelBtn = $("dream-cancel");
  if (cancelBtn) cancelBtn.hidden = !active;
}

function renderConsolidate() {
  const s = state.status;
  const dash = t("consolidate.dash");
  $("st-dream").textContent = s ? s.dream_status : dash;
  $("st-lock").textContent = s ? String(s.lock) : dash;
  $("st-l1").textContent = s ? (s.l1_empty ? "empty" : "present") : dash;
  $("st-dlq").textContent = s ? String(s.pending_dlq_count) : dash;
  $("status-advice").textContent = adviceFor(s);
  renderPendingPanel();

  const btn = /** @type {HTMLButtonElement} */ ($("dream-run"));
  const pending = s?.dream_status === "pending_review";
  const clearRetry = s?.dream_status === "l1_clear_pending";
  btn.disabled = !s || s.lock || state.dreaming || (s.l1_empty && !pending && !clearRetry);
  if (s?.lock || state.dreaming) {
    btn.textContent = t("consolidate.dreaming");
  } else if (pending) {
    btn.textContent = t("consolidate.dream_replace");
  } else {
    btn.textContent = t("consolidate.dream");
  }

  const approve = /** @type {HTMLButtonElement} */ ($("dream-approve"));
  const discard = /** @type {HTMLButtonElement} */ ($("dream-discard"));
  const canReview = !!(pending || clearRetry) && !s?.lock && !state.dreaming;
  if (approve) approve.disabled = !canReview && !clearRetry;
  if (discard) discard.disabled = !pending || !!s?.lock || state.dreaming;
  if (approve && clearRetry) approve.disabled = !!s?.lock || state.dreaming;
  renderDreamProgress();
}

function applyCaptureLock() {
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
  if (state.dreaming && !data.lock && data.dream_job?.status !== "running") {
    state.dreaming = false;
    const dreamMsg = $("dream-msg");
    if (data.dream_status === "pending_review") {
      setMsg(dreamMsg, t("dream.ready"), "ok");
    } else if (data.dream_job?.status === "failed") {
      setMsg(
        dreamMsg,
        t("dream.job_fail", {
          phase: data.dream_job.phase || "?",
          error: data.dream_job.error || "",
        }),
        "error",
      );
    }
    if (state.scene === "capture") void refreshL1();
  }
  if (data.dream_status === "pending_review" || data.dream_status === "l1_clear_pending") {
    await refreshPending();
  } else {
    state.pending = { present: false };
  }
  renderStatusLight();
  renderConsolidate();
  applyCaptureLock();
  if (state.askJobId && state.status?.ask_job) {
    renderAskProgress(state.status.ask_job);
  }
  schedulePoll();
  return true;
}

function schedulePoll() {
  if (state.pollTimer) clearTimeout(state.pollTimer);
  const locked = !!(state.status?.lock || state.dreaming);
  const pending = state.status?.dream_status === "pending_review";
  const asking = !!state.status?.ask_job || state.askPolling;
  const ms = locked || asking ? 3000 : pending ? 20000 : 60000;
  state.pollTimer = setTimeout(async () => {
    await refreshStatus();
  }, ms);
}

function formatL1(packet) {
  if (!packet?.l1) return { text: t("empty.none"), empty: true };
  const { present, summary, node_notes } = packet.l1;
  if (!present) {
    return { text: t("empty.l1_cleared"), empty: true };
  }
  const parts = [];
  if (summary?.trim()) {
    parts.push(summary.trim());
  } else {
    parts.push(t("empty.summary_blank"));
  }
  const notes = node_notes && Object.keys(node_notes).length
    ? Object.entries(node_notes)
        .map(([id, md]) => `### ${id}\n${md || t("empty.blank")}`)
        .join("\n\n")
    : null;
  if (notes) parts.push("---\nnode notes\n\n" + notes);
  return { text: parts.join("\n\n"), empty: false };
}

async function refreshL1() {
  const el = $("l1-content");
  const { ok, data } = await api("/memory/l1");
  if (!ok) {
    el.textContent = data?.message || data?.error || t("empty.l1_load");
    el.classList.add("is-empty");
    return;
  }
  const { text, empty } = formatL1({ l1: data });
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
  if (name === "memory") {
    if (state.memoryMode === "chain") loadChainIndex();
    else loadNodesIndex();
  }
}

function switchSeekMode(mode) {
  state.seekMode = mode;
  document.querySelectorAll("[data-seek-mode]").forEach((btn) => {
    const on = btn.getAttribute("data-seek-mode") === mode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", String(on));
  });
  $("seek-search-panel").hidden = mode !== "search";
  $("seek-ask-panel").hidden = mode !== "ask";
}

function switchMemoryMode(mode) {
  state.memoryMode = mode;
  document.querySelectorAll("[data-memory-mode]").forEach((btn) => {
    const on = btn.getAttribute("data-memory-mode") === mode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", String(on));
  });
  $("memory-chain-panel").hidden = mode !== "chain";
  $("memory-nodes-panel").hidden = mode !== "nodes";
  if (mode === "chain") loadChainIndex();
  else loadNodesIndex();
}

function parseNodeRefs(raw) {
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadChainIndex() {
  const indexEl = $("memory-chain-index");
  const bodyEl = $("memory-chain-detail-body");
  indexEl.replaceChildren();
  bodyEl.textContent = t("memory.browse_loading");
  bodyEl.classList.remove("is-empty");

  const { ok, data } = await api("/memory/chain");
  if (!ok) {
    indexEl.innerHTML = `<p class="browse-empty">${escapeHtml(t("memory.browse_fail"))}</p>`;
    bodyEl.textContent = t("memory.browse_fail");
    bodyEl.classList.add("is-empty");
    return;
  }

  state.chainDays = data;
  if (!data.present || !data.days?.length) {
    indexEl.innerHTML = `<p class="browse-empty">${escapeHtml(t("memory.chain_empty"))}</p>`;
    $("memory-chain-detail-title").textContent = "—";
    $("memory-chain-detail-meta").textContent = "";
    bodyEl.textContent = t("memory.chain_empty");
    bodyEl.classList.add("is-empty");
    state.selectedDayId = null;
    return;
  }

  renderChainIndex(data.days);
  const firstId = data.days[0].day_id;
  if (!state.selectedDayId || !data.days.some((d) => d.day_id === state.selectedDayId)) {
    state.selectedDayId = firstId;
  }
  await loadChainDay(state.selectedDayId);
}

function renderChainIndex(days) {
  const indexEl = $("memory-chain-index");
  indexEl.replaceChildren();
  for (const day of days) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "browse-item";
    btn.setAttribute("role", "option");
    btn.dataset.dayId = day.day_id;
    if (day.day_id === state.selectedDayId) {
      btn.classList.add("is-selected");
      btn.setAttribute("aria-current", "true");
    }
    const idSpan = document.createElement("span");
    idSpan.className = "browse-item-id";
    idSpan.textContent = day.day_id;
    const preview = document.createElement("div");
    preview.className = "browse-item-preview";
    preview.textContent = day.preview || "";
    btn.appendChild(idSpan);
    if (day.preview) btn.appendChild(preview);
    btn.addEventListener("click", () => {
      state.selectedDayId = day.day_id;
      renderChainIndex(days);
      void loadChainDay(day.day_id);
    });
    indexEl.appendChild(btn);
  }
}

function chainSourceLabel(source) {
  if (source === "summary") return t("memory.source_summary");
  if (source === "ledger_fallback") return t("memory.source_ledger");
  return source || "";
}

async function loadChainDay(dayId) {
  state.selectedDayId = dayId;
  const titleEl = $("memory-chain-detail-title");
  const metaEl = $("memory-chain-detail-meta");
  const bodyEl = $("memory-chain-detail-body");
  titleEl.textContent = dayId;
  metaEl.textContent = "";
  bodyEl.textContent = t("memory.browse_loading");
  bodyEl.classList.remove("is-empty");

  const { ok, data } = await api(`/memory/chain/${encodeURIComponent(dayId)}`);
  if (!ok) {
    bodyEl.textContent = t("memory.browse_fail");
    bodyEl.classList.add("is-empty");
    return;
  }

  if (!data.present) {
    metaEl.textContent = "";
    bodyEl.textContent = t("memory.chain_empty");
    bodyEl.classList.add("is-empty");
    return;
  }

  metaEl.textContent = chainSourceLabel(data.source);
  bodyEl.textContent = data.content?.trim() || t("empty.blank");
  bodyEl.classList.toggle("is-empty", !data.content?.trim());

  document.querySelectorAll("#memory-chain-index .browse-item").forEach((btn) => {
    const on = btn.dataset.dayId === dayId;
    btn.classList.toggle("is-selected", on);
    if (on) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  });
}

async function loadNodesIndex() {
  const indexEl = $("memory-nodes-index");
  const bodyEl = $("memory-nodes-detail-body");
  indexEl.replaceChildren();
  bodyEl.textContent = t("memory.browse_loading");
  bodyEl.classList.remove("is-empty");

  const { ok, data } = await api("/memory/nodes");
  if (!ok) {
    indexEl.innerHTML = `<p class="browse-empty">${escapeHtml(t("memory.browse_fail"))}</p>`;
    bodyEl.textContent = t("memory.browse_fail");
    bodyEl.classList.add("is-empty");
    return;
  }

  state.nodesList = data;
  if (!data.present || !data.nodes?.length) {
    indexEl.innerHTML = `<p class="browse-empty">${escapeHtml(t("memory.nodes_empty"))}</p>`;
    $("memory-nodes-detail-title").textContent = "—";
    bodyEl.textContent = t("memory.nodes_empty");
    bodyEl.classList.add("is-empty");
    state.selectedNodeId = null;
    return;
  }

  const filtered = filterNodesList(data.nodes);
  renderNodesIndex(filtered);

  if (
    !state.selectedNodeId ||
    !data.nodes.some((n) => n.node === state.selectedNodeId)
  ) {
    state.selectedNodeId = filtered[0]?.node ?? data.nodes[0].node;
  }
  if (state.selectedNodeId) await loadNodeDetail(state.selectedNodeId);
}

function filterNodesList(nodes) {
  const q = state.nodesFilter.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter(
    (n) =>
      n.node.toLowerCase().includes(q) ||
      (n.preview || "").toLowerCase().includes(q),
  );
}

function renderNodesIndex(nodes) {
  const indexEl = $("memory-nodes-index");
  indexEl.replaceChildren();
  if (!nodes.length) {
    indexEl.innerHTML = `<p class="browse-empty">${escapeHtml(t("memory.nodes_empty"))}</p>`;
    return;
  }
  for (const node of nodes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "browse-item";
    btn.setAttribute("role", "option");
    btn.dataset.nodeId = node.node;
    if (node.node === state.selectedNodeId) {
      btn.classList.add("is-selected");
      btn.setAttribute("aria-current", "true");
    }
    const idSpan = document.createElement("span");
    idSpan.className = "browse-item-id";
    idSpan.textContent = node.node;
    const preview = document.createElement("div");
    preview.className = "browse-item-preview";
    preview.textContent = node.preview || "";
    btn.appendChild(idSpan);
    if (node.preview) btn.appendChild(preview);
    btn.addEventListener("click", () => {
      state.selectedNodeId = node.node;
      const all = state.nodesList?.nodes ?? [];
      renderNodesIndex(filterNodesList(all));
      void loadNodeDetail(node.node);
    });
    indexEl.appendChild(btn);
  }
}

function onNodesFilterInput() {
  const input = /** @type {HTMLInputElement} */ ($("memory-nodes-filter"));
  state.nodesFilter = input.value;
  const all = state.nodesList?.nodes ?? [];
  const filtered = filterNodesList(all);
  renderNodesIndex(filtered);
  if (filtered.length && !filtered.some((n) => n.node === state.selectedNodeId)) {
    state.selectedNodeId = filtered[0].node;
    void loadNodeDetail(state.selectedNodeId);
  }
}

async function loadNodeDetail(nodeId) {
  state.selectedNodeId = nodeId;
  const titleEl = $("memory-nodes-detail-title");
  const bodyEl = $("memory-nodes-detail-body");
  titleEl.textContent = nodeId;
  bodyEl.textContent = t("memory.browse_loading");
  bodyEl.classList.remove("is-empty");

  const { ok, data } = await api(`/memory/nodes/${encodeURIComponent(nodeId)}`);
  if (!ok) {
    bodyEl.textContent = t("memory.browse_fail");
    bodyEl.classList.add("is-empty");
    return;
  }

  if (!data.present) {
    bodyEl.textContent = t("memory.nodes_empty");
    bodyEl.classList.add("is-empty");
    return;
  }

  bodyEl.textContent = data.what_current?.trim() || t("empty.no_what");
  bodyEl.classList.toggle("is-empty", !data.what_current?.trim());

  document.querySelectorAll("#memory-nodes-index .browse-item").forEach((btn) => {
    const on = btn.dataset.nodeId === nodeId;
    btn.classList.toggle("is-selected", on);
    if (on) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  });
}

async function onCapture(e) {
  e.preventDefault();
  const msg = $("capture-msg");
  const rawEl = /** @type {HTMLTextAreaElement} */ ($("capture-raw"));
  const refsEl = /** @type {HTMLInputElement} */ ($("capture-refs"));
  const raw = rawEl.value.trim();
  if (!raw) {
    setMsg(msg, t("capture.empty_input"), "error");
    return;
  }
  if (state.status?.lock) {
    setMsg(msg, t("capture.lock_hint"), "error");
    return;
  }

  const body = { raw, source: "web" };
  const refs = parseNodeRefs(refsEl.value);
  if (refs.length) body.node_refs = refs;

  setMsg(msg, t("capture.writing"));
  const { ok, status, data } = await api("/capture", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (status === 409 || data?.error === "dream_locked") {
    setMsg(msg, data?.message || t("capture.locked"), "error");
    await refreshStatus();
    return;
  }
  if (!ok) {
    setMsg(msg, data?.message || data?.error || t("capture.fail", { status }), "error");
    return;
  }

  setMsg(msg, t("capture.ok", { id: data.event_id }), "ok");
  rawEl.value = "";
  await Promise.all([refreshStatus(), refreshL1()]);
}

async function onDreamRun() {
  const msg = $("dream-msg");
  const result = $("dream-result");
  const body = $("dream-result-body");

  if (state.status?.lock || state.dreaming) {
    setMsg(msg, t("dream.already"), "error");
    return;
  }
  if (state.status?.l1_empty && state.status?.dream_status !== "pending_review") {
    setMsg(msg, t("dream.l1_empty"), "error");
    return;
  }

  state.dreaming = true;
  applyCaptureLock();
  renderConsolidate();
  setMsg(msg, t("dream.running"));

  const { ok, status, data } = await api("/dream/run", { method: "POST" });

  if (status === 409) {
    state.dreaming = false;
    result.hidden = false;
    body.textContent = data?.message || data?.error || "rejected";
    setMsg(msg, data?.message || data?.error || t("dream.rejected"), "error");
    await refreshStatus();
    return;
  }

  if (!ok) {
    state.dreaming = false;
    result.hidden = false;
    body.textContent = JSON.stringify(data, null, 2);
    setMsg(msg, data?.message || data?.error || t("dream.fail", { status }), "error");
    await refreshStatus();
    return;
  }

  setMsg(msg, t("dream.submitted"), "ok");
  body.textContent = `job_id: ${data.job_id}\n${data.message || ""}`;
  result.hidden = false;
  await refreshStatus();
}

async function onDreamApprove() {
  const msg = $("dream-msg");
  setMsg(msg, t("dream.approving"));
  const { ok, status, data } = await api("/dream/approve", {
    method: "POST",
    body: "{}",
  });
  if (status === 409) {
    setMsg(msg, data?.message || data?.error || t("dream.approve_fail"), "error");
    await refreshStatus();
    return;
  }
  if (!ok) {
    setMsg(msg, data?.message || data?.error || t("dream.fail", { status }), "error");
    return;
  }
  const note = data.empty_patches
    ? t("dream.approve_empty")
    : data.l1_clear_pending
      ? t("dream.approve_retry_clear")
      : t("dream.approve_ok", { count: data.committed?.length ?? 0 });
  setMsg(msg, note, data.l1_clear_pending ? "error" : "ok");
  $("dream-result").hidden = false;
  $("dream-result-body").textContent = JSON.stringify(data, null, 2);
  await refreshStatus();
  if (state.scene === "capture") await refreshL1();
}

async function onDreamDiscard() {
  const msg = $("dream-msg");
  setMsg(msg, t("dream.discarding"));
  const { ok, status, data } = await api("/dream/discard", {
    method: "POST",
    body: "{}",
  });
  if (!ok) {
    setMsg(msg, data?.message || data?.error || t("dream.fail", { status }), "error");
    await refreshStatus();
    return;
  }
  setMsg(msg, t("dream.discard_ok"), "ok");
  await refreshStatus();
}

async function onDreamCancel() {
  const msg = $("dream-msg");
  setMsg(msg, t("dream.cancelling"));
  const { ok, status, data } = await api("/dream/cancel", {
    method: "POST",
    body: "{}",
  });
  if (!ok) {
    setMsg(msg, data?.message || data?.error || t("dream.fail", { status }), "error");
    await refreshStatus();
    return;
  }
  state.dreaming = false;
  setMsg(msg, t("dream.cancel_ok"), "ok");
  await refreshStatus();
}

function getSearchScopes() {
  return [...document.querySelectorAll('#seek-search-form input[name="scope"]:checked')].map(
    (el) => /** @type {HTMLInputElement} */ (el).value,
  );
}

function formatSearchL1(l1) {
  if (!l1) return { text: "", empty: true };
  const parts = [];
  if (l1.summary?.trim()) parts.push(l1.summary.trim());
  const notes = Object.entries(l1.node_notes ?? {})
    .filter(([, md]) => md?.trim())
    .map(([id, md]) => `### ${id}\n${md.trim()}`);
  if (notes.length) parts.push(notes.join("\n\n"));
  const text = parts.join("\n\n");
  return { text, empty: !text };
}

function renderSearchPacket(data) {
  state.lastSearch = data;

  const l1Block = $("memory-l1-block");
  const l1El = $("memory-l1");
  if ("l1" in data) {
    const l1 = formatSearchL1(data.l1);
    l1Block.hidden = false;
    if (data.l1) {
      l1El.textContent = l1.text;
      l1El.classList.toggle("is-empty", l1.empty);
    } else {
      l1El.textContent = t("empty.no_l1_hit");
      l1El.classList.add("is-empty");
    }
  } else {
    l1Block.hidden = true;
  }

  const chainBlock = $("memory-chain-block");
  const chainEl = $("memory-chain");
  if ("chain" in data) {
    const chainHits = data.chain ?? [];
    chainBlock.hidden = false;
    if (chainHits.length) {
      chainEl.textContent = chainHits
        .map((c) => `# ${c.day_id}\n\n${c.content.trim()}`)
        .join("\n\n---\n\n");
      chainEl.classList.remove("is-empty");
    } else {
      chainEl.textContent = t("empty.no_chain");
      chainEl.classList.add("is-empty");
    }
  } else {
    chainBlock.hidden = true;
  }

  const nodesBlock = $("memory-nodes-block");
  const nodesRoot = $("memory-nodes");
  nodesRoot.innerHTML = "";
  if ("nodes" in data) {
    nodesBlock.hidden = false;
    const nodes = data.nodes ?? [];
    if (!nodes.length) {
      const pre = document.createElement("pre");
      pre.className = "md-block is-empty";
      pre.textContent = t("empty.no_nodes");
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
        pre.textContent = t("empty.no_what");
        pre.classList.add("is-empty");
      }
      card.appendChild(h);
      card.appendChild(pre);
      nodesRoot.appendChild(card);
    }
  } else {
    nodesBlock.hidden = true;
  }
}

function askEventLabel(ev) {
  const key = `memory.log.${ev.event}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return ev.message || ev.event;
}

function renderAskProgress(job) {
  const panel = $("ask-progress");
  const active = job?.status === "running";
  panel.hidden = !active && !state.askPolling;
  $("seek-ask-cancel").hidden = !active;
  $("seek-ask-submit").disabled = active;

  if (!job) return;

  const meta = $("ask-progress-meta");
  meta.textContent = t("memory.ask_progress", {
    phase: job.phase || "—",
    elapsed: formatElapsed(job.started_at),
  });

  const log = $("ask-progress-log");
  log.replaceChildren();
  for (const ev of job.log_tail ?? []) {
    const li = document.createElement("li");
    li.className = ev.level === "error" ? "is-error" : "";
    const time = ev.ts ? new Date(ev.ts).toLocaleTimeString() : "";
    li.textContent = time ? `${time}  ${askEventLabel(ev)}` : askEventLabel(ev);
    log.appendChild(li);
  }
  if ((job.log_tail ?? []).length) {
    log.scrollTop = log.scrollHeight;
  }
}

function renderAskAnswer(job) {
  const block = $("memory-answer-block");
  if (!job?.answer) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  $("memory-answer").textContent = job.answer;
  const sources = job.sources ?? [];
  const wrap = $("memory-sources-wrap");
  if (sources.length) {
    wrap.hidden = false;
    $("memory-sources").textContent = JSON.stringify(sources, null, 2);
  } else {
    wrap.hidden = true;
  }
}

async function pollAskJob(jobId) {
  state.askPolling = true;
  const msg = $("seek-ask-msg");
  while (state.askPolling && state.askJobId === jobId) {
    const { ok, data } = await api(`/memory/ask/${encodeURIComponent(jobId)}`);
    if (!ok || data?.present === false) {
      setMsg(msg, t("memory.ask_fail"), "error");
      break;
    }
    renderAskProgress(data);
    if (data.status === "completed") {
      setMsg(msg, t("memory.ask_done"), "ok");
      renderAskAnswer(data);
      state.askJobId = null;
      state.askPolling = false;
      $("ask-progress").hidden = true;
      break;
    }
    if (data.status === "failed" || data.status === "cancelled") {
      setMsg(msg, data.error || t("memory.ask_fail"), "error");
      state.askJobId = null;
      state.askPolling = false;
      $("ask-progress").hidden = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  $("seek-ask-submit").disabled = false;
}

async function onMemorySearch(e) {
  e.preventDefault();
  const msg = $("seek-search-msg");
  const q = /** @type {HTMLInputElement} */ ($("seek-search-q")).value.trim();
  if (!q) {
    setMsg(msg, t("memory.search_empty_q"), "error");
    return;
  }
  const scopes = getSearchScopes();
  if (!scopes.length) {
    setMsg(msg, t("memory.search_scope_empty"), "error");
    return;
  }
  setMsg(msg, t("memory.querying"));
  const params = new URLSearchParams({ q });
  if (scopes.length < 3) params.set("scope", scopes.join(","));
  const { ok, data } = await api(`/memory/search?${params}`);
  if (!ok) {
    setMsg(msg, data?.message || data?.error || t("memory.search_fail"), "error");
    return;
  }
  const hits =
    (data.nodes?.length ?? 0) +
    (data.l1 ? 1 : 0) +
    (data.chain?.length ?? 0);
  setMsg(msg, hits ? t("memory.search_hits", { count: hits }) : t("memory.search_empty"), "ok");
  renderSearchPacket(data);
}

async function onMemoryAsk(e) {
  e.preventDefault();
  const msg = $("seek-ask-msg");
  const q = /** @type {HTMLTextAreaElement} */ ($("seek-ask-q")).value.trim();
  if (!q) {
    setMsg(msg, t("memory.ask_empty"), "error");
    return;
  }
  setMsg(msg, t("memory.ask_running"));
  $("memory-answer-block").hidden = true;
  const { ok, status, data } = await api("/memory/ask", {
    method: "POST",
    body: JSON.stringify({ q }),
  });
  if (status === 409 && data?.error === "ask_busy") {
    setMsg(msg, t("memory.ask_busy"), "error");
    return;
  }
  if (!ok) {
    setMsg(msg, data?.message || data?.error || t("memory.ask_fail"), "error");
    return;
  }
  state.askJobId = data.job_id;
  $("ask-progress").hidden = false;
  void pollAskJob(data.job_id);
}

async function onMemoryAskCancel() {
  if (!state.askJobId) return;
  const msg = $("seek-ask-msg");
  await api(`/memory/ask/${encodeURIComponent(state.askJobId)}/cancel`, {
    method: "POST",
    body: "{}",
  });
  state.askPolling = false;
  state.askJobId = null;
  setMsg(msg, t("memory.ask_cancelled"), "ok");
  $("ask-progress").hidden = true;
  $("seek-ask-submit").disabled = false;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function onLocaleClick(e) {
  const btn = e.currentTarget;
  const code = btn.getAttribute("data-locale");
  if (!code) return;
  await setLocale(code);
  renderStatusLight();
  renderConsolidate();
  if (state.lastSearch) renderSearchPacket(state.lastSearch);
  if (state.scene === "capture") await refreshL1();
}

function bind() {
  document.querySelectorAll(".scene-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchScene(btn.getAttribute("data-scene"));
    });
  });
  document.querySelectorAll("[data-seek-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchSeekMode(btn.getAttribute("data-seek-mode"));
    });
  });
  document.querySelectorAll("[data-memory-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchMemoryMode(btn.getAttribute("data-memory-mode"));
    });
  });
  document.querySelectorAll("[data-locale]").forEach((btn) => {
    btn.addEventListener("click", onLocaleClick);
  });
  $("capture-form").addEventListener("submit", onCapture);
  $("refresh-l1").addEventListener("click", () => refreshL1());
  $("refresh-status").addEventListener("click", () => refreshStatus());
  $("dream-run").addEventListener("click", onDreamRun);
  $("dream-approve").addEventListener("click", onDreamApprove);
  $("dream-discard").addEventListener("click", onDreamDiscard);
  $("dream-cancel").addEventListener("click", onDreamCancel);
  $("seek-search-form").addEventListener("submit", onMemorySearch);
  $("seek-ask-form").addEventListener("submit", onMemoryAsk);
  $("seek-ask-cancel").addEventListener("click", onMemoryAskCancel);
  $("memory-nodes-filter").addEventListener("input", onNodesFilterInput);
}

async function init() {
  await initI18n();
  bind();
  const up = await refreshStatus();
  if (!up) {
    setMsg($("capture-msg"), t("capture.api_down"), "error");
  }
  await refreshL1();
}

init();
