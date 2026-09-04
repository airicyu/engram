import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessAttachmentEmbeds } from "../lib/preprocessAttachmentEmbeds";
import { preprocessNodeWikilinks } from "../lib/preprocessNodeWikilinks";

export function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 12a8 8 0 1 1-2.2-5.5" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}

export function Msg({
  text,
  kind,
}: {
  text: string;
  kind?: "" | "error" | "ok";
}) {
  const className = ["form-msg", kind === "error" ? "is-error" : "", kind === "ok" ? "is-ok" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <p className={className} role="status">
      {text}
    </p>
  );
}

export function MdBlock({
  text,
  empty,
  className = "",
  knownNodeIds,
  preserveNewlines,
}: {
  text: string;
  empty?: boolean;
  className?: string;
  knownNodeIds?: ReadonlySet<string> | readonly string[];
  /** Keep single-newline hard breaks (clarify／STM cards). */
  preserveNewlines?: boolean;
}) {
  const raw = text ?? "";
  const isEmpty = Boolean(empty) || !raw.trim();
  const withBreaks = preserveNewlines && !isEmpty ? raw.replace(/([^\n])\n(?!\n)/g, "$1  \n") : raw;
  const body = isEmpty
    ? raw
    : preprocessAttachmentEmbeds(preprocessNodeWikilinks(withBreaks, knownNodeIds));
  return (
    <div className={`md-block ${isEmpty ? "is-empty" : ""} ${className}`.trim()}>
      {isEmpty ? (
        <p className="md-block-empty">{body.trim() || "—"}</p>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img({ src, alt }) {
              if (!src) return null;
              return (
                <img
                  src={src}
                  alt={alt ?? ""}
                  className="md-block-img"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              );
            },
          }}
        >
          {body}
        </ReactMarkdown>
      )}
    </div>
  );
}
