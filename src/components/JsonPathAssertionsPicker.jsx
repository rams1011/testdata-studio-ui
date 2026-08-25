import { useMemo, useState } from "react";
import {
  hasResponseSchema,
  jsonPathsFromSchema,
  parseJsonPathAssertions,
  serializeJsonPathAssertions
} from "../schema";

export default function JsonPathAssertionsPicker({ schema, value, onChange }) {
  const schemaAvailable = hasResponseSchema(schema);
  const schemaPaths = useMemo(() => jsonPathsFromSchema(schemaAvailable ? schema : null), [schema, schemaAvailable]);
  const saved = useMemo(() => parseJsonPathAssertions(value), [value]);
  const [customPath, setCustomPath] = useState("$.");
  const [filter, setFilter] = useState("");

  const customPaths = useMemo(() => {
    const known = new Set(schemaPaths.map((item) => item.path));
    return [...saved.keys()].filter((path) => !known.has(path));
  }, [schemaPaths, saved]);

  const rows = useMemo(() => {
    const schemaRows = schemaPaths.map((item) => ({
      ...item,
      custom: false,
      selected: saved.has(item.path),
      value: saved.has(item.path) && saved.get(item.path) !== "" ? saved.get(item.path) : item.sample
    }));
    const extraRows = customPaths.map((path) => ({
      path,
      type: "custom",
      required: false,
      description: "",
      sample: "",
      custom: true,
      selected: true,
      value: saved.get(path) || ""
    }));
    return [...schemaRows, ...extraRows];
  }, [schemaPaths, customPaths, saved]);

  const visible = rows.filter((row) => {
    if (!filter.trim()) {
      return true;
    }
    const haystack = `${row.path} ${row.type} ${row.description}`.toLowerCase();
    return haystack.includes(filter.trim().toLowerCase());
  });

  function emit(nextRows) {
    onChange(serializeJsonPathAssertions(nextRows));
  }

  function updateRow(path, patch) {
    emit(rows.map((row) => (row.path === path ? { ...row, ...patch } : row)));
  }

  function setAll(selected) {
    emit(rows.map((row) => ({ ...row, selected })));
  }

  function addCustom() {
    const path = customPath.trim();
    if (!path || path === "$" || path === "$.") {
      return;
    }
    if (rows.some((row) => row.path === path)) {
      updateRow(path, { selected: true });
      return;
    }
    emit([...rows, { path, selected: true, value: "", custom: true }]);
    setCustomPath("$.");
  }

  function removeCustom(path) {
    emit(rows.filter((row) => row.path !== path));
  }

  if (!schemaAvailable) {
    return (
      <div className="field">
        <label>JSONPath assertions</label>
        <div className="empty">No response</div>
      </div>
    );
  }

  if (!schemaPaths.length && !customPaths.length) {
    return (
      <div className="field">
        <label>JSONPath assertions</label>
        <div className="empty">No response schema fields were found to assert.</div>
        <CustomPathRow
          customPath={customPath}
          setCustomPath={setCustomPath}
          onAdd={addCustom}
        />
      </div>
    );
  }

  const selectedCount = rows.filter((row) => row.selected).length;

  return (
    <div className="field jsonpath-picker">
      <label>
        JSONPath assertions
        <span className="hint">{selectedCount} selected of {rows.length} paths</span>
      </label>
      <div className="jsonpath-toolbar">
        <input
          type="search"
          placeholder="Filter paths"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <div className="inline-actions">
          <button type="button" className="btn" onClick={() => setAll(true)}>Select all</button>
          <button type="button" className="btn" onClick={() => setAll(false)}>Clear</button>
        </div>
      </div>
      <div className="jsonpath-list">
        {visible.map((row) => (
          <label className={`jsonpath-row ${row.selected ? "selected" : ""}`} key={row.path}>
            <input
              type="checkbox"
              checked={row.selected}
              onChange={(event) => updateRow(row.path, { selected: event.target.checked })}
            />
            <span className="jsonpath-meta">
              <code>{row.path}</code>
              <span className="hint">
                {row.type}{row.required ? " · required" : ""}{row.description ? ` · ${row.description}` : ""}
              </span>
            </span>
            <input
              placeholder="Value to assert"
              value={row.value}
              disabled={!row.selected}
              onChange={(event) => updateRow(row.path, { selected: true, value: event.target.value })}
            />
            {row.custom ? (
              <button type="button" className="btn danger" onClick={() => removeCustom(row.path)}>
                Remove
              </button>
            ) : null}
          </label>
        ))}
      </div>
      <CustomPathRow
        customPath={customPath}
        setCustomPath={setCustomPath}
        onAdd={addCustom}
      />
    </div>
  );
}

function CustomPathRow({ customPath, setCustomPath, onAdd }) {
  return (
    <div className="jsonpath-add">
      <input
        value={customPath}
        onChange={(event) => setCustomPath(event.target.value)}
        placeholder="$.custom.path"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onAdd();
          }
        }}
      />
      <button type="button" className="btn" onClick={onAdd}>Add JSONPath</button>
    </div>
  );
}
