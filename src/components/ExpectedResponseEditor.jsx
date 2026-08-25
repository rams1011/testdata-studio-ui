import { useMemo, useState } from "react";
import SchemaForm from "./SchemaForm";
import { hasResponseSchema, sampleFromSchema } from "../schema";

export default function ExpectedResponseEditor({ schema, sample, value, onChange, onBuilt }) {
  const [showForm, setShowForm] = useState(isJsonValue(value));
  const parsed = useMemo(() => parseExpected(value), [value]);
  const canBuild = hasResponseSchema(schema);

  function buildFromSchema() {
    const fromSchema = sampleFromSchema(schema);
    const built = fillStringSamples(sample != null ? structuredClone(sample) : fromSchema, fromSchema);
    onChange(stringify(built));
    setShowForm(true);
    if (onBuilt) {
      onBuilt(built);
    }
  }

  function applyForm(next) {
    onChange(stringify(next));
  }

  function clear() {
    onChange("NA");
    setShowForm(false);
  }

  return (
    <div className="field expected-response">
      <label>
        Expected response
        <span className="hint">{canBuild ? "Build a JSON body from the response schema, then edit values" : "No response schema"}</span>
      </label>
      <div className="jsonpath-toolbar">
        <button type="button" className="btn primary" onClick={buildFromSchema} disabled={!canBuild}>
          Build from schema
        </button>
        {canBuild ? (
          <button type="button" className="btn" onClick={() => {
            if (!showForm && !isJsonValue(value)) {
              buildFromSchema();
              return;
            }
            setShowForm((open) => !open);
          }}>
            {showForm ? "Hide schema form" : "Edit with schema form"}
          </button>
        ) : null}
        <button type="button" className="btn" onClick={clear}>Clear</button>
      </div>
      {!canBuild ? (
        <div className="empty">No response</div>
      ) : null}
      {showForm && canBuild ? (
        <div className="card" style={{ boxShadow: "none", marginBottom: 10, padding: 12 }}>
          <SchemaForm
            schema={schema || { type: "object" }}
            value={parsed == null ? sampleFromSchema(schema) : parsed}
            onChange={applyForm}
          />
        </div>
      ) : null}
      {canBuild || isJsonValue(value) ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="NA or JSON response body"
          style={{ minHeight: 140 }}
        />
      ) : null}
    </div>
  );
}

function isJsonValue(value) {
  return parseExpected(value) != null;
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
    return "NA";
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
  Object.entries(fallback).forEach(([key, value]) => {
    result[key] = fillStringSamples(source[key], value);
  });
  return result;
}

function isEmptyObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}
