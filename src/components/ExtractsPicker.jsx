import { useMemo, useState } from "react";
import {
  formatAssertionValue,
  getJsonPathValue,
  hasResponseSchema,
  jsonPathsFromSchema,
  jsonPathsFromValue,
  parseExtracts,
  parseJsonDocument,
  serializeExtracts
} from "../schema";

const COMMON_HEADERS = ["Location", "Authorization", "ETag", "Content-Type", "Retry-After", "X-Request-Id"];
const SKIP_HEADERS = new Set([
  "date", "server", "connection", "keep-alive", "transfer-encoding", "content-length",
  "content-encoding", "vary", "cache-control", "pragma", "expires", "strict-transport-security",
  "x-content-type-options", "x-frame-options", "x-xss-protection", "referrer-policy", "set-cookie"
]);

export default function ExtractsPicker({ schema, expectedResponse, runResult, value, onChange }) {
  const selected = useMemo(() => parseExtracts(value), [value]);
  const bySource = useMemo(() => {
    const map = new Map();
    selected.forEach((item) => map.set(normalizeSource(item.source), item));
    return map;
  }, [selected]);
  const [bodyFilter, setBodyFilter] = useState("");
  const [headerFilter, setHeaderFilter] = useState("");
  const [customPath, setCustomPath] = useState("$.");
  const [customHeader, setCustomHeader] = useState("");
  const [customCookie, setCustomCookie] = useState("");

  const expected = useMemo(() => parseJsonDocument(expectedResponse), [expectedResponse]);
  const runBody = useMemo(() => parseJsonDocument(runResult?.responseBody), [runResult]);
  const previewRoot = runBody !== undefined ? runBody : expected;

  const bodyRows = useMemo(
    () => mergeBodyRows(schema, expected, runBody, previewRoot, bySource),
    [schema, expected, runBody, previewRoot, bySource]
  );
  const headerRows = useMemo(
    () => mergeHeaderRows(runResult?.responseHeaders, bySource),
    [runResult, bySource]
  );
  const cookieRows = useMemo(
    () => mergeCookieRows(runResult?.responseHeaders, bySource),
    [runResult, bySource]
  );

  const visibleBody = filterRows(bodyRows, bodyFilter);
  const visibleHeaders = filterRows(headerRows, headerFilter);
  const selectedCount = selected.length;

  function emit(next) {
    onChange(serializeExtracts(next));
  }

  function toggle(source, checked, suggestedName) {
    const key = normalizeSource(source);
    if (checked) {
      if (bySource.has(key)) {
        return;
      }
      emit([...selected, { name: uniqueName(suggestedName || defaultVarName(source), selected), source }]);
      return;
    }
    emit(selected.filter((item) => normalizeSource(item.source) !== key));
  }

  function rename(source, name) {
    const key = normalizeSource(source);
    const nextName = sanitizeVarName(name);
    emit(selected.map((item) => (
      normalizeSource(item.source) === key ? { ...item, name: uniqueName(nextName, selected, key) } : item
    )));
  }

  function addBodyPath() {
    const path = customPath.trim();
    if (!path || path === "$" || path === "$.") {
      return;
    }
    toggle(path, true, defaultVarName(path));
    setCustomPath("$.");
  }

  function addHeader() {
    const name = customHeader.trim();
    if (!name) {
      return;
    }
    toggle(`header:${name}`, true, defaultVarName(`header:${name}`));
    setCustomHeader("");
  }

  function addCookie() {
    const name = customCookie.trim();
    if (!name) {
      return;
    }
    toggle(`cookie:${name}`, true, defaultVarName(`cookie:${name}`));
    setCustomCookie("");
  }

  return (
    <div className="field extracts-picker">
      <p className="hint">
        Pick a response field to save after this case runs. Later cases in this plan can pick it from the extracted-field list.
        {selectedCount ? ` ${selectedCount} selected.` : ""}
        {runResult?.responseBody || (runResult?.responseHeaders && Object.keys(runResult.responseHeaders).length)
          ? " Fields from the last Try/Run on this page are included."
          : ""}
      </p>

      <SectionTitle>Response body</SectionTitle>
      {!bodyRows.length ? (
        <div className="empty">No body fields yet. Try the request, fill Expected response, or add a JSONPath.</div>
      ) : (
        <>
          <div className="jsonpath-toolbar">
            <input
              type="search"
              placeholder="Filter body fields"
              value={bodyFilter}
              onChange={(event) => setBodyFilter(event.target.value)}
            />
          </div>
          <div className="jsonpath-list">
            {visibleBody.map((row) => (
              <ExtractRow
                key={row.source}
                row={row}
                onToggle={toggle}
                onRename={rename}
              />
            ))}
          </div>
        </>
      )}
      <div className="jsonpath-add">
        <input
          value={customPath}
          onChange={(event) => setCustomPath(event.target.value)}
          placeholder="$.custom.path"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addBodyPath();
            }
          }}
        />
        <button type="button" className="btn" onClick={addBodyPath}>Add JSONPath</button>
      </div>

      <SectionTitle>Response headers</SectionTitle>
      <div className="jsonpath-toolbar">
        <input
          type="search"
          placeholder="Filter headers"
          value={headerFilter}
          onChange={(event) => setHeaderFilter(event.target.value)}
        />
      </div>
      <div className="jsonpath-list">
        {visibleHeaders.map((row) => (
          <ExtractRow
            key={row.source}
            row={row}
            onToggle={toggle}
            onRename={rename}
          />
        ))}
      </div>
      <div className="jsonpath-add">
        <input
          value={customHeader}
          onChange={(event) => setCustomHeader(event.target.value)}
          placeholder="Header name, e.g. Location"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addHeader();
            }
          }}
        />
        <button type="button" className="btn" onClick={addHeader}>Add header</button>
      </div>

      <SectionTitle>Cookies</SectionTitle>
      {cookieRows.length ? (
        <div className="jsonpath-list">
          {cookieRows.map((row) => (
            <ExtractRow
              key={row.source}
              row={row}
              onToggle={toggle}
              onRename={rename}
            />
          ))}
        </div>
      ) : (
        <div className="empty">No Set-Cookie values yet. Try the request, or add a cookie name.</div>
      )}
      <div className="jsonpath-add">
        <input
          value={customCookie}
          onChange={(event) => setCustomCookie(event.target.value)}
          placeholder="Cookie name, e.g. JSESSIONID"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCookie();
            }
          }}
        />
        <button type="button" className="btn" onClick={addCookie}>Add cookie</button>
      </div>
    </div>
  );
}

