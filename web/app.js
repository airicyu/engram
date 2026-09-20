const app = document.getElementById("app");
const banner = document.getElementById("job-banner");

let pollTimer = null;
let activeJobId = sessionStorage.getItem("engramLiteJob") || "";
let actionLock = false;
/** @type {"recent"|"distill"} */
let eventsTab = "recent";
let lastDistillResult = "";
/** @type {"ask"|"search"} */
let seekMode = "ask";
/** @type {string|null} */
let clarifySelectedId = null;

function t(key, vars) {
  if (window.EngramI18n && typeof window.EngramI18n.t === "function") {
    return window.EngramI18n.t(key, vars);
  }
  return key;
}

function busyLabel(kind) {
  if (kind === "ingest") return t("busy.ingest");
  if (kind === "distill") return t("busy.distill");
  if (kind === "ask") return t("busy.ask");
  return t("busy.generic");
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || res.statusText);
    err.status = res.status;
    err.code = data.error;
    err.job_id = data.job_id;
    err.payload = data;
    throw err;
  }
  return data;
}

function jobBusy() {
  return actionLock;
}

function clearJob() {
  activeJobId = "";
  actionLock = false;
  sessionStorage.removeItem("engramLiteJob");
}

function setControlsBusy(kind) {
  const busy = Boolean(actionLock);
  document.querySelectorAll("[data-action]").forEach((el) => {
    if (!el.dataset.label) el.dataset.label = el.textContent;
    el.disabled = busy;
    el.setAttribute("aria-busy", busy ? "true" : "false");
    if (busy && kind && el.dataset.action === kind) el.textContent = busyLabel(kind);
    else el.textContent = el.dataset.label;
  });
  document.querySelectorAll("[data-lock]").forEach((el) => {
    el.disabled = busy;
  });
}

function navKeyFromHash() {
  const h = location.hash.slice(2) || "events";
  if (h.startsWith("seek") || h.startsWith("ask")) return "seek";
  if (h.startsWith("clarify")) return "clarify";
  if (
    h.startsWith("memory") ||
    h.startsWith("chain") ||
    h.startsWith("nodes") ||
    h === "nodes"
  )
    return "memory";
  return "events";
}

