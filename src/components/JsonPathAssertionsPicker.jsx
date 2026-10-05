import { useEffect, useMemo, useState } from "react";
import {
  applyExpectedToJsonPathAssertions,
  formatAssertionValue,
  getJsonPathValue,
  hasResponseSchema,
  jsonPathsFromSchema,
  parseJsonDocument,
  parseJsonPathAssertions,
  serializeJsonPathAssertions
} from "../schema";

export default function JsonPathAssertionsPicker({ schema, value, onChange, expectedResponse }) {
  const schemaAvailable = hasResponseSchema(schema);
  const schemaPaths = useMemo(() => jsonPathsFromSchema(schemaAvailable ? schema : null), [schema, schemaAvailable]);
  const saved = useMemo(() => parseJsonPathAssertions(value), [value]);
  const expected = useMemo(() => parseJsonDocument(expectedResponse), [expectedResponse]);
  const [customPath, setCustomPath] = useState("$.");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const next = applyExpectedToJsonPathAssertions(value, expectedResponse);
    if (next !== value) {
      onChange(next);
    }
  }, [expectedResponse]);

  const customPaths = useMemo(() => {
    const known = new Set(schemaPaths.map((item) => item.path));
    return [...saved.keys()].filter((path) => !known.has(path));
  }, [schemaPaths, saved]);

  const rows = useMemo(() => {
    const schemaRows = schemaPaths.map((item) => {
      const fromExpected = expected !== undefined ? getJsonPathValue(expected, item.path) : undefined;
      const derived = fromExpected !== undefined;
      return {
        ...item,
        custom: false,
        selected: saved.has(item.path),
        derived,
        value: derived
          ? formatAssertionValue(fromExpected)
          : (saved.has(item.path) ? saved.get(item.path) : "")
      };
    });
    const extraRows = customPaths.map((path) => {
      const fromExpected = expected !== undefined ? getJsonPathValue(expected, path) : undefined;
      const derived = fromExpected !== undefined;
      return {
        path,
        type: "custom",
        required: false,
        description: "",
        sample: "",
        custom: true,
        selected: true,
        derived,
        value: derived ? formatAssertionValue(fromExpected) : (saved.get(path) || "")
      };
    });
    return [...schemaRows, ...extraRows];
  }, [schemaPaths, customPaths, saved, expected]);

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

  function clearSelections() {
    if (!hasJsonPathAssertionContent(value, selectedCount)) {
      return;
    }
    if (!window.confirm("Clear all JSONPath assertions? No response fields will be asserted until you select paths again.")) {
      return;
    }
    setAll(false);
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
  const canClear = hasJsonPathAssertionContent(value, selectedCount);

  return (
    <div className="field jsonpath-picker">
      <label>
        JSONPath assertions
        <span className="hint">
          {selectedCount} selected of {rows.length} paths
          {expected !== undefined ? " · values from Expected response" : ""}
        </span>
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
          <button type="button" className="btn" onClick={clearSelections} disabled={!canClear}>Clear</button>
        </div>
      </div>
      <div className="jsonpath-list">
        {visible.map((row) => (
          <JsonPathAssertionRow
            key={row.path}
            row={row}
            onToggle={(selected) => updateRow(row.path, { selected })}
            onValueChange={(value) => updateRow(row.path, { selected: true, value })}
            onRemove={row.custom ? () => removeCustom(row.path) : null}
          />
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

function hasJsonPathAssertionContent(serialized, selectedCount) {
  if (selectedCount > 0) {
    return true;
  }
  if (serialized == null) {
    return false;
  }
  const text = String(serialized).trim();
  if (!text || text.toUpperCase() === "NA") {
    return false;
  }
  return parseJsonPathAssertions(serialized).size > 0;
}

function jsonPathRowTitle(row) {
  const parts = [row.path];
  if (row.type) {
    parts.push(row.type + (row.required ? " (required)" : ""));
  }
  if (row.description) {
    parts.push(row.description);
  }
  return parts.join("\n");
}

function JsonPathAssertionRow({ row, onToggle, onValueChange, onRemove }) {
  const valuePlaceholder = row.derived
    ? "From expected response"
    : (row.type ? `Expected ${row.type}` : "Value to assert");

  return (
    <div className={`jsonpath-row jsonpath-assertion-row ${row.selected ? "selected" : ""}`}>
      <div className="jsonpath-assertion-head">
        <label className="jsonpath-assertion-path">
          <input
            type="checkbox"
            checked={row.selected}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <code title={jsonPathRowTitle(row)}>
            {row.path}
            {row.required ? <span className="jsonpath-required" aria-hidden="true"> *</span> : null}
          </code>
          {row.type && row.type !== "custom" ? (
            <span className="jsonpath-type-pill">{row.type}</span>
          ) : null}
        </label>
        {onRemove ? (
          <button type="button" className="btn danger" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>
      {row.description ? (
        <p className="hint jsonpath-assertion-desc">{row.description}</p>
      ) : null}
      <input
        className="jsonpath-assertion-value"
        placeholder={valuePlaceholder}
        value={row.value}
        disabled={!row.selected || row.derived}
        aria-label={`Expected value for ${row.path}`}
        onChange={(event) => onValueChange(event.target.value)}
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
