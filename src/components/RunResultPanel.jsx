function prettyBody(body) {
  if (body == null || body === "") {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function assertionLabel(item) {
  if (item.name === "status") {
    return "Status";
  }
  if (item.name === "maxResponseTimeMs") {
    return "Response time";
  }
  return item.path || item.name || "Assertion";
}

export function resultBadge(result) {
  if (!result) {
    return null;
  }
  if (result.skipped) {
    return <span className="run-badge skip">Skipped</span>;
  }
  return result.passed
    ? <span className="run-badge pass">Passed</span>
    : <span className="run-badge fail">Failed</span>;
}

export default function RunResultPanel({ result }) {
  if (!result) {
    return null;
  }
  const state = result.skipped ? "skip" : result.passed ? "pass" : "fail";
  const body = prettyBody(result.responseBody);
  return (
    <div className={`card run-result ${state}`}>
      <div className="array-toolbar" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Run result</h3>
        {resultBadge(result)}
      </div>
      {result.skipReason ? <p className="hint">{result.skipReason}</p> : null}
      {result.error ? <p className="run-error">{result.error}</p> : null}
      <div className="hint" style={{ marginBottom: 10 }}>
        {result.method} {result.url}
        {result.elapsedMs != null ? ` · ${result.elapsedMs}ms` : ""}
        {result.actualStatus ? ` · HTTP ${result.actualStatus}` : ""}
      </div>
      {result.assertions?.length ? (
        <table className="table">
          <thead>
            <tr>
              {["Check", "Expected", "Actual", ""].map((text) => <th key={text}>{text}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.assertions.map((item, index) => (
              <tr key={`${item.name}-${item.path || ""}-${index}`}>
                <td><code>{assertionLabel(item)}</code></td>
                <td>{item.expected}</td>
                <td>{item.actual}</td>
                <td>{item.passed ? <span className="run-badge pass">OK</span> : <span className="run-badge fail">Fail</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {body ? (
        <>
          <h3 style={{ marginTop: 16 }}>Response body</h3>
          <pre className="json-preview run-body">{body}</pre>
        </>
      ) : null}
    </div>
  );
}
