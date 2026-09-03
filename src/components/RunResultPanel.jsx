const PREVIEW_CHARS = 80;

function prettyBody(body) {
  if (body == null || body === "") {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return String(body);
  }
}

function compactJson(value) {
  if (value == null || value === "") {
    return "";
  }
  const text = String(value);
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text.replace(/\s+/g, " ").trim();
  }
}

function previewText(value, limit = PREVIEW_CHARS) {
  const compact = compactJson(value);
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit)}…`;
}

function assertionLabel(item) {
  if (item.name === "status") {
    return "Status";
  }
  if (item.name === "expectedResponse") {
    return "Expected body";
  }
  if (item.name === "maxResponseTimeMs") {
    return "Response time";
  }
  return item.path || item.name || "Assertion";
}

function HoverJson({ value }) {
  const full = prettyBody(value) || String(value ?? "");
  const shown = previewText(value);
  if (!full) {
    return null;
  }
  if (full === shown) {
    return shown;
  }
  return (
    <span className="hover-json">
      <span className="hover-json-preview">{shown}</span>
      <span className="hover-json-tip" role="tooltip">{full}</span>
    </span>
  );
}

export function runOutcome(result) {
  if (!result) {
    return "";
  }
  if (result.outcome) {
    return result.outcome;
  }
  if (result.skipped) {
    return "skipped";
  }
  if (result.passed) {
    return "passed";
  }
  if (result.error) {
    return "error";
  }
  return "failed";
}

export function resultBadge(result) {
  const outcome = runOutcome(result);
  if (!outcome) {
    return null;
  }
  if (outcome === "skipped") {
    return <span className="run-badge skip">Skipped</span>;
  }
  if (outcome === "passed") {
    return <span className="run-badge pass">Passed</span>;
  }
  if (outcome === "error") {
    return <span className="run-badge fail">Error</span>;
  }
  return <span className="run-badge fail">Failed</span>;
}

export default function RunResultPanel({ result, title = "Run result" }) {
  if (!result) {
    return null;
  }
  const outcome = runOutcome(result);
  const state = outcome === "skipped" ? "skip" : outcome === "passed" ? "pass" : "fail";
  const body = prettyBody(result.responseBody);
  const requestBody = prettyBody(result.requestBody);
  return (
    <div className={`card run-result ${state}`}>
      <div className="array-toolbar" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{result.testName || title}</h3>
        {resultBadge(result)}
      </div>
      {result.skipReason ? <p className="hint">{result.skipReason}</p> : null}
      {result.error ? <p className="run-error">{result.error}</p> : null}
      <div className="hint" style={{ marginBottom: 10 }}>
        {result.method} {result.url}
        {result.elapsedMs != null ? ` · ${result.elapsedMs}ms` : ""}
        {result.actualStatus ? ` · HTTP ${result.actualStatus}` : ""}
        {result.downloadPath ? ` · saved ${result.downloadPath}` : ""}
      </div>
      {requestBody || (result.requestParams && Object.keys(result.requestParams).length) ? (
        <>
          <h3 style={{ marginTop: 16 }}>Request</h3>
          {result.requestContentType ? <div className="hint">{result.requestContentType}</div> : null}
          {result.requestParams && Object.keys(result.requestParams).length ? (
            <pre className="json-preview">{JSON.stringify(result.requestParams, null, 2)}</pre>
          ) : null}
          {requestBody ? <pre className="json-preview">{requestBody}</pre> : null}
        </>
      ) : null}
      {result.assertions?.length ? (
        <table className="table run-assert-table">
          <thead>
            <tr>
              {["Check", "Expected", "Actual", ""].map((text) => <th key={text}>{text}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.assertions.map((item, index) => (
              <tr key={`${item.name}-${item.path || ""}-${index}`}>
                <td><code>{assertionLabel(item)}</code></td>
                <td className="run-cell-json"><HoverJson value={item.expected} /></td>
                <td className="run-cell-json"><HoverJson value={item.actual} /></td>
                <td>{item.passed ? <span className="run-badge pass">OK</span> : <span className="run-badge fail">Fail</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {body ? (
        <>
          <h3 style={{ marginTop: 16 }}>Response body</h3>
          <pre className="json-preview">{body}</pre>
        </>
      ) : null}
    </div>
  );
}