function ExtractRow({ row, onToggle, onRename }) {
  return (
    <div className={`jsonpath-row extract-row ${row.selected ? "selected" : ""}`}>
      <label className="extract-choice">
        <input
          type="checkbox"
          checked={row.selected}
          onChange={(event) => onToggle(row.source, event.target.checked, row.name)}
        />
        <span className="jsonpath-meta">
          <code>{row.label}</code>
          <span className="hint">
            {row.kind}
            {row.sample ? ` · ${row.sample}` : ""}
          </span>
        </span>
      </label>
      <div className="extract-as">
        <span className="hint">as</span>
        <input
          value={row.name}
          placeholder="name"
          disabled={!row.selected}
          aria-label={`Variable name for ${row.label}`}
          onChange={(event) => onRename(row.source, event.target.value)}
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="tag-label extract-section">{children}</div>;
}

function mergeBodyRows(schema, expected, runBody, previewRoot, bySource) {
  const rows = [];
  const seen = new Set();
  const schemaAvailable = hasResponseSchema(schema);
  const schemaPaths = schemaAvailable ? jsonPathsFromSchema(schema) : [];
  const valuePaths = [
    ...jsonPathsFromValue(expected),
    ...jsonPathsFromValue(runBody)
  ];

  function add(path, type, origin) {
    const source = path;
    const key = normalizeSource(source);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const saved = bySource.get(key);
    const preview = previewRoot !== undefined ? getJsonPathValue(previewRoot, path) : undefined;
    rows.push({
      source,
      label: path,
      kind: type || origin || "body",
      sample: preview !== undefined ? formatAssertionValue(preview) : "",
      selected: Boolean(saved),
      name: saved?.name || defaultVarName(source)
    });
  }

  schemaPaths.forEach((item) => add(item.path, item.type, "schema"));
  valuePaths.forEach((item) => add(item.path, item.type, "body"));
  [...bySource.values()]
    .filter((item) => isBodySource(item.source) && !seen.has(normalizeSource(item.source)))
    .forEach((item) => add(item.source, "custom", "custom"));
  return rows;
}

function mergeHeaderRows(responseHeaders, bySource) {
  const rows = [];
  const seen = new Set();
  const runHeaders = Object.keys(responseHeaders || {}).filter((name) => !SKIP_HEADERS.has(name.toLowerCase()));
  const names = [...COMMON_HEADERS];
  runHeaders.forEach((name) => {
    if (!names.some((item) => item.toLowerCase() === name.toLowerCase())) {
      names.push(name);
    }
  });

  function add(headerName) {
    const source = `header:${headerName}`;
    const key = normalizeSource(source);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const saved = bySource.get(key);
    const sample = headerValue(responseHeaders, headerName);
    rows.push({
      source,
      label: headerName,
      kind: "header",
      sample: sample ? formatAssertionValue(sample) : "",
      selected: Boolean(saved),
      name: saved?.name || defaultVarName(source)
    });
  }

  names.forEach(add);
  [...bySource.values()]
    .filter((item) => isHeaderSource(item.source) && !seen.has(normalizeSource(item.source)))
    .forEach((item) => add(item.source.slice(item.source.indexOf(":") + 1)));
  return rows;
}

function mergeCookieRows(responseHeaders, bySource) {
  const rows = [];
  const seen = new Set();
  const cookies = cookieNames(responseHeaders);

  function add(cookieName) {
    const source = `cookie:${cookieName}`;
    const key = normalizeSource(source);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const saved = bySource.get(key);
    rows.push({
      source,
      label: cookieName,
      kind: "cookie",
      sample: "",
      selected: Boolean(saved),
      name: saved?.name || defaultVarName(source)
    });
  }

  cookies.forEach(add);
  [...bySource.values()]
    .filter((item) => isCookieSource(item.source) && !seen.has(normalizeSource(item.source)))
    .forEach((item) => add(item.source.slice(item.source.indexOf(":") + 1)));
  return rows;
}

function filterRows(rows, filter) {
  const needle = filter.trim().toLowerCase();
  if (!needle) {
    return rows;
  }
  return rows.filter((row) => `${row.label} ${row.kind} ${row.name}`.toLowerCase().includes(needle));
}

function headerValue(headers, name) {
  if (!headers) {
    return "";
  }
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === String(name).toLowerCase());
  return match ? match[1] : "";
}

