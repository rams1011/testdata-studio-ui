import { useEffect, useState } from "react";
import SchemaForm from "./SchemaForm";

export default function SchemaBodyEditor({
  schema,
  value,
  onChange,
  resetKey,
  caseId,
  onEnsureCase,
  searchAria = "Search fields",
  jsonAria = "JSON",
  tabsAria = "Editor",
  onFillSample,
  extraActions,
  emptyToNull = false
}) {
  const [mode, setMode] = useState("form");
  const [filter, setFilter] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  useEffect(() => {
    setMode("form");
    setFilter("");
    setJsonText(pretty(value, emptyToNull));
    setJsonError("");
  }, [resetKey, emptyToNull]);

  useEffect(() => {
    if (emptyToNull && value == null) {
      setJsonError("");
    }
    if (mode !== "json" || (jsonError && !(emptyToNull && value == null))) {
      return;
    }
    const next = pretty(value, emptyToNull);
    setJsonText((current) => (current === next ? current : next));
  }, [value, mode, jsonError, emptyToNull]);

  function showForm() {
    setMode("form");
  }

  function showJson() {
    setJsonText(pretty(value, emptyToNull));
    setJsonError("");
    setMode("json");
  }

  function editJson(text) {
    setJsonText(text);
    const trimmed = text.trim();
    if (!trimmed) {
      setJsonError("");
      onChange(emptyToNull ? null : {});
      return;
    }
    try {
      onChange(JSON.parse(trimmed));
      setJsonError("");
    } catch {
      setJsonError("Invalid JSON. The form still has the last valid body.");
    }
  }

  function fillSample() {
    if (onFillSample) {
      onFillSample();
    }
    setJsonError("");
  }

  return (
    <div className="body-editor">
      <div className="body-editor-toolbar">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search fields"
          aria-label={searchAria}
          disabled={mode !== "form"}
        />
        <div className="body-editor-tabs" role="tablist" aria-label={tabsAria}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "form"}
            className={mode === "form" ? "active" : undefined}
            onClick={showForm}
          >
            Form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "json"}
            className={mode === "json" ? "active" : undefined}
            onClick={showJson}
          >
            JSON
          </button>
        </div>
        {onFillSample ? (
          <button type="button" className="btn" onClick={fillSample}>
            Fill sample nested data
          </button>
        ) : null}
        {extraActions}
      </div>
      {mode === "form" ? (
        <SchemaForm schema={schema} value={value} onChange={onChange} filter={filter} caseId={caseId} onEnsureCase={onEnsureCase} />
      ) : (
        <>
          {jsonError ? <div className="body-json-error">{jsonError}</div> : null}
          <textarea
            className="body-json"
            value={jsonText}
            onChange={(event) => editJson(event.target.value)}
            spellCheck={false}
            placeholder={emptyToNull ? "Leave blank if none" : undefined}
            aria-invalid={Boolean(jsonError)}
            aria-label={jsonAria}
          />
        </>
      )}
    </div>
  );
}

function pretty(value, emptyToNull) {
  if (emptyToNull && value == null) {
    return "";
  }
  return JSON.stringify(value ?? {}, null, 2);
}
