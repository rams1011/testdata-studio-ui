import SchemaBodyEditor from "./SchemaBodyEditor";
import { hasResponseSchema } from "../schema";
import { isXmlContentType, jsonToXml, looksLikeXml, xmlToJson } from "../xml";

export default function ExpectedResponseEditor({ schema, value, onChange, onBuilt, resetKey, contentType }) {
  const xml = isXmlContentType(contentType);
  const canBuild = hasResponseSchema(schema);
  const storedJson = storedExpectedJson(value, xml);
  const parsed = parseExpected(value, schema, xml);
  const hasContent = hasExpectedResponseContent(value);

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

  function clearExpected() {
    if (!hasContent) {
      return;
    }
    if (!window.confirm("Clear the expected response body? Status-only checks will apply until you add a body again.")) {
      return;
    }
    persist(null);
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
          : "Optional JSON body to compare (including [] for an empty array). Leave blank if you only check status."}
      </p>
      <SchemaBodyEditor
        schema={schema || { type: "object" }}
        value={parsed}
        onChange={persist}
        resetKey={`${resetKey}:${xml ? "xml" : "json"}`}
        format={xml ? "xml" : "json"}
        defaultTab="json"
        searchAria="Search expected response fields"
        jsonAria={xml ? "Expected response XML" : "Expected response JSON"}
        tabsAria="Expected response editor"
        emptyToNull
        storedJson={xml ? undefined : storedJson}
        extraActions={(
          <button type="button" className="btn" onClick={clearExpected} disabled={!hasContent}>
            Clear
          </button>
        )}
      />
    </div>
  );
}

function storedExpectedJson(value, xml) {
  if (value == null) {
    return "";
  }
  const text = String(value).trim();
  if (!text || text.toUpperCase() === "NA" || text === "{}") {
    return "";
  }
  if (xml) {
    return text;
  }
  return text;
}

function hasExpectedResponseContent(value) {
  if (value == null) {
    return false;
  }
  const text = String(value).trim();
  return Boolean(text) && text.toUpperCase() !== "NA" && text !== "{}";
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
