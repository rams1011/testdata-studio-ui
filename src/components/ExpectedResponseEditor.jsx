import SchemaBodyEditor from "./SchemaBodyEditor";
import { hasResponseSchema, sampleFromSchema } from "../schema";

export default function ExpectedResponseEditor({ schema, sample, value, onChange, onBuilt, resetKey }) {
  const canBuild = hasResponseSchema(schema);
  const parsed = parseExpected(value);

  function persist(next) {
    if (next == null) {
      onChange("");
      return;
    }
    onChange(stringify(next));
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
        <textarea
          className="body-json"
          value={blankNa(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Leave blank if none"
          spellCheck={false}
          aria-label="Expected response JSON"
        />
      </div>
    );
  }

  return (
    <div className="expected-response">
      <p className="hint" style={{ margin: "0 0 12px" }}>
        Optional JSON body to compare. Leave blank if you only check status.
      </p>
      <SchemaBodyEditor
        schema={schema || { type: "object" }}
        value={parsed}
        onChange={persist}
        resetKey={resetKey}
        searchAria="Search expected response fields"
        jsonAria="Expected response JSON"
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

function blankNa(value) {
  if (value == null) return "";
  const text = String(value).trim();
  return text.toUpperCase() === "NA" ? "" : value;
}

function parseExpected(value) {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  if (!text || text.toUpperCase() === "NA") {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stringify(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
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
