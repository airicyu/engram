/** Engram Lite UI i18n (zh-Hant | en). */
(function (global) {
  const STORAGE_KEY = "engram-lite.locale";

  const zh = {
    "brand.lite": "Lite",
    "nav.scenes": "主選單",
    "nav.events": "事件",
    "nav.seek": "尋問",
    "nav.clarify": "提問郵箱",
    "nav.memory": "記憶",
    "locale.zh": "繁體中文",
    "locale.en": "English",
    "locale.switch": "介面語言",
    "loading": "載入中…",
    "empty": "（空）",
    "busy.ingest": "記入中…",
    "busy.distill": "沉澱中…",
    "busy.ask": "提問中…",
    "busy.generic": "處理中…",
    "job.sending": "{kind} · 送出中",
    "job.interrupted": "上一場 job 已中斷，可再按",
    "job.gone": "job 已中斷，可再按",
    "activities.lead": "寫下此刻要記住的事。",
    "activities.placeholder": "今天發生了什麼、要記得的判斷或細節…",
    "activities.submit": "發帖",
    "activities.attachment_add": "加圖",
    "activities.attachment_relationship_placeholder": "這張圖與記憶的關係…",
    "activities.attachment_remove": "移除",
    "activities.attachment_default_rel": "本則附圖",
    "activities.empty_input": "請先輸入內容",
    "activities.ok": "已發帖",
    "activities.uploaded": "已上傳 · {path}",
    "events.tab_recent": "近期輸入內容",
    "events.tab_consolidate": "沉澱入夢",
    "activities.recent_events_heading": "近期輸入的事件",
    "activities.recent_events_empty": "（尚無近期事件）",
    "distill.title": "沉澱入夢",
    "distill.lead": "將暫存 pool 沉澱進長期記憶（會跑模型）。",
    "distill.action": "開始沉澱",
    "distill.busy_conflict": "已有沉澱在進行或排隊，已拒絕重複啟動（避免並行寫庫）",
    "distill.status": "狀態",
    "distill.result": "結果",
    "distill.idle": "待命",
    "seek.title": "尋問",
    "seek.search_title": "搜尋",
    "seek.search_lead": "機械關鍵字搜尋（chain／nodes／pending），不經 Pi。",
    "seek.search_placeholder": "關鍵字…",
    "seek.search_btn": "搜尋",
    "seek.search_empty_q": "請先輸入關鍵字",
    "seek.searching": "搜尋中…",
    "seek.no_hits": "（無命中）",
    "seek.ask_title": "提問",
    "seek.ask_lead": "按下後會鎖定，直到回答回來。",
    "seek.ask_placeholder": "問記憶…",
    "seek.ask_btn": "問",
    "seek.ask_empty": "請先輸入問題",
    "seek.recent_asks": "近期提問",
    "seek.recent_empty": "（尚無終態提問）",
    "seek.no_text": "（無文字）",
    "seek.review": "回看 · {id}",
    "seek.mode_ask": "提問",
    "seek.mode_search": "搜尋",
    "seek.answer_title": "答案",
    "seek.cancel": "取消",
    "clarify.prompts_empty": "目前沒有待答補問。",
    "clarify.thread_empty": "選一則提問開始回覆。",
    "clarify.loading": "載入中…",
    "clarify.title": "提問郵箱",
    "clarify.lead": "系統補問在此作答；順帶補充直接進 pending，下次沉澱吸收。不經 approve。",
    "clarify.asking": "待回答",
    "clarify.aside_title": "順帶補充",
    "clarify.aside_lead": "不是 pool 事件；直接寫入 clarify/pending。",
    "clarify.aside_placeholder": "想補充的事…",
    "clarify.aside_submit": "送出補充",
    "clarify.aside_empty": "請先輸入補充內容",
    "clarify.aside_ok": "已補充 · {id}",
    "clarify.pending_title": "待沉澱（已答／補充）",
    "clarify.no_asking": "（無待答題）",
    "clarify.answer_placeholder": "你的回答…",
    "clarify.submit": "送出回答",
    "clarify.dismiss": "略過",
    "clarify.answer_empty": "請先輸入回答",
    "clarify.submit_ok": "已送出 · {id}",
    "clarify.dismiss_ok": "已略過 · {id}",
    "memory.title": "記憶",
    "memory.lead": "翻閱記憶鏈、節點與未來視。",
    "memory.chain": "記憶鏈",
    "memory.chain_day": "日",
    "memory.chain_week": "週",
    "memory.chain_month": "月",
    "memory.chain_year": "年",
    "memory.nodes": "節點",
    "memory.future": "未來視",
    "memory.future_lead": "近端與長期規劃錨點（開頁時會掃過期項並寫入 pending，對齊 Engram GET 行為）。",
    "memory.future_meta": "視窗 {window} 天 · 近端 {upcoming} 天",
    "memory.future_zone_upcoming": "即將",
    "memory.future_zone_long": "長遠",
    "memory.future_empty": "（尚無未來視錨點）",
    "memory.pick_future": "選一則錨點",
    "memory.future_no_body": "（無正文）",
    "memory.future_swept": "本次已清除 {count} 則過期錨點（已寫入 pending）",
    "memory.pick_chain": "選一則",
    "memory.chain_empty": "此層記憶鏈尚無內容。",
    "memory.pick_node": "選一個",
    "memory.missing": "（無檔）",
    "memory.graph_lead": "節點 wikilink 圖（兩邊都存在才成邊；不經 Pi）。",
    "memory.graph_empty": "（尚無節點）",
    "memory.graph_meta": "{nodes} 點 · {edges} 邊",
    "memory.graph_aria": "節點圖",
    "memory.nodes_filter": "篩選節點…",
    "memory.nodes_search_mode": "搜尋模式",
    "memory.nodes_search_title": "標題",
    "memory.nodes_search_title_summary": "標題＋摘要",
    "memory.nodes_empty": "（尚無節點）",
    "memory.filter_empty": "（無符合的節點）",
  };

  const en = {
    "brand.lite": "Lite",
    "nav.scenes": "Main menu",
    "nav.events": "Events",
    "nav.seek": "Seek",
    "nav.clarify": "Question inbox",
    "nav.memory": "Memory",
    "locale.zh": "繁體中文",
    "locale.en": "English",
    "locale.switch": "UI language",
    "loading": "Loading…",
    "empty": "(empty)",
    "busy.ingest": "Saving…",
    "busy.distill": "Distilling…",
    "busy.ask": "Asking…",
    "busy.generic": "Working…",
    "job.sending": "{kind} · sending",
    "job.interrupted": "Previous job interrupted — try again",
    "job.gone": "Job interrupted — try again",
    "activities.lead": "Write what you want to remember now.",
    "activities.placeholder": "What happened, judgments or details to keep…",
    "activities.submit": "Post",
    "activities.attachment_add": "Add image",
    "activities.attachment_relationship_placeholder": "How this image relates to the memory…",
    "activities.attachment_remove": "Remove",
    "activities.attachment_default_rel": "Attachment for this note",
    "activities.empty_input": "Please enter content",
    "activities.ok": "Posted",
    "activities.uploaded": "Uploaded · {path}",
    "events.tab_recent": "Recent input",
    "events.tab_consolidate": "Consolidate",
    "activities.recent_events_heading": "Recent events",
    "activities.recent_events_empty": "(no recent events)",
    "distill.title": "Consolidate",
    "distill.lead": "Distill the pending pool into long-term memory (runs the model).",
    "distill.action": "Start distill",
    "distill.busy_conflict": "A distill is already queued or running; refused duplicate start to protect the vault",
    "distill.status": "Status",
    "distill.result": "Result",
    "distill.idle": "Idle",
    "seek.title": "Seek",
    "seek.search_title": "Search",
    "seek.search_lead": "Keyword search over chain / nodes / pending (no Pi).",
    "seek.search_placeholder": "Keywords…",
    "seek.search_btn": "Search",
    "seek.search_empty_q": "Enter a keyword first",
    "seek.searching": "Searching…",
    "seek.no_hits": "(no hits)",
    "seek.ask_title": "Ask",
    "seek.ask_lead": "Locked until the answer returns.",
    "seek.ask_placeholder": "Ask memory…",
    "seek.ask_btn": "Ask",
    "seek.ask_empty": "Enter a question first",
    "seek.recent_asks": "Recent asks",
    "seek.recent_empty": "(no finished asks yet)",
    "seek.no_text": "(no text)",
    "seek.review": "Review · {id}",
    "seek.mode_ask": "Ask",
    "seek.mode_search": "Search",
    "seek.answer_title": "Answer",
    "seek.cancel": "Cancel",
    "clarify.prompts_empty": "No open follow-ups right now.",
    "clarify.thread_empty": "Select a question to reply.",
    "clarify.loading": "Loading…",
    "clarify.title": "Question inbox",
    "clarify.lead": "Answer system follow-ups here; asides go to pending for the next distill. No approve step.",
    "clarify.asking": "Awaiting reply",
    "clarify.aside_title": "Aside",
    "clarify.aside_lead": "Not a pool event; written to clarify/pending.",
    "clarify.aside_placeholder": "Something to add…",
    "clarify.aside_submit": "Submit aside",
    "clarify.aside_empty": "Enter aside text first",
    "clarify.aside_ok": "Aside saved · {id}",
    "clarify.pending_title": "Pending distill (answered / asides)",
    "clarify.no_asking": "(no open questions)",
    "clarify.answer_placeholder": "Your reply…",
    "clarify.submit": "Submit reply",
    "clarify.dismiss": "Dismiss",
    "clarify.answer_empty": "Enter a reply first",
    "clarify.submit_ok": "Submitted · {id}",
    "clarify.dismiss_ok": "Dismissed · {id}",
    "memory.title": "Memory",
    "memory.lead": "Browse memory chain, nodes, and future-sight.",
    "memory.chain": "Chain",
    "memory.chain_day": "Day",
    "memory.chain_week": "Week",
    "memory.chain_month": "Month",
    "memory.chain_year": "Year",
    "memory.nodes": "Nodes",
    "memory.future": "Future",
    "memory.future_lead": "Upcoming and long-term anchors (opening this view sweeps expired items into pending, like Engram GET).",
    "memory.future_meta": "Window {window}d · upcoming {upcoming}d",
    "memory.future_zone_upcoming": "Upcoming",
    "memory.future_zone_long": "Long term",
    "memory.chain_empty": "No entries at this chain level.",
    "memory.future_empty": "(no future-sight anchors yet)",
    "memory.pick_future": "Pick an anchor",
    "memory.future_no_body": "(no body)",
    "memory.future_swept": "Cleared {count} expired anchor(s) this load (appended to pending)",
    "memory.pick_chain": "Pick one",
    "memory.pick_node": "Pick one",
    "memory.missing": "(missing)",
    "memory.graph_lead": "Node wikilink graph (edge only if both ends exist; no Pi).",
    "memory.graph_empty": "(no nodes yet)",
    "memory.graph_meta": "{nodes} nodes · {edges} edges",
    "memory.graph_aria": "Node graph",
    "memory.nodes_filter": "Filter nodes…",
    "memory.nodes_search_mode": "Search mode",
    "memory.nodes_search_title": "Title",
    "memory.nodes_search_title_summary": "Title + summary",
    "memory.nodes_empty": "(no nodes yet)",
    "memory.filter_empty": "(no matching nodes)",
  };

  const catalogs = { "zh-Hant": zh, en };

  /** @type {Array<() => void>} */
  const listeners = [];

  function normalize(locale) {
    return locale === "en" ? "en" : "zh-Hant";
  }

  function getLocale() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY) || "zh-Hant");
    } catch {
      return "zh-Hant";
    }
  }

  function setLocale(locale) {
    const next = normalize(locale);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next;
    listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  }

  function onLocaleChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  function t(key, vars) {
    const loc = getLocale();
    const table = catalogs[loc] || zh;
    let s = table[key] ?? zh[key] ?? key;
    if (vars && typeof vars === "object") {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(v));
      }
    }
    return s;
  }

  // Initialize from storage once.
  document.documentElement.lang = getLocale();

  global.EngramI18n = {
    STORAGE_KEY,
    t,
    getLocale,
    setLocale,
    onLocaleChange,
    catalogs,
  };
  global.t = t;
})(typeof window !== "undefined" ? window : globalThis);
