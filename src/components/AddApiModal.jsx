import { useEffect, useRef, useState } from "react";
import {
  buildManualOperationPayload,
  pathParamNamesFromPath,
  validateManualPath
} from "../manualApi";

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
    const pathError = validateManualPath(path);
    if (pathError) {
      setError(pathError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(buildManualOperationPayload({
        method,
        path,
        summary,
        tag,
        queryNames,
        headerNames,
        hasRequestBody,
        requestExample
      }));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const pathParams = pathParamNamesFromPath(path);

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
          Method and path are enough to start a test case. Expand optional schema hints if you need them.
        </p>
        <div className="quick-add-api-row">
          <div className="field quick-add-api-method">
            <label htmlFor="add-api-method">Method</label>
            <select id="add-api-method" value={method} onChange={(event) => chooseMethod(event.target.value)}>
              {METHODS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field quick-add-api-path">
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
          </div>
        </div>
        {pathParams.length ? (
          <p className="hint" style={{ marginTop: 0 }}>
            Path params: {pathParams.join(", ")}
          </p>
        ) : (
          <p className="hint" style={{ marginTop: 0 }}>Use {"{id}"} for path parameters.</p>
        )}
        <div className="field">
          <label htmlFor="add-api-summary">API label</label>
          <input
            id="add-api-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Optional, e.g. Get user"
          />
        </div>
        <details className="add-api-advanced">
          <summary>Optional schema hints</summary>
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
        </details>
        {error ? <div className="status-banner down" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" className="btn primary" onClick={submit} disabled={saving}>
            {saving ? "Adding…" : "Add & edit case"}
          </button>
        </div>
      </div>
    </div>
  );
}
