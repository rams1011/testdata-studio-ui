import { useEffect, useMemo, useRef, useState } from "react";
import { parseCurl } from "../parseCurl";
import { matchCurlToOperation } from "../curlImport";

export default function ImportCurlModal({ operations, allowCreate = false, onClose, onImport }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const preview = useMemo(() => {
    if (!text.trim()) {
      return null;
    }
    try {
      const parsed = parseCurl(text);
      const match = matchCurlToOperation(parsed, operations);
      return { parsed, match, error: "" };
    } catch (err) {
      return { parsed: null, match: null, error: err.message };
    }
  }, [text, operations]);

  function submit() {
    if (!preview?.parsed) {
      setError(preview?.error || "Paste a curl command");
      return;
    }
    if (!preview.match && !allowCreate) {
      setError(`No operation in this spec matches ${preview.parsed.method} ${preview.parsed.pathname}`);
      return;
    }
    onImport(preview.parsed, preview.match);
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="card modal curl-modal" role="dialog" aria-modal="true" aria-labelledby="import-curl-title">
        <div className="card-head">
          <h3 id="import-curl-title">Import from curl</h3>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Paste a curl command. It will open a new case on the matching operation with URL, headers, and body filled in.
          {allowCreate
            ? " If the API is not in this catalog yet, Studio adds it first."
            : " It is not saved until you click Save."}
        </p>
        <div className="field">
          <label htmlFor="curl-import-text">curl</label>
          <textarea
            id="curl-import-text"
            ref={inputRef}
            className="curl-import-text"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError("");
            }}
            spellCheck={false}
            placeholder={'curl -X POST "http://localhost:8080/employee-service/api/roles" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"Admin","code":"ADMIN"}\''}
          />
        </div>
        {preview?.parsed ? (
          <div className="curl-import-preview">
            <div><span className={`method ${preview.parsed.method}`}>{preview.parsed.method}</span> {preview.parsed.pathname}</div>
            {preview.match ? (
              <div className="hint">
                Matches {preview.match.operation.method} {preview.match.operation.path}
                {preview.match.operation.summary ? ` · ${preview.match.operation.summary}` : ""}
              </div>
            ) : allowCreate ? (
              <div className="hint">No matching API yet — this will add {preview.parsed.method} {preview.parsed.pathname} to the catalog.</div>
            ) : (
              <div className="hint">No matching operation in this spec.</div>
            )}
            {(preview.parsed.warnings || []).map((item) => (
              <div className="hint" key={item}>{item}</div>
            ))}
          </div>
        ) : null}
        {error || preview?.error ? (
          <div className="status-banner down" style={{ marginTop: 12 }}>{error || preview.error}</div>
        ) : null}
        <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" className="btn primary" onClick={submit}>Open as case</button>
        </div>
      </div>
    </div>
  );
}
