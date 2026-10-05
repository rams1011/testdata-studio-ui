import { useState } from "react";
import { buildManualOperationPayload, pathParamNamesFromPath, validateManualPath } from "../manualApi";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export default function SidebarQuickAdd({ disabled = false, onAdd }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("");
  const [queryNames, setQueryNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const pathError = validateManualPath(path);
    if (pathError) {
      setError(pathError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd(buildManualOperationPayload({ method, path, queryNames }));
      setPath("");
      setQueryNames("");
    } catch (err) {
      setError(err.message || "Could not add API");
    } finally {
      setBusy(false);
    }
  }

  const pathParams = pathParamNamesFromPath(path);

  return (
    <div className="sidebar-quick-add">
      <div className="quick-add-api-row">
        <select
          className="quick-add-api-method-select"
          value={method}
          disabled={disabled || busy}
          aria-label="HTTP method"
          onChange={(event) => setMethod(event.target.value)}
        >
          {METHODS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input
          type="text"
          className="quick-add-api-path-input"
          value={path}
          disabled={disabled || busy}
          placeholder="/users/{id}"
          aria-label="API path"
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="btn primary quick-add-api-submit"
          disabled={disabled || busy}
          title="Add API and edit case"
          aria-label="Add API and edit case"
          onClick={submit}
        >
          {busy ? "…" : "+"}
        </button>
      </div>
      <input
        type="text"
        className="sidebar-quick-add-query"
        value={queryNames}
        disabled={disabled || busy}
        placeholder="Query params (optional): page, size"
        aria-label="Query parameter names"
        onChange={(event) => setQueryNames(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
      />
      {error ? <div className="sidebar-quick-add-error">{error}</div> : null}
      {pathParams.length && !error ? (
        <div className="hint sidebar-quick-add-hint">Path params: {pathParams.join(", ")}</div>
      ) : null}
    </div>
  );
}
