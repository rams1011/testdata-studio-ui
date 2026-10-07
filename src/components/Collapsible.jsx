export default function Collapsible({ title, hint, defaultOpen = false, className = "", children }) {
  return (
    <details className={`card fold-card${className ? ` ${className}` : ""}`} defaultOpen={defaultOpen}>
      <summary>
        {title}
        {hint ? <span className="hint">{hint}</span> : null}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
