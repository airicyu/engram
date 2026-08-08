import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
}: {
  text: string;
  empty?: boolean;
  className?: string;
}) {
  const body = text ?? "";
  const isEmpty = Boolean(empty) || !body.trim();
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
