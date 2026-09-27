import { useEffect, useMemo, useState } from "react";
import SchemaForm, { SchemaFilePickers } from "./SchemaForm";
import {
  bodyJsonPlaceholder,
  collectFileFields,
  mergeFileRefs,
  schemaHasFormFields,
  stripFileRefsForEditor,
  templateFromSchema
} from "../schema";
import { jsonToXml, looksLikeXml, validateXml, xmlToJson } from "../xml";

export default function SchemaBodyEditor({
  schema,
  value,
  onChange,
  resetKey,
  caseId,
  onEnsureCase,
  onFileCommitted,
  searchAria = "Search fields",
  jsonAria = "JSON",
  tabsAria = "Editor",
  onFillSample,
  extraActions,
  emptyToNull = false,
  format = "json",
  allowExtracts = false,
  fileUploads = false,
  environmentId,
  defaultTab = "json",
  storedJson
}) {
  const xml = format === "xml";
  const preferForm = schemaHasFormFields(schema);
  const [mode, setMode] = useState(() => initialEditorMode(xml, defaultTab, preferForm));
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
    setMode(initialEditorMode(xml, defaultTab, preferForm));
    setFilter("");
    setJsonText(jsonTextFromValue(storedJson, objectValue, emptyToNull));
    setXmlText(xml ? jsonToXml(stripFileRefsForEditor(value ?? objectValue), schema) : "");
    setJsonError("");
    setXmlError("");
  }, [resetKey, emptyToNull, xml, preferForm, defaultTab, storedJson]);

  useEffect(() => {
    if (xml) {
      if (mode !== "xml" || xmlError || looksLikeXml(value)) {
        return;
      }
      const next = jsonToXml(stripFileRefsForEditor(objectValue), schema);
      setXmlText((current) => (current === next ? current : next));
      return;
    }
    if (emptyToNull && value == null) {
      setJsonError("");
    }
    if (mode !== "json" || (jsonError && !(emptyToNull && value == null))) {
      return;
    }
    if (shouldKeepLocalJsonText(emptyToNull, storedJson, objectValue, jsonText)) {
      return;
    }
    const next = jsonTextFromValue(storedJson, objectValue, emptyToNull);
    setJsonText((current) => (current === next ? current : next));
  }, [value, objectValue, schema, mode, jsonError, xmlError, emptyToNull, xml, storedJson, jsonText]);

  function showForm() {
    setMode("form");
  }

  function showJson() {
    setJsonText(jsonTextFromValue(storedJson, objectValue, emptyToNull));
    setJsonError("");
    setMode("json");
  }

  function showXml() {
    setXmlText(jsonToXml(stripFileRefsForEditor(value ?? objectValue), schema));
    setXmlError("");
    setMode("xml");
  }

  function editJson(text) {
    setJsonText(text);
    const trimmed = text.trim();
    if (!trimmed) {
      setJsonError("");
      onChange(mergeFileRefs(emptyJsonValue(schema, emptyToNull), objectValue));
      return;
    }
    try {
      onChange(mergeFileRefs(JSON.parse(trimmed), objectValue));
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

  const fileFields = fileUploads ? collectFileFields(schema) : [];

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
            Fill sample values
          </button>
        ) : null}
        {extraActions}
      </div>
      {mode === "form" ? (
        <SchemaForm schema={schema} value={objectValue} onChange={changeForm} filter={filter} caseId={caseId} onEnsureCase={onEnsureCase} onFileCommitted={onFileCommitted} allowExtracts={allowExtracts} environmentId={environmentId} />
      ) : xml ? (
        <>
          {xmlError ? <div className="body-json-error">{xmlError}</div> : null}
          <textarea
            className="body-json"
            value={xmlText}
            onChange={(event) => editXml(event.target.value)}
            spellCheck={false}
            placeholder={emptyToNull ? "Optional. Leave blank if you only check status." : bodyJsonPlaceholder(schema)}
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
            placeholder={emptyToNull ? "Optional. Leave blank if you only check status." : "Paste JSON here."}
            aria-invalid={Boolean(jsonError)}
            aria-label={jsonAria}
          />
        </>
      )}
      {fileUploads && mode !== "form" && fileFields.length ? (
        <SchemaFilePickers
          schema={schema}
          value={objectValue}
          onChange={changeForm}
          caseId={caseId}
          onEnsureCase={onEnsureCase}
          onFileCommitted={onFileCommitted}
          environmentId={environmentId}
        />
      ) : null}
    </div>
  );
}

function asObject(value, schema, xml, emptyToNull) {
  if (emptyToNull && (value == null || isBlankJson(value))) {
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

function initialEditorMode(xml, defaultTab, preferForm) {
  if (xml) {
    return "xml";
  }
  if (defaultTab === "json") {
    return "json";
  }
  if (defaultTab === "form") {
    return "form";
  }
  return preferForm ? "form" : "json";
}

function formatJsonText(value, emptyToNull) {
  if (emptyToNull && isBlankJson(value)) {
    return "";
  }
  return JSON.stringify(value ?? {}, null, 2);
}

function emptyJsonValue(schema, emptyToNull) {
  if (emptyToNull) {
    return null;
  }
  if (schemaHasFormFields(schema)) {
    return templateFromSchema(schema);
  }
  return {};
}

function isBlankJson(value) {
  if (value == null) {
    return true;
  }
  // Empty object means "no optional body"; [] is a valid expected response.
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

function jsonTextFromValue(storedJson, objectValue, emptyToNull) {
  if (emptyToNull && storedJson != null) {
    return storedJson;
  }
  return formatJsonText(stripFileRefsForEditor(objectValue), emptyToNull);
}

function shouldKeepLocalJsonText(emptyToNull, storedJson, objectValue, jsonText) {
  if (!emptyToNull || !jsonText.trim()) {
    return false;
  }
  if (storedJson != null && storedJson.trim()) {
    return false;
  }
  if (objectValue != null && !isBlankJson(objectValue)) {
    return false;
  }
  try {
    return !isBlankJson(JSON.parse(jsonText));
  } catch {
    return true;
  }
}
