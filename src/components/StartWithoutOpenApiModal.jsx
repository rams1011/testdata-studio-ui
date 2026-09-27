import { useEffect, useRef, useState } from "react";
import { Api } from "../api";
import { buildManualOperationPayload, pathParamNamesFromPath, validateManualPath } from "../manualApi";
import { useToast } from "./Toast";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const DEFAULT_CATALOG = "My APIs";

export default function StartWithoutOpenApiModal({ open, apiDown, onClose, onCreated, onCreateEmptyCatalog }) {
  const { toast } = useToast();
  const catalogRef = useRef(null);
  const [catalogName, setCatalogName] = useState(DEFAULT_CATALOG);
  const [baseUrl, setBaseUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [summary, setSummary] = useState("");
  const [queryNames, setQueryNames] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setCatalogName(DEFAULT_CATALOG);
    setBaseUrl("");
    setMethod("GET");
    setPath("/");
    setSummary("");
    setQueryNames("");
    setLoading(false);
    setError("");
    catalogRef.current?.focus();
    catalogRef.current?.select();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, loading]);

  if (!open) {
    return null;
  }

  function chooseMethod(next) {
    setMethod(next);
  }

  async function submit() {
    const name = catalogName.trim();
    if (!name) {
      setError("Enter a catalog name");
      return;
    }
    const pathError = validateManualPath(path);
    if (pathError) {
      setError(pathError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const spec = await Api.loadSpec({
        name,
        baseUrl: baseUrl.trim() || null,
        manual: true
      });
      const operationPayload = buildManualOperationPayload({ method, path, summary, queryNames });
      const created = await Api.addOperation(spec.specId, operationPayload);
      onCreated?.(spec, created);
      onClose();
    } catch (err) {
      toast(err.message, true);
      setError(err.message);
      setLoading(false);
    }
  }

  const pathParams = pathParamNamesFromPath(path);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="start-rest-title">
        <div className="card-head">
          <h3 id="start-rest-title">Start without OpenAPI</h3>
          <button type="button" className="btn" disabled={loading} onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Create a REST catalog and your first API in one step, then edit the test case.
        </p>
        <div className="field">
          <label htmlFor="start-rest-catalog">Catalog name <span className="req">*</span></label>
          <input
            id="start-rest-catalog"
            ref={catalogRef}
            value={catalogName}
            disabled={loading}
            onChange={(event) => setCatalogName(event.target.value)}
            placeholder={DEFAULT_CATALOG}
          />
        </div>
        <div className="field">
          <label htmlFor="start-rest-base">API base URL</label>
          <input
            id="start-rest-base"
            value={baseUrl}
            disabled={loading}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="Optional, e.g. http://localhost:8080"
          />
        </div>
        <div className="quick-add-api-row">
          <div className="field quick-add-api-method">
            <label htmlFor="start-rest-method">Method</label>
            <select
              id="start-rest-method"
              value={method}
              disabled={loading}
              onChange={(event) => chooseMethod(event.target.value)}
            >
              {METHODS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field quick-add-api-path">
            <label htmlFor="start-rest-path">Path <span className="req">*</span></label>
            <input
              id="start-rest-path"
              value={path}
              disabled={loading}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/users/{id}"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
        </div>
        {pathParams.length ? (
          <p className="hint" style={{ marginTop: 0 }}>
            Path params: {pathParams.map((name) => `{${name}}`).join(", ")}
          </p>
        ) : (
          <p className="hint" style={{ marginTop: 0 }}>Use {"{id}"} in the path for path parameters.</p>
        )}
        <div className="field">
          <label htmlFor="start-rest-summary">API label</label>
          <input
            id="start-rest-summary"
            value={summary}
            disabled={loading}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Optional, e.g. Get user"
          />
        </div>
        <div className="field">
          <label htmlFor="start-rest-query">Query parameters</label>
          <input
            id="start-rest-query"
            value={queryNames}
            disabled={loading}
            onChange={(event) => setQueryNames(event.target.value)}
            placeholder="Optional, e.g. page, size"
          />
          <div className="hint">Comma- or space-separated names.</div>
        </div>
        {error ? <div className="status-banner down" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="actions" style={{ marginTop: 16, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          {onCreateEmptyCatalog ? (
            <button
              type="button"
              className="linkish"
              disabled={loading}
              onClick={() => {
                onClose();
                onCreateEmptyCatalog();
              }}
            >
              Create empty catalog instead
            </button>
          ) : <span />}
          <button type="button" className="btn primary" onClick={submit} disabled={loading || apiDown}>
            {loading ? "Creating…" : "Create & edit case"}
          </button>
        </div>
      </div>
    </div>
  );
}
