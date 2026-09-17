import { useEffect, useMemo, useState } from "react";
import SchemaForm from "./SchemaForm";
import { jsonToXml, looksLikeXml, validateXml, xmlToJson } from "../xml";

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
  emptyToNull = false,
  format = "json",
  allowExtracts = false
}) {
  const xml = format === "xml";
  const [mode, setMode] = useState(xml ? "xml" : "form");
  const [filter, setFilter] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [xmlText, setXmlText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [xmlError, setXmlError] = useState("");

  const objectValue = useMemo(
    () => asObject(value, schema, xml, emptyToNull),
    [value, schema, xml, emptyToNull]
  );

  useEffect(() => {
    setMode(xml ? "xml" : "form");
    setFilter("");
    setJsonText(pretty(objectValue, emptyToNull));
    setXmlText(xml ? jsonToXml(value ?? objectValue, schema) : "");
    setJsonError("");
    setXmlError("");
  }, [resetKey, emptyToNull, xml]);

  useEffect(() => {
    if (xml) {
      if (mode !== "xml" || xmlError || looksLikeXml(value)) {
        return;
      }
      const next = jsonToXml(objectValue, schema);
      setXmlText((current) => (current === next ? current : next));
      return;
    }
    if (emptyToNull && value == null) {
      setJsonError("");
    }
    if (mode !== "json" || (jsonError && !(emptyToNull && value == null))) {
      return;
    }
    const next = pretty(objectValue, emptyToNull);
    setJsonText((current) => (current === next ? current : next));
  }, [value, objectValue, schema, mode, jsonError, xmlError, emptyToNull, xml]);

  function showForm() {
    setMode("form");
  }

  function showJson() {
    setJsonText(pretty(objectValue, emptyToNull));
    setJsonError("");
    setMode("json");
  }

  function showXml() {
    setXmlText(jsonToXml(value ?? objectValue, schema));
    setXmlError("");
    setMode("xml");
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

  function editXml(text) {
    setXmlText(text);
    const trimmed = text.trim();
    if (!trimmed) {
      setXmlError("");
      onChange(emptyToNull ? null : {});
      return;
    }
    const error = validateXml(trimmed);
    if (error) {
      setXmlError("Invalid XML. The form still has the last valid body.");
      return;
    }
    setXmlError("");
    onChange(trimmed);
  }

  function fillSample() {
    if (onFillSample) {
      onFillSample();
    }
    setJsonError("");
    setXmlError("");
  }

  function changeForm(next) {
    onChange(next);
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
          {xml ? (
            <button
              type="button"
              role="tab"
              aria-selected={mode === "xml"}
              className={mode === "xml" ? "active" : undefined}
              onClick={showXml}
            >
              XML
            </button>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={mode === "json"}
              className={mode === "json" ? "active" : undefined}
              onClick={showJson}
            >
              JSON
            </button>
          )}
        </div>
        {onFillSample ? (
          <button type="button" className="btn" onClick={fillSample}>
            Fill sample nested data
          </button>
        ) : null}
        {extraActions}
      </div>
      {mode === "form" ? (
        <SchemaForm schema={schema} value={objectValue} onChange={changeForm} filter={filter} caseId={caseId} onEnsureCase={onEnsureCase} allowExtracts={allowExtracts} />
      ) : xml ? (
        <>
          {xmlError ? <div className="body-json-error">{xmlError}</div> : null}
          <textarea
            className="body-json"
            value={xmlText}
            onChange={(event) => editXml(event.target.value)}
            spellCheck={false}
            placeholder={emptyToNull ? "Leave blank if none" : undefined}
            aria-invalid={Boolean(xmlError)}
            aria-label={jsonAria}
          />
        </>
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

function asObject(value, schema, xml, emptyToNull) {
  if (emptyToNull && value == null) {
    return null;
  }
  if (value == null) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  if (xml && looksLikeXml(value)) {
    return xmlToJson(value, schema) ?? {};
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

function pretty(value, emptyToNull) {
  if (emptyToNull && value == null) {
    return "";
  }
  return JSON.stringify(value ?? {}, null, 2);
}
