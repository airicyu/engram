import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessNodeWikilinks } from "../lib/preprocessNodeWikilinks";

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
}: {
  text: string;
  empty?: boolean;
  className?: string;
  knownNodeIds?: ReadonlySet<string> | readonly string[];
}) {
  const raw = text ?? "";
  const isEmpty = Boolean(empty) || !raw.trim();
  const body = isEmpty ? raw : preprocessNodeWikilinks(raw, knownNodeIds);
  return (
    <div className={`md-block ${isEmpty ? "is-empty" : ""} ${className}`.trim()}>
      {isEmpty ? (
        <p className="md-block-empty">{body.trim() || "—"}</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      )}
    </div>
  );
}
