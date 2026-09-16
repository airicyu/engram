const app = document.getElementById("app");
const banner = document.getElementById("job-banner");

let pollTimer = null;
let activeJobId = sessionStorage.getItem("engramLiteJob") || "";
let actionLock = false;

const busyLabel = {
  ingest: "記入中…",
  distill: "沉澱中…",
  ask: "提問中…",
};

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
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
    if (busy && kind && el.dataset.action === kind) el.textContent = busyLabel[kind] || "處理中…";
    else el.textContent = el.dataset.label;
  });
  document.querySelectorAll("[data-lock]").forEach((el) => {
    el.disabled = busy;
  });
}

function route() {
  const h = location.hash.slice(2) || "events";
  if (h.startsWith("chain")) return renderChain();
  if (h.startsWith("nodes")) return renderNodes();
  if (h.startsWith("ask")) return renderAsk();
  return renderEvents();
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
        banner.textContent = "上一場 job 已中斷，可再按";
        clearJob();
        setControlsBusy();
        return;
      }
    }
    banner.hidden = false;
    banner.textContent = `${job.kind} · ${job.status}` + (job.error ? ` · ${job.error}` : "");
    if (actionLock) setControlsBusy(job.kind);
    if (terminal) {
      const wasComplete = job.status === "completed";
      clearJob();
      setControlsBusy();
      if (wasComplete) route();
    }
  } catch {
    banner.hidden = false;
    banner.textContent = "job 已中斷，可再按";
    clearJob();
    setControlsBusy();
  }
}

async function waitJob(jobId) {
  setJob(jobId);
  for (;;) {
    const job = await api("/jobs/" + encodeURIComponent(jobId));
    banner.hidden = false;
    banner.textContent = `${job.kind} · ${job.status}` + (job.error ? ` · ${job.error}` : "");
    setControlsBusy(job.kind);
    if (job.status === "completed" || job.status === "failed") {
      const text = `${job.kind} · ${job.status}`;
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
  banner.textContent = `${kind} · 送出中`;
  try {
    return await fn();
  } catch (err) {
    actionLock = false;
    setControlsBusy();
    banner.hidden = false;
    banner.textContent = err instanceof Error ? err.message : String(err);
  }
}

async function renderEvents() {
  const pool = await api("/pool");
  app.innerHTML = `
    <h1>事件</h1>
    <p class="muted">記入 pool 立刻寫檔，不經 Pi。沉澱仍會跑模型，按下後鎖定直到結束。</p>
    <textarea id="raw" rows="4" placeholder="要記住的事…" data-lock></textarea>
    <div class="row">
      <button type="button" data-action="ingest">記入 pool</button>
      <button type="button" class="secondary" data-action="distill">沉澱記憶</button>
    </div>
    <h2>暫存 pool</h2>
    <div id="pending"></div>
  `;
  const list = (items) =>
    items.length
      ? items.map((e) => `<article class="card"><div class="muted">${e.ts} · ${e.id}</div><div>${escapeHtml(e.raw)}</div>${e.note ? `<div class="muted">${escapeHtml(e.note)}</div>` : ""}</article>`).join("")
      : `<p class="muted">（空）</p>`;
  document.getElementById("pending").innerHTML = list(pool.pending);
  document.querySelector("[data-action=ingest]").onclick = async () => {
    const raw = document.getElementById("raw").value.trim();
    if (!raw) {
      banner.hidden = false;
      banner.textContent = "請先輸入內容";
      return;
    }
    const btn = document.querySelector("[data-action=ingest]");
    btn.disabled = true;
    try {
      await api("/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      document.getElementById("raw").value = "";
      banner.hidden = false;
      banner.textContent = "已記入 pool";
      await renderEvents();
    } catch (err) {
      btn.disabled = false;
      banner.hidden = false;
      banner.textContent = err instanceof Error ? err.message : String(err);
    }
  };
  document.querySelector("[data-action=distill]").onclick = () =>
    runAction("distill", async () => {
      const { job_id } = await api("/distill", { method: "POST" });
      await waitJob(job_id);
      renderEvents();
    });
  setControlsBusy();
}

async function renderChain() {
  const level = new URLSearchParams(location.hash.split("?")[1] || "").get("level") || "day";
  const idx = await api("/chain?level=" + encodeURIComponent(level));
  app.innerHTML = `
    <h1>記憶鏈</h1>
    <div class="row">
      ${["day", "week", "month", "year"].map((l) => `<button type="button" class="${l === level ? "" : "secondary"}" data-l="${l}">${l}</button>`).join("")}
    </div>
    <div class="pills" id="ids"></div>
    <pre class="card md" id="body">選一則</pre>
  `;
  document.getElementById("ids").innerHTML = idx.ids
    .map((id) => `<button type="button" class="pill" data-id="${id}">${id}</button>`)
    .join("") || `<p class="muted">（空）</p>`;
  app.querySelectorAll("[data-l]").forEach((b) => {
    b.onclick = () => {
      location.hash = "#/chain?level=" + b.dataset.l;
    };
  });
  app.querySelectorAll("#ids [data-id]").forEach((b) => {
    b.onclick = async () => {
      app.querySelectorAll("#ids [data-id]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      document.getElementById("body").textContent = "載入中…";
      const d = await api(`/chain/${level}/${encodeURIComponent(b.dataset.id)}`);
      document.getElementById("body").textContent = d.present ? d.markdown : "（無檔）";
    };
  });
}

async function renderNodes() {
  const { nodes } = await api("/nodes");
  app.innerHTML = `
    <h1>節點</h1>
    <div class="pills" id="list"></div>
    <pre class="card md" id="body">選一個</pre>
  `;
  document.getElementById("list").innerHTML =
    nodes.map((n) => `<button type="button" class="pill" data-id="${n.id}">${escapeHtml(n.title)}</button>`).join("") ||
    `<p class="muted">（空）</p>`;
  app.querySelectorAll("#list [data-id]").forEach((b) => {
    b.onclick = async () => {
      app.querySelectorAll("#list [data-id]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      document.getElementById("body").textContent = "載入中…";
      const d = await api("/nodes/" + encodeURIComponent(b.dataset.id));
      document.getElementById("body").textContent = d.present ? d.markdown : "（無檔）";
    };
  });
}

async function renderAsk() {
  app.innerHTML = `
    <h1>提問</h1>
    <p class="muted">按下後會鎖定，直到回答回來。</p>
    <textarea id="q" rows="3" placeholder="問記憶…" data-lock></textarea>
    <div class="row"><button type="button" data-action="ask">問</button></div>
    <pre class="card md" id="ans"></pre>
  `;
  document.querySelector("[data-action=ask]").onclick = () =>
    runAction("ask", async () => {
      const q = document.getElementById("q").value.trim();
      if (!q) {
        actionLock = false;
        setControlsBusy();
        banner.hidden = false;
        banner.textContent = "請先輸入問題";
        return;
      }
      const { job_id } = await api("/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const job = await waitJob(job_id);
      const ans = document.getElementById("ans");
      if (ans) {
        ans.textContent = job.status === "completed" ? job.output?.text || "（無文字）" : job.error || "failed";
      }
    });
  setControlsBusy();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

window.addEventListener("hashchange", route);
route();
pollJob();
clearInterval(pollTimer);
pollTimer = setInterval(pollJob, 1500);