function cookieNames(headers) {
  const values = [];
  Object.entries(headers || {}).forEach(([name, value]) => {
    if (name.toLowerCase() === "set-cookie") {
      String(value || "").split(/\n|, (?=[A-Za-z_][A-Za-z0-9_]*=)/).forEach((part) => {
        const cookie = part.split(";", 1)[0];
        const separator = cookie.indexOf("=");
        if (separator > 0) {
          values.push(cookie.slice(0, separator).trim());
        }
      });
    }
  });
  return [...new Set(values)];
}

function isBodySource(source) {
  const value = String(source || "").trim();
  return value.startsWith("$") || value.toLowerCase().startsWith("body:");
}

function isHeaderSource(source) {
  return String(source || "").toLowerCase().startsWith("header:");
}

function isCookieSource(source) {
  return String(source || "").toLowerCase().startsWith("cookie:");
}

function normalizeSource(source) {
  const value = String(source || "").trim();
  if (value.toLowerCase().startsWith("body:")) {
    return value.slice(5).trim();
  }
  if (value.toLowerCase().startsWith("header:")) {
    return `header:${value.slice(7).trim().toLowerCase()}`;
  }
  if (value.toLowerCase().startsWith("cookie:")) {
    return `cookie:${value.slice(7).trim().toLowerCase()}`;
  }
  return value;
}

function defaultVarName(source) {
  const spec = String(source || "").trim();
  if (spec.toLowerCase().startsWith("header:") || spec.toLowerCase().startsWith("cookie:")) {
    return sanitizeVarName(spec.slice(spec.indexOf(":") + 1));
  }
  const path = spec.toLowerCase().startsWith("body:") ? spec.slice(5).trim() : spec;
  const matches = path.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const last = matches.filter((item) => item !== "$").pop();
  return sanitizeVarName(last || "value");
}

function sanitizeVarName(raw) {
  const parts = String(raw || "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => {
      const letters = part.replace(/[^A-Za-z]/g, "");
      const upper = (part.match(/[A-Z]/g) || []).length;
      return letters && upper >= letters.length / 2 ? part.toLowerCase() : part;
    });
  if (!parts.length) {
    return "value";
  }
  const [first, ...rest] = parts;
  let name = first.charAt(0).toLowerCase() + first.slice(1)
    + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  if (/^[0-9]/.test(name)) {
    name = `v${name}`;
  }
  return name;
}

function uniqueName(raw, selected, keepSourceKey) {
  const base = sanitizeVarName(raw);
  const taken = new Set(
    selected
      .filter((item) => normalizeSource(item.source) !== keepSourceKey)
      .map((item) => item.name)
  );
  if (!taken.has(base)) {
    return base;
  }
  let index = 2;
  while (taken.has(`${base}${index}`)) {
    index += 1;
  }
  return `${base}${index}`;
}