function syncNav() {
  const key = navKeyFromHash();
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === key);
    if (a.dataset.nav === key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function syncLocaleButtons() {
  const loc =
    window.EngramI18n && window.EngramI18n.getLocale
      ? window.EngramI18n.getLocale()
      : "zh-Hant";
  document.querySelectorAll("[data-locale]").forEach((btn) => {
    const on = btn.dataset.locale === loc;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.querySelectorAll("[data-nav] .nav-label").forEach((span) => {
    const a = span.closest("[data-nav]");
    if (!a) return;
    const map = {
      events: "nav.events",
      seek: "nav.seek",
      clarify: "nav.clarify",
      memory: "nav.memory",
    };
    const key = map[a.dataset.nav];
    if (key) span.textContent = t(key);
  });
  const aside = document.querySelector(".sidebar");
  if (aside) aside.setAttribute("aria-label", t("nav.scenes"));
  const group = document.querySelector(".locale-switch");
  if (group) group.setAttribute("aria-label", t("locale.switch"));
}

function route() {
  syncNav();
  syncLocaleButtons();
  const h = location.hash.slice(2) || "events";
  if (h.startsWith("memory/graph") || h === "memory/graph") return renderGraph();
  if (h.startsWith("memory/nodes") || h === "nodes") return renderNodes();
  if (h === "memory" || h.startsWith("memory?") || h.startsWith("memory/") || h.startsWith("chain"))
    return renderChain();
  if (h.startsWith("seek") || h.startsWith("ask")) return renderSeek();
  if (h.startsWith("clarify")) return renderClarify();
  return renderEvents();
}

function memorySubnav(which) {
  const listOn = which === "list" || which === "chain" || which === "nodes";
  const graphOn = which === "graph";
  return `<div class="memory-modes memory-subnav" role="tablist" aria-label="${escapeHtml(t("memory.title"))}">
    <a class="mode-btn${listOn ? " is-active" : ""}" href="#/memory" role="tab" aria-selected="${listOn}">${escapeHtml(t("memory.list"))}</a>
    <a class="mode-btn${graphOn ? " is-active" : ""}" href="#/memory/graph" role="tab" aria-selected="${graphOn}">${escapeHtml(t("memory.graph"))}</a>
  </div>`;
}

function memoryListModes(active) {
  return `<div class="memory-modes memory-list-modes" role="tablist">
    <a class="mode-btn${active === "chain" ? " is-active" : ""}" href="#/memory" role="tab" aria-selected="${active === "chain"}">${escapeHtml(t("memory.chain"))}</a>
    <a class="mode-btn${active === "nodes" ? " is-active" : ""}" href="#/memory/nodes" role="tab" aria-selected="${active === "nodes"}">${escapeHtml(t("memory.nodes"))}</a>
  </div>`;
}

function seekModeIcon(mode) {
  if (mode === "ask") {
    return `<svg class="mode-btn-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 3.1c-.7.4-1 0.7-1 1.6" />
      <circle cx="12" cy="17.1" r="0.85" fill="currentColor" stroke="none" />
    </svg>`;
  }
  return `<svg class="mode-btn-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16.2 16.2 4.3 4.3" />
  </svg>`;
}

function setJob(id) {
  activeJobId = id || "";
  if (id) sessionStorage.setItem("engramLiteJob", id);
  else sessionStorage.removeItem("engramLiteJob");
  pollJob();
}

async function pollJob() {
  if (!activeJobId) {
    if (!actionLock) {
      banner.hidden = true;
      setControlsBusy();
    }
    return;
  }
  try {
    const job = await api("/jobs/" + encodeURIComponent(activeJobId));
    const terminal = job.status === "completed" || job.status === "failed";
    if (!terminal) {
      const status = await api("/status");
      if (!status.queue || status.queue.job_id !== activeJobId) {
        banner.hidden = false;
        banner.textContent = t("job.interrupted");
        clearJob();
        setControlsBusy();
        return;
      }
    }
    banner.hidden = false;
    {
      const tail = jobLogTail(job);
      banner.textContent =
        `${job.kind} · ${job.status}` +
        (job.error ? ` · ${job.error}` : "") +
        (tail ? ` · ${tail}` : "");
    }
    if (actionLock) setControlsBusy(job.kind);
    if (terminal) {
      const wasComplete = job.status === "completed";
      if (job.kind === "distill") {
        lastDistillResult =
          `${job.kind} · ${job.status}` + (job.error ? ` · ${job.error}` : "");
      }
      clearJob();
      setControlsBusy();
      if (wasComplete) route();
    }
  } catch {
    banner.hidden = false;
    banner.textContent = t("job.gone");
    clearJob();
    setControlsBusy();
  }
}

function jobLogTail(job) {
  const log = Array.isArray(job.log) ? job.log : [];
  if (!log.length) return "";
  const last = String(log[log.length - 1] || "");
  return last.length > 120 ? last.slice(0, 117) + "…" : last;
}

async function waitJob(jobId) {
  setJob(jobId);
  for (;;) {
    const job = await api("/jobs/" + encodeURIComponent(jobId));
    banner.hidden = false;
    const tail = jobLogTail(job);
    banner.textContent =
      `${job.kind} · ${job.status}` +
      (job.error ? ` · ${job.error}` : "") +
      (tail ? ` · ${tail}` : "");
    setControlsBusy(job.kind);
    if (job.status === "completed" || job.status === "failed") {
      const text = `${job.kind} · ${job.status}` + (job.error ? ` · ${job.error}` : "");
      if (job.kind === "distill") lastDistillResult = text;
      clearJob();
      setControlsBusy();
      banner.hidden = false;
      banner.textContent = text;
      return job;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function runAction(kind, fn) {
  if (jobBusy()) return;
  actionLock = true;
  setControlsBusy(kind);
  banner.hidden = false;
  banner.textContent = t("job.sending", { kind });
  try {
    return await fn();
  } catch (err) {
    actionLock = false;
    setControlsBusy();
    banner.hidden = false;
    if (err && err.code === "distill_already_active") {
      banner.textContent = t("distill.busy_conflict");
    } else {
      banner.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}

function mediaIconSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <circle cx="8.5" cy="10" r="1.25" />
    <path d="m21 15.5-4.2-4.2a1.2 1.2 0 0 0-1.7 0L8 18.5" />
  </svg>`;
}

function tabIconRecent() {
  return `<svg class="events-tab-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
    <circle cx="4.2" cy="6" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="4.2" cy="12" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="4.2" cy="18" r="1.15" fill="currentColor" stroke="none" />
  </svg>`;
}

function tabIconDistill() {
  return `<svg class="events-tab-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14.5 4.2A7.2 7.2 0 1 0 19.8 14 5.6 5.6 0 0 1 14.5 4.2Z" />
  </svg>`;
}

async function renderEvents() {
  const pool = await api("/pool");
  let statusText = t("distill.idle");
  try {
    const st = await api("/status");
    if (st.queue && st.queue.job_id) {
      statusText = `${st.queue.kind || "job"} · ${st.queue.status || "queued"}`;
    }
  } catch {
    /* ignore */
  }

  app.innerHTML = `
    <p class="scene-lead">${escapeHtml(t("activities.lead"))}</p>
    <div class="compose-card">
      <label class="sr-only" for="raw">${escapeHtml(t("activities.placeholder"))}</label>
      <textarea id="raw" rows="5" placeholder="${escapeHtml(t("activities.placeholder"))}" data-lock></textarea>
      <div id="attach-preview" class="attachments-list"></div>
      <div class="compose-toolbar">
        <div class="compose-toolbar-tools">
          <button type="button" class="compose-tool-btn" id="attach-btn" data-lock
            aria-label="${escapeHtml(t("activities.attachment_add"))}" title="${escapeHtml(t("activities.attachment_add"))}">
            ${mediaIconSvg()}
          </button>
          <input type="file" id="attach-file" accept="image/jpeg,image/png,image/webp,image/gif" class="sr-only" />
        </div>
        <button type="button" class="compose-post-btn" data-action="ingest">${escapeHtml(t("activities.submit"))}</button>
      </div>
    </div>
    <div class="events-tabs" role="tablist" aria-label="${escapeHtml(t("nav.events"))}">
      <button type="button" role="tab" class="events-tab${eventsTab === "recent" ? " is-active" : ""}"
        data-events-tab="recent" aria-selected="${eventsTab === "recent"}">
        ${tabIconRecent()}${escapeHtml(t("events.tab_recent"))}
      </button>
      <button type="button" role="tab" class="events-tab${eventsTab === "distill" ? " is-active" : ""}"
        data-events-tab="distill" aria-selected="${eventsTab === "distill"}">
        ${tabIconDistill()}${escapeHtml(t("events.tab_consolidate"))}
      </button>
    </div>
    <div id="events-panel"></div>
  `;

  /** @type {{ path: string, relationship: string }[]} */
  let pendingAttach = [];

  const rawEl = document.getElementById("raw");
  const previewEl = document.getElementById("attach-preview");
  const panel = document.getElementById("events-panel");

  function refreshAttachPreview() {
    previewEl.innerHTML = pendingAttach
      .map(
        (a, i) => `
      <div class="attachment-item" data-attach-idx="${i}">
        <div class="attachment-preview">
          <img src="/attachments/file?path=${encodeURIComponent(a.path)}" alt="" />
        </div>
        <div class="attachment-meta">
          <code class="attachment-path">${escapeHtml(a.path)}</code>
          <textarea class="attachment-relationship" rows="1" data-rel-idx="${i}"
            placeholder="${escapeHtml(t("activities.attachment_relationship_placeholder"))}"
            data-lock>${escapeHtml(a.relationship)}</textarea>
        </div>
        <button type="button" class="ghost attachment-remove-btn" data-remove-attach="${i}"
          title="${escapeHtml(t("activities.attachment_remove"))}" aria-label="${escapeHtml(t("activities.attachment_remove"))}">✕</button>
      </div>`,
      )
      .join("");

    previewEl.querySelectorAll("[data-rel-idx]").forEach((ta) => {
      ta.addEventListener("input", () => {
        const idx = Number(ta.getAttribute("data-rel-idx"));
        if (pendingAttach[idx]) pendingAttach[idx].relationship = ta.value;
      });
    });
    previewEl.querySelectorAll("[data-remove-attach]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-remove-attach"));
        removeAttach(idx);
      });
    });
  }

  function removeAttach(index) {
    const item = pendingAttach[index];
    if (!item) return;
    const embed = `![[${item.path}]]`;
    const cleaned = rawEl.value
      .split(embed)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    rawEl.value = cleaned ? cleaned + (cleaned.endsWith("\n") ? "" : "") : "";
    pendingAttach = pendingAttach.filter((_, i) => i !== index);
    refreshAttachPreview();
  }

  function insertEmbed(path) {
    const embed = `![[${path}]]`;
    const start = rawEl.selectionStart ?? rawEl.value.length;
    const end = rawEl.selectionEnd ?? start;
    const before = rawEl.value.slice(0, start);
    const after = rawEl.value.slice(end);
    const padBefore = before && !before.endsWith("\n") && before.length ? "\n\n" : before.length ? "" : "";
    const padAfter = after && !after.startsWith("\n") ? "\n" : "";
    rawEl.value = before + padBefore + embed + padAfter + after;
    if (!pendingAttach.some((a) => a.path === path)) {
      pendingAttach.push({ path, relationship: t("activities.attachment_default_rel") });
    }
    refreshAttachPreview();
  }

  async function uploadBlob(blob, filename) {
    const fd = new FormData();
    fd.append("file", blob, filename || "paste.png");
    const res = await fetch("/attachments", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    insertEmbed(data.path);
    banner.hidden = false;
    banner.textContent = t("activities.uploaded", { path: data.path });
  }

  document.getElementById("attach-btn").onclick = () => {
    document.getElementById("attach-file").click();
  };

  document.getElementById("attach-file").onchange = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    try {
      await uploadBlob(file, file.name);
    } catch (err) {
      banner.hidden = false;
      banner.textContent = err instanceof Error ? err.message : String(err);
    }
  };

  rawEl.addEventListener("paste", async (ev) => {
    const items = ev.clipboardData && ev.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        ev.preventDefault();
        const blob = it.getAsFile();
        if (!blob) return;
        try {
          await uploadBlob(blob, blob.name || "paste.png");
        } catch (err) {
          banner.hidden = false;
          banner.textContent = err instanceof Error ? err.message : String(err);
        }
        return;
      }
    }
  });

  function renderRecentPanel() {
    const items = pool.pending || [];
    const list = items.length
      ? items
          .map((e) => {
            const body = renderEmbedsHtml(e.raw);
            const note = e.note ? `<div class="muted">${escapeHtml(e.note)}</div>` : "";
            return `<article class="card stm-entry">
              <header class="stm-entry-meta">
                <time>${escapeHtml(e.ts)}</time>
                <span class="stm-entry-id">${escapeHtml(e.id)}</span>
              </header>
              <div class="event-body">${body}</div>${note}
            </article>`;
          })
          .join("")
      : `<p class="muted">${escapeHtml(t("activities.recent_events_empty"))}</p>`;
    panel.innerHTML = `
      <section class="recent-section">
        <h2 class="recent-section-title">${escapeHtml(t("activities.recent_events_heading"))}</h2>
        <div id="pending">${list}</div>
      </section>`;
  }

  function renderDistillPanel() {
    panel.innerHTML = `
      <section class="distill-panel">
        <h2>${escapeHtml(t("distill.title"))}</h2>
        <p class="muted">${escapeHtml(t("distill.lead"))}</p>
        <div class="distill-status">
          <strong>${escapeHtml(t("distill.status"))}</strong>：
          <span id="distill-status-text">${escapeHtml(statusText)}</span>
        </div>
        <div class="row">
          <button type="button" class="primary" data-action="distill">${escapeHtml(t("distill.action"))}</button>
        </div>
        <div class="distill-result">
          <h3 class="recent-section-title">${escapeHtml(t("distill.result"))}</h3>
          <pre class="card md" id="distill-result">${escapeHtml(lastDistillResult || t("empty"))}</pre>
        </div>
      </section>`;
    const distillBtn = panel.querySelector("[data-action=distill]");
    if (distillBtn) {
      distillBtn.onclick = () =>
        runAction("distill", async () => {
          const { job_id } = await api("/distill", { method: "POST" });
          const job = await waitJob(job_id);
          const logs = Array.isArray(job.log) ? job.log.join("\n") : "";
          lastDistillResult =
            `${job.kind} · ${job.status}` +
            (job.error ? ` · ${job.error}` : "") +
            (logs ? `\n\n--- log ---\n${logs}` : "");
          eventsTab = "distill";
          renderEvents();
        });
    }
  }

  function showTab(tab) {
    eventsTab = tab;
    app.querySelectorAll("[data-events-tab]").forEach((btn) => {
      const on = btn.dataset.eventsTab === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (tab === "distill") renderDistillPanel();
    else renderRecentPanel();
    setControlsBusy();
  }

  app.querySelectorAll("[data-events-tab]").forEach((btn) => {
    btn.onclick = () => showTab(btn.dataset.eventsTab);
  });

  document.querySelector("[data-action=ingest]").onclick = async () => {
    const raw = document.getElementById("raw").value.trim();
    if (!raw) {
      banner.hidden = false;
      banner.textContent = t("activities.empty_input");
      return;
    }
    const btn = document.querySelector("[data-action=ingest]");
    btn.disabled = true;
    try {
      const embeds = extractEmbedPaths(raw);
      const attachments =
        embeds.length || pendingAttach.length
          ? embeds.map((path) => {
              const hit = pendingAttach.find((a) => a.path === path);
              return {
                path,
                relationship:
                  (hit && hit.relationship) || t("activities.attachment_default_rel"),
              };
            })
          : undefined;
      const body = attachments && attachments.length ? { raw, attachments } : { raw };
      await api("/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      document.getElementById("raw").value = "";
      pendingAttach = [];
      refreshAttachPreview();
      banner.hidden = false;
      banner.textContent = t("activities.ok");
      eventsTab = "recent";
      await renderEvents();
    } catch (err) {
      btn.disabled = false;
      banner.hidden = false;
      banner.textContent = err instanceof Error ? err.message : String(err);
    }
  };

  showTab(eventsTab);
}

async function renderChain() {
  const level = new URLSearchParams(location.hash.split("?")[1] || "").get("level") || "day";
  const idx = await api("/chain?level=" + encodeURIComponent(level));
  const ids = idx.ids || [];
  app.innerHTML = `
    <div class="scene-fill memory-scene">
      <div class="memory-header">
        <h1>${escapeHtml(t("memory.title"))}</h1>
        ${memorySubnav("list")}
      </div>
      ${memoryListModes("chain")}
      <div class="browse-level-row memory-modes" role="tablist" aria-label="chain level">
        ${["day", "week", "month", "year"]
          .map(
            (l) =>
              `<button type="button" class="mode-btn${l === level ? " is-active" : ""}" data-l="${l}" role="tab" aria-selected="${l === level}">${l}</button>`,
          )
          .join("")}
      </div>
      <div class="browse-layout browse-layout-chain">
        <div class="browse-index browse-index-card" id="ids" role="listbox"></div>
        <article class="browse-detail packet-block">
          <h2 id="detail-title">${escapeHtml(t("memory.pick_chain"))}</h2>
          <p class="browse-meta" id="detail-meta"></p>
          <div class="md md-block is-empty" id="body"><p class="md-block-empty">${escapeHtml(t("memory.pick_chain"))}</p></div>
        </article>
      </div>
    </div>
  `;
  const idsEl = document.getElementById("ids");
  idsEl.innerHTML = ids.length
    ? ids
        .map(
          (id) =>
            `<button type="button" class="browse-item browse-item-chain" data-id="${escapeHtml(id)}" role="option"><span class="browse-item-id">${escapeHtml(id)}</span></button>`,
        )
        .join("")
    : `<p class="browse-empty">${escapeHtml(t("empty"))}</p>`;
  app.querySelectorAll("[data-l]").forEach((b) => {
    b.onclick = () => {
      location.hash = "#/memory?level=" + b.dataset.l;
    };
  });
  app.querySelectorAll("#ids [data-id]").forEach((b) => {
    b.onclick = async () => {
      app.querySelectorAll("#ids [data-id]").forEach((x) => x.classList.remove("is-selected"));
      b.classList.add("is-selected");
      const title = document.getElementById("detail-title");
      const meta = document.getElementById("detail-meta");
      const bodyEl = document.getElementById("body");
      title.textContent = b.dataset.id;
      meta.textContent = level;
      setMdBlock(bodyEl, t("loading"), { empty: true, emptyText: t("loading") });
      const d = await api(`/chain/${level}/${encodeURIComponent(b.dataset.id)}`);
      if (!d.present) {
        setMdBlock(bodyEl, t("memory.missing"), { empty: true, emptyText: t("memory.missing") });
      } else {
        setMdBlock(bodyEl, d.markdown);
      }
    };
  });
}

async function renderNodes() {
  const hashPath = location.hash.replace(/^#\/?/, "");
  const parts = hashPath.split("/");
  let preselect = "";
  if (parts[0] === "memory" && parts[1] === "nodes" && parts.length > 2) {
    preselect = normalizeNodeId(decodeURIComponent(parts.slice(2).join("/")));
  }
  const { nodes } = await api("/nodes");
  const list = nodes || [];
  app.innerHTML = `
    <div class="scene-fill memory-scene">
      <div class="memory-header">
        <h1>${escapeHtml(t("memory.title"))}</h1>
        ${memorySubnav("list")}
      </div>
      ${memoryListModes("nodes")}
      <div class="browse-layout browse-layout-nodes-list">
        <div class="browse-index browse-index-card" id="list" role="listbox"></div>
        <article class="browse-detail packet-block">
          <h2 id="detail-title">${escapeHtml(t("memory.pick_node"))}</h2>
          <p class="browse-meta" id="detail-meta"></p>
          <div class="md md-block is-empty" id="body"><p class="md-block-empty">${escapeHtml(t("memory.pick_node"))}</p></div>
        </article>
      </div>
    </div>
  `;
  document.getElementById("list").innerHTML =
    list
      .map(
        (n) =>
          `<button type="button" class="browse-item" data-id="${escapeHtml(n.id)}" role="option"><span class="browse-item-id">${escapeHtml(n.title || n.id)}</span></button>`,
      )
      .join("") || `<p class="browse-empty">${escapeHtml(t("empty"))}</p>`;

  async function selectNode(id) {
    id = normalizeNodeId(id);
    if (id) {
      const want = "#/memory/nodes/" + encodeURIComponent(id);
      if (location.hash !== want) history.replaceState(null, "", want);
    }
    let btn = null;
    app.querySelectorAll("#list [data-id]").forEach((x) => {
      x.classList.remove("is-selected");
      if (x.getAttribute("data-id") === id) btn = x;
    });
    if (btn) btn.classList.add("is-selected");
    document.getElementById("detail-title").textContent = id;
    document.getElementById("detail-meta").textContent = "";
    const bodyEl = document.getElementById("body");
    setMdBlock(bodyEl, t("loading"), { empty: true, emptyText: t("loading") });
    const d = await api("/nodes/" + encodeURIComponent(id));
    if (!d.present) {
      setMdBlock(bodyEl, t("memory.missing"), { empty: true, emptyText: t("memory.missing") });
    } else {
      setMdBlock(bodyEl, d.markdown);
    }
  }

  app.querySelectorAll("#list [data-id]").forEach((b) => {
    b.onclick = () => selectNode(b.getAttribute("data-id"));
  });
  if (preselect) await selectNode(preselect);
}

async function renderSeek() {
  app.innerHTML = `
    <section class="seek-col">
      <div class="memory-modes seek-modes" role="tablist" aria-label="${escapeHtml(t("seek.title"))}">
        <button type="button" class="mode-btn${seekMode === "ask" ? " is-active" : ""}" data-seek-mode="ask" role="tab" aria-selected="${seekMode === "ask"}">
          ${seekModeIcon("ask")}${escapeHtml(t("seek.mode_ask"))}
        </button>
        <button type="button" class="mode-btn${seekMode === "search" ? " is-active" : ""}" data-seek-mode="search" role="tab" aria-selected="${seekMode === "search"}">
          ${seekModeIcon("search")}${escapeHtml(t("seek.mode_search"))}
        </button>
      </div>
      <div id="seek-pane"></div>
    </section>
  `;

  const pane = document.getElementById("seek-pane");

  function showAskPane() {
    pane.innerHTML = `
      <div class="seek-ask-pane">
        <p class="scene-lead">${escapeHtml(t("seek.ask_lead"))}</p>
        <form class="recall-form ask-form" id="ask-form">
          <label class="sr-only" for="q">${escapeHtml(t("seek.ask_placeholder"))}</label>
          <textarea id="q" rows="4" placeholder="${escapeHtml(t("seek.ask_placeholder"))}" data-lock></textarea>
          <div class="ask-actions form-row">
            <button type="submit" class="btn primary" data-action="ask">${escapeHtml(t("seek.ask_btn"))}</button>
          </div>
        </form>
        <section class="seek-recent-asks" aria-label="${escapeHtml(t("seek.recent_asks"))}">
          <h2 class="seek-recent-asks-title">${escapeHtml(t("seek.recent_asks"))}</h2>
          <div id="ask-history"></div>
        </section>
        <article class="packet-block" id="ans-packet" hidden>
          <h2>${escapeHtml(t("seek.answer_title"))}</h2>
          <pre class="md md-block" id="ans"></pre>
        </article>
      </div>
    `;

    document.getElementById("ask-form").onsubmit = (ev) => {
      ev.preventDefault();
      runAction("ask", async () => {
        const q = document.getElementById("q").value.trim();
        if (!q) {
          actionLock = false;
          setControlsBusy();
          banner.hidden = false;
          banner.textContent = t("seek.ask_empty");
          return;
        }
        const { job_id } = await api("/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ q }),
        });
        const job = await waitJob(job_id);
        const ans = document.getElementById("ans");
        const packet = document.getElementById("ans-packet");
        if (ans && packet) {
          packet.hidden = false;
          ans.textContent =
            job.status === "completed" ? job.output?.text || t("seek.no_text") : job.error || "failed";
        }
        await loadAskHistory();
      });
    };

    async function loadAskHistory() {
      const box = document.getElementById("ask-history");
      if (!box) return;
      try {
        const { jobs } = await api("/jobs");
        const asks = (jobs || [])
          .filter((j) => j.kind === "ask" && (j.status === "completed" || j.status === "failed"))
          .slice(0, 20);
        if (!asks.length) {
          box.innerHTML = `<p class="seek-recent-asks-empty">${escapeHtml(t("seek.recent_empty"))}</p>`;
          return;
        }
        box.innerHTML = `<ul class="seek-recent-asks-list">${asks
          .map((j) => {
            const title = (j.input && j.input.q) || j.id;
            return `<li><button type="button" class="seek-recent-asks-item" data-job="${escapeHtml(j.id)}">
              <span class="seek-recent-asks-q">${escapeHtml(title)}</span>
              <span class="seek-recent-asks-meta">${escapeHtml(j.status)} · ${escapeHtml(j.created_at || "")}</span>
            </button></li>`;
          })
          .join("")}</ul>`;
        box.querySelectorAll("[data-job]").forEach((btn) => {
          btn.onclick = async () => {
            box.querySelectorAll("[data-job]").forEach((x) => x.classList.remove("is-selected"));
            btn.classList.add("is-selected");
            const job = await api("/jobs/" + encodeURIComponent(btn.dataset.job));
            const ans = document.getElementById("ans");
            const packet = document.getElementById("ans-packet");
            const qEl = document.getElementById("q");
            if (qEl && job.input && job.input.q) qEl.value = job.input.q;
            if (!ans || !packet) return;
            packet.hidden = false;
            if (job.status === "completed") ans.textContent = job.output?.text || t("seek.no_text");
            else ans.textContent = job.error || job.status || "failed";
            banner.hidden = false;
            banner.textContent = t("seek.review", { id: job.id });
          };
        });
      } catch (err) {
        box.innerHTML = `<p class="seek-recent-asks-empty">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`;
      }
    }

    loadAskHistory();
    setControlsBusy();
  }

  function showSearchPane() {
    pane.innerHTML = `
      <div class="seek-search-pane">
        <p class="scene-lead">${escapeHtml(t("seek.search_lead"))}</p>
        <form class="recall-form" id="search-form">
          <label class="sr-only" for="search-q">${escapeHtml(t("seek.search_placeholder"))}</label>
          <input id="search-q" type="search" placeholder="${escapeHtml(t("seek.search_placeholder"))}" data-lock autocomplete="off" />
          <button type="submit" class="btn primary" id="search-btn">${escapeHtml(t("seek.search_btn"))}</button>
        </form>
        <div id="search-hits"></div>
      </div>
    `;
    const hitsEl = document.getElementById("search-hits");
    const runSearch = async () => {
      const q = document.getElementById("search-q").value.trim();
      if (!q) {
        banner.hidden = false;
        banner.textContent = t("seek.search_empty_q");
        return;
      }
      hitsEl.innerHTML = `<p class="muted">${escapeHtml(t("seek.searching"))}</p>`;
      try {
        const data = await api("/search?q=" + encodeURIComponent(q));
        const hits = data.hits || [];
        hitsEl.innerHTML = hits.length
          ? `<div class="packet-block"><h2>${escapeHtml(t("seek.search_title"))}</h2>${hits
              .map(
                (h) =>
                  `<article class="search-hit-card hit"><div class="search-hit-path muted">${escapeHtml(h.path)}</div><div class="search-hit-snippet">${escapeHtml(h.snippet)}</div></article>`,
              )
              .join("")}</div>`
          : `<p class="muted">${escapeHtml(t("seek.no_hits"))}</p>`;
      } catch (err) {
        hitsEl.innerHTML = "";
        banner.hidden = false;
        banner.textContent = err instanceof Error ? err.message : String(err);
      }
    };
    document.getElementById("search-form").onsubmit = (ev) => {
      ev.preventDefault();
      runSearch();
    };
    setControlsBusy();
  }

  function showMode(mode) {
    seekMode = mode;
    app.querySelectorAll("[data-seek-mode]").forEach((btn) => {
      const on = btn.dataset.seekMode === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (mode === "search") showSearchPane();
    else showAskPane();
  }

  app.querySelectorAll("[data-seek-mode]").forEach((btn) => {
    btn.onclick = () => showMode(btn.dataset.seekMode);
  });
  showMode(seekMode);
}

async function renderClarify() {
  app.innerHTML = `
    <section class="inbox-scene">
      <p class="scene-lead">${escapeHtml(t("clarify.lead"))}</p>
      <form class="clarify-aside inbox-aside" id="aside-form">
        <div class="clarify-aside-main">
          <h2 class="clarify-aside-title">${escapeHtml(t("clarify.aside_title"))}</h2>
          <p class="clarify-aside-lead">${escapeHtml(t("clarify.aside_lead"))}</p>
          <label class="sr-only" for="aside-raw">${escapeHtml(t("clarify.aside_placeholder"))}</label>
          <textarea id="aside-raw" class="clarify-aside-input" rows="3" placeholder="${escapeHtml(t("clarify.aside_placeholder"))}" data-lock></textarea>
          <div class="inbox-aside-actions">
            <button type="submit" class="btn primary" id="aside-btn">${escapeHtml(t("clarify.aside_submit"))}</button>
          </div>
        </div>
      </form>
      <hr class="inbox-rule" />
      <div id="clarify-inbox"></div>
      <section class="clarify-pending-section">
        <h2>${escapeHtml(t("clarify.pending_title"))}</h2>
        <div id="clarify-pending"><p class="muted">${escapeHtml(t("loading"))}</p></div>
      </section>
    </section>
  `;

  const inboxEl = document.getElementById("clarify-inbox");
  const pendingEl = document.getElementById("clarify-pending");

  async function loadLists() {
    try {
      const [asking, pending] = await Promise.all([api("/clarify/asking"), api("/clarify/pending")]);
      const aItems = asking.items || [];
      if (clarifySelectedId && !aItems.some((it) => it.id === clarifySelectedId)) {
        clarifySelectedId = null;
      }
      if (!clarifySelectedId && aItems[0]) clarifySelectedId = aItems[0].id;

      if (!aItems.length) {
        inboxEl.innerHTML = `<div class="inbox-layout is-empty"><p class="empty-hint">${escapeHtml(t("clarify.prompts_empty"))}</p></div>`;
      } else {
        const selected = aItems.find((it) => it.id === clarifySelectedId) || aItems[0];
        clarifySelectedId = selected.id;
        const threads = aItems
          .map((it) => {
            const preview = stripFm(it.markdown);
            const on = it.id === clarifySelectedId;
            return `<li>
              <button type="button" class="inbox-thread${on ? " is-active" : ""}" data-cla="${escapeHtml(it.id)}">
                ${it.ts ? `<time class="inbox-thread-time">${escapeHtml(it.ts)}</time>` : ""}
                <span class="inbox-thread-preview">${escapeHtml(preview)}</span>
              </button>
            </li>`;
          })
          .join("");
        const body = stripFm(selected.markdown);
        inboxEl.innerHTML = `
          <div class="inbox-layout">
            <div class="inbox-list">
              <h2 class="sr-only">${escapeHtml(t("clarify.asking"))}</h2>
              <ul class="inbox-threads">${threads}</ul>
            </div>
            <div class="inbox-pane">
              <div class="inbox-message">
                ${selected.ts ? `<time class="clarify-post-time">${escapeHtml(selected.ts)}</time>` : ""}
                <p class="clarify-post-body">${escapeHtml(body)}</p>
              </div>
              <label class="sr-only" for="inbox-reply">${escapeHtml(t("clarify.answer_placeholder"))}</label>
              <textarea id="inbox-reply" class="clarify-answer" rows="5" placeholder="${escapeHtml(t("clarify.answer_placeholder"))}" data-lock></textarea>
              <div class="inbox-pane-actions">
                <button type="button" class="btn primary cla-submit">${escapeHtml(t("clarify.submit"))}</button>
                <button type="button" class="btn ghost cla-dismiss">${escapeHtml(t("clarify.dismiss"))}</button>
              </div>
            </div>
          </div>`;

        inboxEl.querySelectorAll("[data-cla]").forEach((btn) => {
          btn.onclick = () => {
            clarifySelectedId = btn.getAttribute("data-cla");
            loadLists();
          };
        });

        const id = selected.id;
        inboxEl.querySelector(".cla-submit").onclick = async () => {
          const answer = document.getElementById("inbox-reply").value.trim();
          if (!answer) {
            banner.hidden = false;
            banner.textContent = t("clarify.answer_empty");
            return;
          }
          try {
            await api("/clarify/asking/" + encodeURIComponent(id) + "/submit", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ answer }),
            });
            banner.hidden = false;
            banner.textContent = t("clarify.submit_ok", { id });
            clarifySelectedId = null;
            await loadLists();
          } catch (err) {
            banner.hidden = false;
            banner.textContent = err instanceof Error ? err.message : String(err);
          }
        };
        inboxEl.querySelector(".cla-dismiss").onclick = async () => {
          try {
            await api("/clarify/asking/" + encodeURIComponent(id), { method: "DELETE" });
            banner.hidden = false;
            banner.textContent = t("clarify.dismiss_ok", { id });
            clarifySelectedId = null;
            await loadLists();
          } catch (err) {
            banner.hidden = false;
            banner.textContent = err instanceof Error ? err.message : String(err);
          }
        };
      }

      const pItems = pending.items || [];
      pendingEl.innerHTML = pItems.length
        ? `<div class="clarify-pending-list">${pItems
            .map(
              (it) =>
                `<article class="card"><div class="muted">${escapeHtml(it.ts || "")} · ${escapeHtml(it.id)}</div><pre class="md">${escapeHtml(it.markdown)}</pre></article>`,
            )
            .join("")}</div>`
        : `<p class="muted">${escapeHtml(t("empty"))}</p>`;
    } catch (err) {
      inboxEl.innerHTML = `<div class="inbox-layout is-empty"><p class="empty-hint">${escapeHtml(err instanceof Error ? err.message : String(err))}</p></div>`;
      pendingEl.innerHTML = "";
    }
  }

  document.getElementById("aside-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const raw = document.getElementById("aside-raw").value.trim();
    if (!raw) {
      banner.hidden = false;
      banner.textContent = t("clarify.aside_empty");
      return;
    }
    try {
      const res = await api("/clarify/aside", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      document.getElementById("aside-raw").value = "";
      banner.hidden = false;
      banner.textContent = t("clarify.aside_ok", { id: res.id || "" });
      await loadLists();
    } catch (err) {
      banner.hidden = false;
      banner.textContent = err instanceof Error ? err.message : String(err);
    }
  };

  await loadLists();
  setControlsBusy();
}

async function renderGraph() {
  /** @type {"title"|"title_summary"} */
  let searchMode = "title";
  let filterQ = "";
  /** @type {Array<{id:string,title:string,summary:string,markdown:string,preview:string}>} */
  let allNodes = [];
  /** @type {Array<{from:string,to:string,level?:number}>} */
  let allEdges = [];
  /** @type {{ setHits: Function, setSelected: Function } | null} */
  let graphApi = null;

  app.innerHTML = `
    <div class="scene-fill memory-scene">
      <div class="memory-header">
        <h1>${escapeHtml(t("memory.title"))}</h1>
        ${memorySubnav("graph")}
      </div>
      <p class="scene-lead">${escapeHtml(t("memory.graph_lead"))}</p>
      <div class="browse-layout browse-layout-nodes">
        <div class="browse-sidebar node-graph-sidebar">
          <label class="sr-only" for="memory-nodes-filter">${escapeHtml(t("memory.nodes_filter"))}</label>
          <input id="memory-nodes-filter" class="browse-filter node-user-filter" type="search" placeholder="${escapeHtml(t("memory.nodes_filter"))}" />
          <div class="node-search-mode" role="group" aria-label="${escapeHtml(t("memory.nodes_search_mode"))}">
            <span class="node-search-mode-label">${escapeHtml(t("memory.nodes_search_mode"))}:</span>
            <div class="node-search-mode-widget">
              <button type="button" class="node-search-mode-opt is-active" data-search-mode="title" aria-pressed="true">${escapeHtml(t("memory.nodes_search_title"))}</button>
              <button type="button" class="node-search-mode-opt" data-search-mode="title_summary" aria-pressed="false">${escapeHtml(t("memory.nodes_search_title_summary"))}</button>
            </div>
          </div>
          <div id="graph-wrap" class="node-graph-pane graph-wrap"><p class="muted">${escapeHtml(t("loading"))}</p></div>
          <p class="muted graph-meta" id="graph-meta"></p>
        </div>
        <article class="browse-detail packet-block">
          <h2 id="detail-title">${escapeHtml(t("memory.pick_node"))}</h2>
          <p class="browse-meta" id="detail-meta"></p>
          <div class="md md-block is-empty" id="body"><p class="md-block-empty">${escapeHtml(t("memory.pick_node"))}</p></div>
        </article>
      </div>
    </div>
  `;

  const wrap = document.getElementById("graph-wrap");
  const filterInput = document.getElementById("memory-nodes-filter");
  const metaEl = document.getElementById("graph-meta");

  function nodeSummaryText(n) {
    if (n.summary) return n.summary;
    if (n.preview) return n.preview;
    if (n.markdown) {
      const body = stripFm(n.markdown).replace(/\s+/g, " ").trim();
      return body.slice(0, 160);
    }
    return n.title || n.id || "";
  }

  function hitSet() {
    const q = filterQ.trim().toLowerCase();
    if (!q) return new Set(allNodes.map((n) => n.id));
    return new Set(
      allNodes
        .filter((n) => {
          const title = String(n.title || n.id || "").toLowerCase();
          const id = String(n.id || "").toLowerCase();
          if (title.includes(q) || id.includes(q)) return true;
          if (searchMode === "title_summary") {
            const sum = nodeSummaryText(n).toLowerCase();
            if (sum.includes(q)) return true;
          }
          return false;
        })
        .map((n) => n.id),
    );
  }

  function applyGraphFilter() {
    if (!graphApi) return;
    const hits = hitSet();
    graphApi.setHits(hits);
    const visibleEdges = allEdges.filter((e) => hits.has(e.from) && hits.has(e.to));
    if (metaEl) {
      metaEl.textContent = t("memory.graph_meta", {
        nodes: filterQ.trim() ? hits.size : allNodes.length,
        edges: filterQ.trim() ? visibleEdges.length : allEdges.length,
      });
    }
  }

  async function loadNodeDetail(id) {
    if (graphApi) graphApi.setSelected(id);
    document.getElementById("detail-title").textContent = id;
    document.getElementById("detail-meta").textContent = "";
    const bodyEl = document.getElementById("body");
    setMdBlock(bodyEl, t("loading"), { empty: true, emptyText: t("loading") });
    try {
      const d = await api("/nodes/" + encodeURIComponent(id));
      if (!d.present) {
        setMdBlock(bodyEl, t("memory.missing"), { empty: true, emptyText: t("memory.missing") });
      } else {
        setMdBlock(bodyEl, d.markdown);
        const node = allNodes.find((n) => n.id === id);
        if (node && !node.summary && d.markdown) {
          node.markdown = d.markdown;
          node.summary = nodeSummaryText(node);
          applyGraphFilter();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMdBlock(bodyEl, msg, { empty: true, emptyText: msg });
    }
  }

  filterInput.oninput = () => {
    filterQ = filterInput.value || "";
    applyGraphFilter();
  };

  app.querySelectorAll("[data-search-mode]").forEach((btn) => {
    btn.onclick = () => {
      searchMode = btn.dataset.searchMode === "title_summary" ? "title_summary" : "title";
      app.querySelectorAll("[data-search-mode]").forEach((b) => {
        const on = b.dataset.searchMode === searchMode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      applyGraphFilter();
    };
  });

  try {
    const data = await api("/nodes/graph");
    allNodes = (data.nodes || []).map((n) => ({
      id: n.id || n.node,
      title: n.title || n.id || n.node || "",
      summary: n.summary || n.preview || "",
      markdown: "",
      preview: n.preview || "",
    }));
    allEdges = (data.edges || []).map((e) => ({
      from: e.from || e.a,
      to: e.to || e.b,
      level: e.level || 1,
    }));
    if (!allNodes.length) {
      wrap.innerHTML = `<p class="browse-empty">${escapeHtml(t("memory.graph_empty"))}</p>`;
      if (metaEl) metaEl.textContent = "";
      return;
    }

    try {
      const idx = await api("/nodes");
      const byId = Object.fromEntries((idx.nodes || []).map((n) => [n.id, n]));
      for (const n of allNodes) {
        const hit = byId[n.id];
        if (!hit) continue;
        if (hit.title) n.title = hit.title;
        if (hit.summary) n.summary = hit.summary;
        else if (hit.preview) n.summary = hit.preview;
      }
    } catch {
      /* index optional */
    }

    wrap.innerHTML = `<svg id="graph-svg" class="graph-svg node-graph-svg" role="img" aria-label="${escapeHtml(t("memory.graph_aria"))}"></svg>`;
    graphApi = mountForceGraph(document.getElementById("graph-svg"), allNodes, allEdges, {
      onSelect: (id) => loadNodeDetail(id),
    });
    applyGraphFilter();
  } catch (err) {
    wrap.innerHTML = `<p class="browse-empty">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`;
  }
}

/** Simple SVG force-directed layout (no external deps). */
function mountForceGraph(svg, nodes, edges, opts) {
  opts = opts || {};
  const parent = svg.parentElement;
  const W = Math.max(480, (parent && parent.clientWidth) || 640);
  const H = Math.max(320, (parent && parent.clientHeight) || 420);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const pts = nodes.map((n, i) => {
    const ang = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
    return {
      id: n.id,
      title: n.title || n.id,
      x: W / 2 + Math.cos(ang) * Math.min(W, H) * 0.28,
      y: H / 2 + Math.sin(ang) * Math.min(W, H) * 0.28,
      vx: 0,
      vy: 0,
    };
  });
  const byId = Object.fromEntries(pts.map((p) => [p.id, p]));
  const links = edges
    .map((e) => ({
      a: byId[e.from],
      b: byId[e.to],
      from: e.from,
      to: e.to,
    }))
    .filter((l) => l.a && l.b);

  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const gLines = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const gNodes = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(gLines);
  svg.appendChild(gNodes);

  const lineEls = links.map((l) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "graph-edge node-graph-edge");
    line.dataset.a = l.from;
    line.dataset.b = l.to;
    gLines.appendChild(line);
    return line;
  });

  const nodeEls = pts.map((p) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "graph-node node-graph-node");
    g.dataset.id = p.id;
    g.style.cursor = "pointer";
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("r", "10");
    const tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tx.setAttribute("dy", "24");
    tx.setAttribute("text-anchor", "middle");
    const label = p.title.length > 12 ? p.title.slice(0, 11) + "…" : p.title;
    tx.textContent = label;
    g.appendChild(c);
    g.appendChild(tx);
    g.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (typeof opts.onSelect === "function") opts.onSelect(p.id);
    });
    gNodes.appendChild(g);
    return g;
  });

  let hits = new Set(pts.map((p) => p.id));
  let selectedId = null;

  function paintFilter() {
    const filtering = hits.size !== pts.length;
    for (let i = 0; i < pts.length; i++) {
      const id = pts[i].id;
      const dim = filtering && !hits.has(id);
      nodeEls[i].classList.toggle("is-dim", dim);
      nodeEls[i].classList.toggle("is-selected", id === selectedId);
    }
    for (let i = 0; i < links.length; i++) {
      const l = links[i];
      const dim = filtering && (!hits.has(l.from) || !hits.has(l.to));
      lineEls[i].classList.toggle("is-dim", dim);
    }
  }

  const N = pts.length;
  let tick = 0;
  const maxTick = 180;

  function step() {
    tick++;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = pts[i];
        const b = pts[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist2 = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(dist2);
        const force = 1200 / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    for (const l of links) {
      let dx = l.b.x - l.a.x;
      let dy = l.b.y - l.a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const target = 90;
      const force = (dist - target) * 0.05;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      l.a.vx += fx;
      l.a.vy += fy;
      l.b.vx -= fx;
      l.b.vy -= fy;
    }
    for (const p of pts) {
      p.vx += (W / 2 - p.x) * 0.01;
      p.vy += (H / 2 - p.y) * 0.01;
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.x = Math.max(24, Math.min(W - 24, p.x + p.vx));
      p.y = Math.max(24, Math.min(H - 24, p.y + p.vy));
    }
    for (let i = 0; i < links.length; i++) {
      const l = links[i];
      const el = lineEls[i];
      el.setAttribute("x1", l.a.x);
      el.setAttribute("y1", l.a.y);
      el.setAttribute("x2", l.b.x);
      el.setAttribute("y2", l.b.y);
    }
    for (let i = 0; i < N; i++) {
      nodeEls[i].setAttribute("transform", `translate(${pts[i].x},${pts[i].y})`);
    }
    paintFilter();
    if (tick < maxTick) requestAnimationFrame(step);
  }
  step();

  return {
    setHits(next) {
      hits = next instanceof Set ? next : new Set(next || []);
      paintFilter();
    },
    setSelected(id) {
      selectedId = id || null;
      paintFilter();
    },
  };
}

function stripFm(md) {
  const m = String(md).match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
}

function extractEmbedPaths(raw) {
  const re = /!\[\[(_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/[^|/\]\n]+)\]\]/g;
  const out = [];
  let m;
  while ((m = re.exec(String(raw)))) out.push(m[1]);
  return out;
}

function setMdBlock(el, text, opts) {
  opts = opts || {};
  if (!el) return;
  const raw = text == null ? "" : String(text);
  const empty = Boolean(opts.empty) || !raw.trim();
  el.classList.add("md", "md-block");
  el.classList.toggle("is-empty", empty);
  if (empty) {
    el.innerHTML = `<p class="md-block-empty">${escapeHtml(opts.emptyText || raw || "—")}</p>`;
    return;
  }
  el.innerHTML = renderMarkdownHtml(raw);
}

/** Normalize vault wikilink / hash target → lite node id (folder slug). */
function normalizeNodeId(raw) {
  let id = String(raw || "").trim();
  if (!id) return "";
  id = id.replace(/^\/+/, "").replace(/\.md$/i, "");
  if (id.startsWith("nodes/")) id = id.slice("nodes/".length);
  const parts = id.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    return parts[parts.length - 1];
  }
  if (parts.length >= 1) return parts[parts.length - 1];
  return id;
}

/** Lightweight markdown → HTML (ATX headings, p, ul/ol, emphasis, code, hr, wikilinks, attachment embeds). */
function renderMarkdownHtml(md) {
  const src = String(md ?? "").replace(/\r\n?/g, "\n");
  const tokens = [];
  function tok(html) {
    const key = `%%MD${tokens.length}%%`;
    tokens.push(html);
    return key;
  }

  let s = src;
  // Attachment embeds: ![[_attachments/uploads/...]]
  s = s.replace(
    /!\[\[(_attachments\/uploads\/[^\]|]+?)\]\]/g,
    (_, path) =>
      tok(
        `<img class="md-block-img embed-img" src="/attachments/file?path=${encodeURIComponent(path)}" alt="${escapeHtml(path)}" loading="lazy" />`,
      ),
  );
  // Wikilinks: [[id|label]] or [[id]]
  // Wikilinks: [[id|label]] or [[id]] — vault paths like nodes/x/x normalize to lite id
  s = s.replace(/\[\[([^\]|\n]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
    const rawTarget = String(id).trim();
    const nodeId = normalizeNodeId(rawTarget);
    const text = (label != null ? String(label) : (rawTarget.split("/").pop() || rawTarget)).trim();
    const href = nodeId ? `#/memory/nodes/${encodeURIComponent(nodeId)}` : `#/memory/nodes`;
    return tok(
      `<a class="wiki-link" href="${href}">${escapeHtml(text)}</a>`,
    );
  });

  // Protect inline code
  s = s.replace(/`([^`\n]+)`/g, (_, code) => tok(`<code>${escapeHtml(code)}</code>`));

  const lines = s.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const hr = /^(?:-{3,}|\*{3,}|_{3,})\s*$/.exec(line);
    if (hr) {
      blocks.push("<hr />");
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    const ul = /^(\s*)[-*+]\s+(.+)$/.exec(line);
    const ol = /^(\s*)\d+[.)]\s+(.+)$/.exec(line);
    if (ul || ol) {
      const ordered = Boolean(ol);
      const items = [];
      while (i < lines.length) {
        const m = ordered
          ? /^(\s*)\d+[.)]\s+(.+)$/.exec(lines[i])
          : /^(\s*)[-*+]\s+(.+)$/.exec(lines[i]);
        if (!m) break;
        items.push(`<li>${formatInline(m[2])}</li>`);
        i++;
      }
      blocks.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim()) {
      if (/^(#{1,6})\s+/.test(lines[i])) break;
      if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) break;
      if (/^\s*[-*+]\s+/.test(lines[i])) break;
      if (/^\s*\d+[.)]\s+/.test(lines[i])) break;
      para.push(lines[i]);
      i++;
    }
    blocks.push(`<p>${formatInline(para.join("\n"))}</p>`);
  }

  let html = blocks.join("\n");
  // Restore tokens (may be nested once)
  for (let n = 0; n < 3; n++) {
    for (let t = 0; t < tokens.length; t++) {
      html = html.split(`%%MD${t}%%`).join(tokens[t]);
    }
  }
  return html;

  function formatInline(text) {
    let x = escapeHtml(String(text));
    // Restore early tokens that were escaped? Tokens use %%MD which survives escapeHtml.
    // Bold / italic after escape
    x = x.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    x = x.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    x = x.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    x = x.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    x = x.replace(/\n/g, "<br />");
    return x;
  }
}

/** Legacy helper for event cards: pretty markdown (attachments + basic md). */
function renderEmbedsHtml(text) {
  return renderMarkdownHtml(text);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document.querySelectorAll("[data-locale]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (window.EngramI18n) window.EngramI18n.setLocale(btn.dataset.locale);
  });
});

if (window.EngramI18n && window.EngramI18n.onLocaleChange) {
  window.EngramI18n.onLocaleChange(() => {
    syncLocaleButtons();
    route();
  });
}

window.addEventListener("hashchange", route);
syncLocaleButtons();
route();
pollJob();
clearInterval(pollTimer);
pollTimer = setInterval(pollJob, 1500);
