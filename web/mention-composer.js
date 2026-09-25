(function () {
  const ZWSP = "\u200b";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function nodeWikilink(id, title) {
    const label = title || id;
    return `[[nodes/${id}/${id}|${label}]]`;
  }

  function createMentionChip(wikilink, label) {
    const chip = document.createElement("span");
    chip.className = "mention-chip";
    chip.contentEditable = "false";
    chip.setAttribute("data-wikilink", wikilink);
    chip.textContent = "@" + (label || "");
    return chip;
  }

  /** @param {HTMLElement} editor */
  function composeEditorToRaw(editor) {
    let out = "";
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent.replace(/\u200b/g, "");
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node;
      if (el.classList.contains("mention-chip")) {
        out += el.getAttribute("data-wikilink") || "";
        return;
      }
      if (el.tagName === "BR") {
        out += "\n";
        return;
      }
      for (const c of el.childNodes) walk(c);
    }
    for (const c of editor.childNodes) walk(c);
    return out;
  }

  /** @param {HTMLElement} editor */
  function setComposeEditorFromRaw(editor, raw) {
    editor.innerHTML = "";
    const s = String(raw ?? "");
    if (!s) return;
    const parts = [];
    let i = 0;
    const tokenRe = /(\[\[nodes\/[^|\]]+\|[^\]]+\]\]|!\[\[[^\]]+\]\])/g;
    let m;
    while ((m = tokenRe.exec(s)) !== null) {
      if (m.index > i) parts.push({ type: "text", value: s.slice(i, m.index) });
      const tok = m[1];
      if (tok.startsWith("![[")) parts.push({ type: "embed", value: tok });
      else parts.push({ type: "mention", value: tok });
      i = m.index + tok.length;
    }
    if (i < s.length) parts.push({ type: "text", value: s.slice(i) });
    if (!parts.length) parts.push({ type: "text", value: s });

    for (const p of parts) {
      if (p.type === "text") {
        appendTextWithNewlines(editor, p.value);
      } else if (p.type === "embed") {
        editor.appendChild(document.createTextNode(p.value));
      } else {
        const mm = /^\[\[nodes\/([^|\]]+)\|([^\]]+)\]\]$/.exec(p.value);
        if (mm) {
          editor.appendChild(createMentionChip(p.value, mm[2]));
          editor.appendChild(document.createTextNode(" " + ZWSP));
        } else {
          editor.appendChild(document.createTextNode(p.value));
        }
      }
    }
  }

  function appendTextWithNewlines(parent, text) {
    const lines = String(text).split("\n");
    lines.forEach((line, idx) => {
      if (line) parent.appendChild(document.createTextNode(line));
      if (idx < lines.length - 1) parent.appendChild(document.createElement("br"));
    });
  }

  function clearComposeEditor(editor) {
    editor.innerHTML = "";
  }

  function insertTextAtCaret(editor, text) {
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (!sel.rangeCount) {
      editor.appendChild(document.createTextNode(text));
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function getTextBeforeCaret(editor) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return "";
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return "";
    const pre = range.cloneRange();
    pre.selectNodeContents(editor);
    pre.setEnd(range.endContainer, range.endOffset);
    const box = document.createElement("div");
    box.appendChild(pre.cloneContents());
    return serializeForMentionScan(box);
  }

  function serializeForMentionScan(container) {
    let out = "";
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent.replace(/\u200b/g, "");
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.classList && node.classList.contains("mention-chip")) {
        out += " ";
        return;
      }
      if (node.tagName === "BR") {
        out += "\n";
        return;
      }
      for (const c of node.childNodes) walk(c);
    }
    for (const c of container.childNodes) walk(c);
    return out;
  }

  /** @returns {{ start: number, end: number, query: string } | null} */
  function getMentionAtCursor(text, cursor) {
    const before = text.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) return null;
    const chunk = before.slice(at + 1);
    if (/[\s\n]/.test(chunk)) return null;
    if (at > 0) {
      const prev = before[at - 1];
      if (!/[\s\n([{，。、；：!?！？]/.test(prev)) return null;
    }
    return { start: at, end: cursor, query: chunk };
  }

  function filterNodes(nodes, query) {
    const q = String(query || "").toLowerCase();
    const list = Array.isArray(nodes) ? nodes : [];
    if (!q) return list.slice(0, 12);
    return list
      .filter((n) => {
        const id = String(n.id || "").toLowerCase();
        const title = String(n.title || "").toLowerCase();
        return id.includes(q) || title.includes(q);
      })
      .slice(0, 12);
  }

  function deleteMentionQueryBeforeCaret(editor, queryLen) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const charsToDelete = queryLen + 1;
    let remaining = charsToDelete;
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;

    const deleteRange = document.createRange();
    deleteRange.setEnd(endContainer, endOffset);

    let curNode = endContainer;
    let curOffset = endOffset;

    while (remaining > 0) {
      if (curNode.nodeType === Node.TEXT_NODE) {
        const t = curNode.textContent.replace(/\u200b/g, "");
        const usable = Math.min(curOffset, t.length);
        if (usable > 0) {
          const take = Math.min(remaining, usable);
          curOffset -= take;
          remaining -= take;
          if (remaining === 0) {
            deleteRange.setStart(curNode, curOffset);
            break;
          }
        }
        const prev = previousEditableNode(curNode, editor);
        if (!prev) return false;
        curNode = prev.node;
        curOffset = prev.offset;
        continue;
      }
      if (curNode.nodeType === Node.ELEMENT_NODE && curNode !== editor) {
        if (curNode.classList && curNode.classList.contains("mention-chip")) return false;
        const prev = previousEditableNode(curNode, editor);
        if (!prev) return false;
        curNode = prev.node;
        curOffset = prev.offset;
        continue;
      }
      return false;
    }

    deleteRange.deleteContents();
    sel.removeAllRanges();
    sel.addRange(deleteRange);
    return true;
  }

  function previousEditableNode(node, editor) {
    if (node === editor) return null;
    if (node.previousSibling) {
      let n = node.previousSibling;
      while (n) {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = n.textContent.replace(/\u200b/g, "");
          return { node: n, offset: t.length };
        }
        if (n.nodeType === Node.ELEMENT_NODE) {
          if (n.classList && n.classList.contains("mention-chip")) {
            return null;
          }
          if (n.tagName === "BR") {
            n = n.previousSibling;
            continue;
          }
          const last = lastTextPosition(n);
          if (last) return last;
        }
        n = n.previousSibling;
      }
    }
    const parent = node.parentNode;
    if (parent && parent !== editor) return previousEditableNode(parent, editor);
    return null;
  }

  function lastTextPosition(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      const t = root.textContent.replace(/\u200b/g, "");
      return { node: root, offset: t.length };
    }
    for (let i = root.childNodes.length - 1; i >= 0; i--) {
      const c = root.childNodes[i];
      if (c.nodeType === Node.ELEMENT_NODE && c.classList?.contains("mention-chip")) continue;
      const hit = lastTextPosition(c);
      if (hit) return hit;
    }
    return null;
  }

  function insertMentionChipAtCaret(editor, node) {
    const wikilink = nodeWikilink(node.id, node.title || node.id);
    const chip = createMentionChip(wikilink, node.title || node.id);
    const tail = document.createTextNode(" " + ZWSP);
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      editor.appendChild(chip);
      editor.appendChild(tail);
      return;
    }
    const range = sel.getRangeAt(0);
    range.collapse(true);
    range.insertNode(tail);
    range.insertNode(chip);
    const after = document.createRange();
    after.setStart(tail, tail.textContent.length);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  }

  function removeAdjacentMentionChip(ev) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const { startContainer, startOffset } = range;

    if (startContainer.nodeType === Node.TEXT_NODE) {
      const t = startContainer.textContent;
      if (startOffset === 0) {
        const prev = startContainer.previousSibling;
        if (prev && prev.classList && prev.classList.contains("mention-chip")) {
          ev.preventDefault();
          prev.remove();
          return true;
        }
      }
      if (startOffset <= 1 && t.replace(/\u200b/g, "").length <= 1) {
        const prev = startContainer.previousSibling;
        if (prev && prev.classList && prev.classList.contains("mention-chip")) {
          ev.preventDefault();
          prev.remove();
          startContainer.remove();
          return true;
        }
      }
    }
    if (startContainer.nodeType === Node.ELEMENT_NODE && startContainer.classList?.contains("compose-editor")) {
      const child = startContainer.childNodes[startOffset - 1];
      if (child && child.classList && child.classList.contains("mention-chip")) {
        ev.preventDefault();
        const next = child.nextSibling;
        child.remove();
        if (next && next.nodeType === Node.TEXT_NODE && !next.textContent.replace(/\u200b/g, "").trim()) {
          next.remove();
        }
        return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLElement} editor contenteditable compose field
   * @param {{ nodes: { id: string, title: string }[], labels?: { empty?: string } }} opts
   */
  function bindMentionComposer(editor, opts) {
    const nodes = opts.nodes || [];
    const emptyLabel = (opts.labels && opts.labels.empty) || "—";
    let menu = null;
    let activeIdx = 0;
    let openCtx = null;

    const host = editor.closest(".compose-card") || editor.parentElement;
    if (host) host.classList.add("mention-host");

    function ensureMenu() {
      if (menu) return menu;
      menu = document.createElement("div");
      menu.className = "mention-menu";
      menu.setAttribute("role", "listbox");
      menu.hidden = true;
      (host || editor.parentElement).appendChild(menu);
      return menu;
    }

    function close() {
      openCtx = null;
      activeIdx = 0;
      if (menu) menu.hidden = true;
    }

    function currentMatches() {
      if (!openCtx) return [];
      return filterNodes(nodes, openCtx.query);
    }

    function renderMenu(matches) {
      const m = ensureMenu();
      if (!matches.length) {
        m.innerHTML = `<div class="mention-menu-empty">${escapeHtml(emptyLabel)}</div>`;
        m.hidden = false;
        return;
      }
      m.innerHTML = matches
        .map(
          (n, i) =>
            `<button type="button" class="mention-menu-item${i === activeIdx ? " is-active" : ""}" role="option" aria-selected="${i === activeIdx}" data-idx="${i}">
              <span class="mention-menu-title">${escapeHtml(n.title || n.id)}</span>
              <span class="mention-menu-id">${escapeHtml(n.id)}</span>
            </button>`,
        )
        .join("");
      m.hidden = false;
      m.querySelectorAll(".mention-menu-item").forEach((btn) => {
        btn.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          const idx = Number(btn.getAttribute("data-idx"));
          pick(currentMatches()[idx]);
        });
      });
    }

    function pick(node) {
      if (!openCtx || !node) {
        close();
        return;
      }
      const q = openCtx.query;
      deleteMentionQueryBeforeCaret(editor, q.length);
      insertMentionChipAtCaret(editor, node);
      close();
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function refresh() {
      const text = getTextBeforeCaret(editor);
      const cursor = text.length;
      const ctx = getMentionAtCursor(text, cursor);
      if (!ctx) {
        close();
        return;
      }
      openCtx = ctx;
      const matches = filterNodes(nodes, ctx.query);
      if (activeIdx >= matches.length) activeIdx = 0;
      renderMenu(matches);
    }

    function menuOpenWithMatches() {
      return Boolean(openCtx && menu && !menu.hidden && currentMatches().length > 0);
    }

    editor.addEventListener("input", refresh);
    editor.addEventListener("click", refresh);
    editor.addEventListener("keyup", refresh);

    editor.addEventListener("keydown", (ev) => {
      if (ev.key === "Backspace" && removeAdjacentMentionChip(ev)) {
        close();
        return;
      }
      if (ev.key === "Delete") {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const { startContainer, startOffset } = range;
          if (startContainer.nodeType === Node.TEXT_NODE && startOffset >= startContainer.textContent.length) {
            const next = startContainer.nextSibling;
            if (next && next.classList && next.classList.contains("mention-chip")) {
              ev.preventDefault();
              const after = next.nextSibling;
              next.remove();
              if (after && after.nodeType === Node.TEXT_NODE && !after.textContent.replace(/\u200b/g, "").trim()) {
                after.remove();
              }
              close();
              return;
            }
          }
        }
      }
      if (ev.key === "Escape") {
        if (openCtx && menu && !menu.hidden) {
          ev.preventDefault();
          close();
        }
        return;
      }
      if (!menuOpenWithMatches()) return;
      const matches = currentMatches();
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        activeIdx = (activeIdx + 1) % matches.length;
        renderMenu(matches);
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        activeIdx = (activeIdx - 1 + matches.length) % matches.length;
        renderMenu(matches);
        return;
      }
      if (ev.key === "Enter" || ev.key === "Tab") {
        ev.preventDefault();
        pick(matches[activeIdx]);
      }
    });

    editor.addEventListener("blur", () => {
      window.setTimeout(close, 160);
    });
  }

  window.bindMentionComposer = bindMentionComposer;
  window.composeEditorToRaw = composeEditorToRaw;
  window.setComposeEditorFromRaw = setComposeEditorFromRaw;
  window.clearComposeEditor = clearComposeEditor;
  window.insertTextAtCaret = insertTextAtCaret;
})();
