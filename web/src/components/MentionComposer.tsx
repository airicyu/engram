/**
 * Activities `@` mention composer (0.32): contenteditable with ref／create pills.
 * Serializes to `[@id](node:id)` / `[@id](node-create:id)` in raw.
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { filterNodeIds, formatMentionToken, sanitizeMentionId, type MentionMode } from "../lib/mentions";

export type MentionComposerHandle = {
  insertText: (text: string, opts?: { blankLines?: boolean }) => void;
  getSerialized: () => string;
  setSerialized: (raw: string) => void;
  clear: () => void;
  focus: () => void;
};

type Props = {
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Live node ids from GET /memories/nodes. */
  nodeIds: string[];
  onChange?: (serialized: string) => void;
  onPasteImage?: (file: File) => void;
  labels: {
    create: string;
    createExists: string;
    emptyCreate: string;
  };
};

type PopoverState = {
  query: string;
  /** Character offset of `@` within the active text node. */
  atOffset: number;
  textNode: Text;
};

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.dataset.mentionId && el.dataset.mentionMode) {
    const id = el.dataset.mentionId;
    const mode = el.dataset.mentionMode as MentionMode;
    return formatMentionToken(id, mode, id);
  }
  if (el.tagName === "BR") return "\n";
  let out = "";
  for (const child of Array.from(el.childNodes)) {
    out += serializeNode(child);
  }
  // Div／p often used as line breaks in contenteditable
  if ((el.tagName === "DIV" || el.tagName === "P") && el.previousSibling) {
    return `\n${out}`;
  }
  return out;
}

function serializeRoot(root: HTMLElement): string {
  let out = "";
  for (const child of Array.from(root.childNodes)) {
    out += serializeNode(child);
  }
  return out.replace(/\u00a0/g, " ");
}

function createPill(id: string, mode: MentionMode): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `mention-pill mention-pill--${mode}`;
  span.dataset.mentionId = id;
  span.dataset.mentionMode = mode;
  span.contentEditable = "false";
  span.textContent = `@${id}`;
  return span;
}

function isPill(node: Node | null): node is HTMLElement {
  return (
    !!node &&
    node.nodeType === Node.ELEMENT_NODE &&
    !!(node as HTMLElement).dataset?.mentionId
  );
}

/** Place caret after a node. */
function caretAfter(node: Node) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Place caret at offset within a node. */
function caretAt(node: Node, offset = 0) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Backspace／Delete over contentEditable=false pills is unreliable in browsers.
 * Remove the adjacent pill when the caret is right next to it.
 */
function tryDeleteAdjacentPill(direction: "backward" | "forward"): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;

  let pill: HTMLElement | null = null;
  let spacerToRemove: Node | null = null;

  if (direction === "backward") {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      // Caret at very start of the text after the pill
      if (offset === 0 && isPill(node.previousSibling)) {
        pill = node.previousSibling;
      } else if (
        offset === 1 &&
        text.length === 1 &&
        /^[\u00a0\u200b ]$/.test(text) &&
        isPill(node.previousSibling)
      ) {
        // Lone spacer after pill — treat as deleting the pill
        pill = node.previousSibling;
        spacerToRemove = node;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
      const child = (node as HTMLElement).childNodes[offset - 1] ?? null;
      if (isPill(child)) pill = child;
    }
  } else {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (offset >= text.length && isPill(node.nextSibling)) {
        pill = node.nextSibling;
      } else if (
        offset === 0 &&
        text.length === 1 &&
        /^[\u00a0\u200b ]$/.test(text) &&
        isPill(node.nextSibling)
      ) {
        pill = node.nextSibling;
        spacerToRemove = node;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = (node as HTMLElement).childNodes[offset] ?? null;
      if (isPill(child)) pill = child;
    }
  }

  if (!pill) return false;

  const parent = pill.parentNode;
  if (!parent) return false;

  if (spacerToRemove?.parentNode) {
    spacerToRemove.parentNode.removeChild(spacerToRemove);
  }

  const anchor = pill.previousSibling;
  pill.remove();

  if (anchor) {
    if (anchor.nodeType === Node.TEXT_NODE) {
      caretAt(anchor, (anchor.textContent ?? "").length);
    } else {
      caretAfter(anchor);
    }
  } else if (parent.childNodes.length > 0) {
    const first = parent.firstChild!;
    if (first.nodeType === Node.TEXT_NODE) caretAt(first, 0);
    else caretAt(parent, 0);
  } else {
    const empty = document.createTextNode("");
    parent.appendChild(empty);
    caretAt(empty, 0);
  }
  return true;
}

