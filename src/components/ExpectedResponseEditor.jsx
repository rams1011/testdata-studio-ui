import SchemaBodyEditor from "./SchemaBodyEditor";
import { hasResponseSchema, sampleFromSchema } from "../schema";
import { isXmlContentType, jsonToXml, looksLikeXml, xmlToJson } from "../xml";

export default function ExpectedResponseEditor({ schema, sample, value, onChange, onBuilt, resetKey, contentType }) {
  const xml = isXmlContentType(contentType);
  const canBuild = hasResponseSchema(schema);
  const parsed = parseExpected(value, schema, xml);

  function persist(next) {
    if (next == null) {
      onChange("");
      return;
    }
    onChange(stringify(next, schema, xml));
    if (onBuilt) {
      onBuilt(next);
    }
  }

  function fillSample() {
    const fromSchema = sampleFromSchema(schema);
    persist(fillStringSamples(sample != null ? structuredClone(sample) : fromSchema, fromSchema));
  }

  if (!canBuild) {
    return (
      <div className="field expected-response">
        <div className="empty">This operation has no response body schema.</div>
      </div>
    );
  }

  return (
    <div className="expected-response">
      <p className="hint" style={{ margin: "0 0 12px" }}>
        {xml
          ? "Optional XML body to compare. Leave blank if you only check status."
          : "Optional JSON body to compare. Leave blank if you only check status."}
      </p>
      <SchemaBodyEditor
        schema={schema || { type: "object" }}
        value={parsed}
        onChange={persist}
        resetKey={`${resetKey}:${xml ? "xml" : "json"}`}
        format={xml ? "xml" : "json"}
        searchAria="Search expected response fields"
        jsonAria={xml ? "Expected response XML" : "Expected response JSON"}
        tabsAria="Expected response editor"
        emptyToNull
        onFillSample={fillSample}
        extraActions={(
          <button type="button" className="btn" onClick={() => persist(null)}>
            Clear
          </button>
        )}
      />
    </div>
  );
}

function parseExpected(value, schema, xml) {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  if (!text || text.toUpperCase() === "NA" || text === "{}") {
    return null;
  }
  if (xml || looksLikeXml(text)) {
    return xmlToJson(text, schema) ?? text;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed == null || (typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function stringify(value, schema, xml) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
    return "";
  }
  if (xml) {
    return jsonToXml(value, schema);
  }
  return JSON.stringify(value, null, 2);
}

function fillStringSamples(target, fallback) {
  if (fallback == null) {
    return target;
  }
  if (typeof fallback !== "object" || Array.isArray(fallback)) {
    if (target == null || target === "" || isEmptyObject(target)) {
      return fallback;
    }
    return target;
  }
  const source = target && typeof target === "object" && !Array.isArray(target) ? target : {};
  const result = { ...source };
  Object.entries(fallback).forEach(([key, child]) => {
    result[key] = fillStringSamples(source[key], child);
  });
  return result;
}

function isEmptyObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}
