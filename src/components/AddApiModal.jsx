import { useEffect, useRef, useState } from "react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default function AddApiModal({ onClose, onSave }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [summary, setSummary] = useState("");
  const [tag, setTag] = useState("General");
  const [queryNames, setQueryNames] = useState("");
  const [headerNames, setHeaderNames] = useState("");
  const [hasRequestBody, setHasRequestBody] = useState(false);
  const [requestExample, setRequestExample] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pathRef = useRef(null);

  useEffect(() => {
    pathRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  function chooseMethod(next) {
    setMethod(next);
    if (["POST", "PUT", "PATCH"].includes(next)) {
      setHasRequestBody(true);
    }
  }

  async function submit() {
    if (!path.trim() || path.trim() === "/") {
      setError("Enter a path, e.g. /users/{id}");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        method,
        path: path.trim(),
        summary: summary.trim() || undefined,
        tag: tag.trim() || undefined,
        hasRequestBody,
        requestExample: hasRequestBody ? (requestExample.trim() || undefined) : undefined,
        queryNames: splitNames(queryNames),
        headerNames: splitNames(headerNames)
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="add-api-title">
        <div className="card-head">
          <h3 id="add-api-title">Add REST API</h3>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Add a method and path, then save test cases for it.
        </p>
        <div className="field">
          <label htmlFor="add-api-method">Method</label>
          <select id="add-api-method" value={method} onChange={(event) => chooseMethod(event.target.value)}>
            {METHODS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="add-api-path">Path <span className="req">*</span></label>
          <input
            id="add-api-path"
            ref={pathRef}
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/users/{id}"
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          <div className="hint">Use {"{id}"} for path parameters.</div>
        </div>
        <div className="field">
          <label htmlFor="add-api-summary">Name</label>
          <input
            id="add-api-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Optional, e.g. Get user"
          />
        </div>
        <div className="field">
          <label htmlFor="add-api-tag">Tag</label>
          <input
            id="add-api-tag"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="General"
          />
        </div>
        <div className="field">
          <label htmlFor="add-api-query">Query parameters</label>
          <input
            id="add-api-query"
            value={queryNames}
            onChange={(event) => setQueryNames(event.target.value)}
            placeholder="page, size"
          />
        </div>
        <div className="field">
          <label htmlFor="add-api-headers">Headers</label>
          <input
            id="add-api-headers"
            value={headerNames}
            onChange={(event) => setHeaderNames(event.target.value)}
            placeholder="X-Request-Id"
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={hasRequestBody}
            onChange={(event) => setHasRequestBody(event.target.checked)}
          />
          JSON request body
        </label>
        {hasRequestBody ? (
          <div className="field">
            <label htmlFor="add-api-example">Example body</label>
            <textarea
              id="add-api-example"
              value={requestExample}
              onChange={(event) => setRequestExample(event.target.value)}
              placeholder={'{\n  "name": "Ada"\n}'}
              spellCheck={false}
            />
          </div>
        ) : null}
        {error ? <div className="status-banner down" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" className="btn primary" onClick={submit} disabled={saving}>
            {saving ? "Adding…" : "Add API"}
          </button>
        </div>
      </div>
    </div>
  );
}

function splitNames(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