export const MentionComposer = forwardRef<MentionComposerHandle, Props>(function MentionComposer(
  { id, disabled, placeholder, nodeIds, onChange, onPasteImage, labels },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hint, setHint] = useState("");
  const [isEmpty, setIsEmpty] = useState(true);

  const emitChange = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const serialized = serializeRoot(root);
    setIsEmpty(!serialized.trim());
    onChange?.(serialized);
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      insertText(text, opts) {
        const root = rootRef.current;
        if (!root) return;
        root.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
          root.appendChild(document.createTextNode(text));
          emitChange();
          return;
        }
        const range = sel.getRangeAt(0);
        let insert = text;
        if (opts?.blankLines) {
          const before = range.startContainer.textContent?.slice(0, range.startOffset) ?? "";
          const after = range.startContainer.textContent?.slice(range.startOffset) ?? "";
          let prefix = "";
          let suffix = "";
          if (before.length > 0 && !before.endsWith("\n\n") && !before.endsWith("\n")) prefix = "\n\n";
          else if (before.length > 0 && !before.endsWith("\n\n")) prefix = "\n";
          if (after.length > 0 && !after.startsWith("\n\n") && !after.startsWith("\n")) suffix = "\n\n";
          else if (after.length > 0 && !after.startsWith("\n\n")) suffix = "\n";
          insert = prefix + text + suffix;
        }
        range.deleteContents();
        const node = document.createTextNode(insert);
        range.insertNode(node);
        caretAfter(node);
        emitChange();
      },
      getSerialized() {
        const root = rootRef.current;
        return root ? serializeRoot(root).trim() : "";
      },
      setSerialized(raw) {
        const root = rootRef.current;
        if (!root) return;
        // Plain text only for programmatic set (clear／restore)
        root.textContent = raw;
        emitChange();
      },
      clear() {
        const root = rootRef.current;
        if (!root) return;
        root.innerHTML = "";
        emitChange();
      },
      focus() {
        rootRef.current?.focus();
      },
    }),
    [emitChange],
  );

  const filtered = popover ? filterNodeIds(nodeIds, popover.query) : [];
  const createId = popover ? sanitizeMentionId(popover.query) : null;
  const createBlocked = !!(createId && nodeIds.includes(createId));
  const showCreate = !!(popover && createId && !createBlocked);
  const items: Array<{ kind: "ref" | "create"; id: string }> = [
    ...filtered.map((nid) => ({ kind: "ref" as const, id: nid })),
    ...(showCreate ? [{ kind: "create" as const, id: createId! }] : []),
  ];

  useEffect(() => {
    setActiveIdx(0);
  }, [popover?.query, items.length]);

  function detectMention() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      setPopover(null);
      return;
    }
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      setPopover(null);
      return;
    }
    const text = node.textContent ?? "";
    const offset = sel.anchorOffset;
    const before = text.slice(0, offset);
    const m = before.match(/@([\p{L}\p{N}._-]*)$/u);
    if (!m) {
      setPopover(null);
      return;
    }
    setPopover({
      query: m[1] ?? "",
      atOffset: offset - m[0].length,
      textNode: node as Text,
    });
    setHint("");
  }

  function insertMention(mode: MentionMode, mentionId: string) {
    if (!popover) return;
    const { textNode, atOffset, query } = popover;
    const text = textNode.textContent ?? "";
    const afterAt = atOffset + 1 + query.length;
    const before = text.slice(0, atOffset);
    const after = text.slice(afterAt);
    const pill = createPill(mentionId, mode);
    const parent = textNode.parentNode;
    if (!parent) return;

    const beforeNode = document.createTextNode(before);
    // Prefer a normal space after the pill so caret sits at offset 0 for easy Backspace→pill
    const afterNode = document.createTextNode(after.length ? after : " ");
    parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(pill, textNode);
    parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);
    caretAt(afterNode, 0);
    setPopover(null);
    setHint("");
    emitChange();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (tryDeleteAdjacentPill("backward")) {
        e.preventDefault();
        setPopover(null);
        emitChange();
        return;
      }
    }
    if (e.key === "Delete" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (tryDeleteAdjacentPill("forward")) {
        e.preventDefault();
        setPopover(null);
        emitChange();
        return;
      }
    }

    if (!popover || items.length === 0) {
      if (e.key === "Escape") setPopover(null);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const item = items[activeIdx];
      if (!item) return;
      if (item.kind === "create" && nodeIds.includes(item.id)) {
        setHint(labels.createExists);
        return;
      }
      insertMention(item.kind, item.id);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setPopover(null);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) onPasteImage?.(file);
        return;
      }
    }
    // Plain text paste — avoid rich HTML
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emitChange();
    detectMention();
  }

  const empty = isEmpty;

  return (
    <div className="mention-composer-wrap">
      <div
        id={id}
        ref={rootRef}
        className={`mention-composer${disabled ? " is-disabled" : ""}`}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        data-empty={empty ? "true" : "false"}
        suppressContentEditableWarning
        onInput={() => {
          emitChange();
          detectMention();
        }}
        onKeyUp={detectMention}
        onClick={detectMention}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      {popover && (
        <div className="mention-popover" role="listbox">
          {items.length === 0 && (
            <div className="mention-popover-empty">
              {createBlocked
                ? labels.createExists
                : popover.query
                  ? labels.emptyCreate
                  : "…"}
            </div>
          )}
          {items.map((item, i) => (
            <button
              key={`${item.kind}:${item.id}`}
              type="button"
              role="option"
              aria-selected={i === activeIdx}
              className={`mention-popover-item${i === activeIdx ? " is-active" : ""}`}
              onMouseDown={(ev) => {
                ev.preventDefault();
                if (item.kind === "create" && nodeIds.includes(item.id)) {
                  setHint(labels.createExists);
                  return;
                }
                insertMention(item.kind, item.id);
              }}
            >
              {item.kind === "create" ? (
                <span>
                  {labels.create}: <code>{item.id}</code>
                </span>
              ) : (
                <code>{item.id}</code>
              )}
            </button>
          ))}
          {hint ? <p className="mention-popover-hint">{hint}</p> : null}
        </div>
      )}
    </div>
  );
});
