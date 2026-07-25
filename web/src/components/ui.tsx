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
  return (
    <pre className={`md-block ${empty ? "is-empty" : ""} ${className}`.trim()}>{text}</pre>
  );
}
