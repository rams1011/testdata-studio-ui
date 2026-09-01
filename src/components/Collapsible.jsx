export default function Collapsible({ title, hint, defaultOpen = false, children }) {
  return (
    <details className="card fold-card" defaultOpen={defaultOpen}>
      <summary>
        {title}
        {hint ? <span className="hint">{hint}</span> : null}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
