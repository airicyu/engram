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
  /** Last recall packet for re-render on locale change (shell strings only). */
  lastRecall: null,
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
  // Lax intervals: status is cheap but no need to chat with the API constantly.
  const ms = locked ? 5000 : pending ? 20000 : 60000;
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
  const { ok, data } = await api("/recall");
  if (!ok) {
    el.textContent = data?.message || data?.error || t("empty.l1_load");
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

  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1500));
    await refreshStatus();
    if (!state.status?.lock) break;
  }
  state.dreaming = false;
  renderConsolidate();

  if (state.status?.dream_status === "pending_review") {
    setMsg(msg, t("dream.ready"), "ok");
  } else if (state.status?.dream_job?.status === "failed") {
    setMsg(
      msg,
      t("dream.job_fail", {
        phase: state.status.dream_job.phase || "?",
        error: state.status.dream_job.error || "",
      }),
      "error",
    );
  }
  if (state.scene === "capture") await refreshL1();
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

function renderRecallPacket(data) {
  state.lastRecall = data;
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
    chainEl.textContent = t("empty.no_chain");
    chainEl.classList.add("is-empty");
  }

  const nodesRoot = $("recall-nodes");
  nodesRoot.innerHTML = "";
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
  setMsg(msg, t("recall.querying"));
  const path = q ? `/recall?q=${encodeURIComponent(q)}` : "/recall";
  const { ok, data } = await api(path);
  if (!ok) {
    setMsg(msg, data?.message || data?.error || t("recall.fail"), "error");
    return;
  }
  const meta = [
    data.dream_status ? `dream_status=${data.dream_status}` : null,
    data.sources?.length ? `sources=${data.sources.join(",")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  setMsg(msg, meta || t("recall.done"), "ok");
  renderRecallPacket(data);
}

async function onLocaleClick(e) {
  const btn = e.currentTarget;
  const code = btn.getAttribute("data-locale");
  if (!code) return;
  await setLocale(code);
  renderStatusLight();
  renderConsolidate();
  if (state.lastRecall) renderRecallPacket(state.lastRecall);
  if (state.scene === "capture") await refreshL1();
}

function bind() {
  document.querySelectorAll(".scene-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchScene(btn.getAttribute("data-scene"));
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
  $("recall-form").addEventListener("submit", onRecall);
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
