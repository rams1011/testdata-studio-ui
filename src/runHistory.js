export function formatRunTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function triggerLabel(trigger) {
  if (trigger === "try") {
    return "Try";
  }
  if (trigger === "case") {
    return "Case";
  }
  if (trigger === "plan") {
    return "Plan";
  }
  return trigger || "Run";
}

export function runCounts(run) {
  const parts = [];
  if (run?.passed) {
    parts.push(`${run.passed} passed`);
  }
  if (run?.failed) {
    parts.push(`${run.failed} failed`);
  }
  if (run?.skipped) {
    parts.push(`${run.skipped} skipped`);
  }
  return parts.join(" · ") || "No results";
}

export function runTone(run) {
  if (!run) {
    return "skip";
  }
  if (run.failed > 0) {
    return "fail";
  }
  if (run.passed > 0) {
    return "pass";
  }
  return "skip";
}

export function pickHistoryResult(run, resultId) {
  const results = run?.results || [];
  if (resultId) {
    const match = results.find((item) => item.resultId === resultId);
    if (match) {
      return match;
    }
  }
  return results.find((item) => item.outcome === "failed" || item.outcome === "error")
    || results[0]
    || null;
}

export function snapshotLabel(result) {
  if (!result) {
    return "";
  }
  const name = result.testName || result.operationKey || result.method || "Snapshot";
  const when = formatRunTime(result.createdAt);
  return when ? `${name} · ${when}` : name;
}

export function sameSnapshot(left, right) {
  return Boolean(left && right && left.runId === right.runId && left.resultId === right.resultId);
}

export function compareSlot(result) {
  if (!result?.runId || !result?.resultId) {
    return null;
  }
  return {
    runId: result.runId,
    resultId: result.resultId,
    label: snapshotLabel(result)
  };
}

export const COMPARE_BODY_FIELDS = new Set(["requestParams", "requestBody", "responseBody", "assertions"]);

const COMPARE_FIELD_LABELS = {
  outcome: "Outcome",
  testName: "Test name",
  operationKey: "Operation",
  caseId: "Case id",
  method: "Method",
  url: "URL",
  expectedStatus: "Expected status",
  actualStatus: "Actual status",
  statusMatched: "Status matched",
  elapsedMs: "Elapsed ms",
  timedOut: "Timed out",
  error: "Error",
  requestContentType: "Request content type",
  requestParams: "Request params",
  requestBody: "Request body",
  responseBody: "Response body",
  assertions: "Assertions",
  downloadPath: "Download path"
};

export function compareFieldLabel(field) {
  return COMPARE_FIELD_LABELS[field] || field;
}

export function prettyJson(value) {
  if (value == null || value === "") {
    return "";
  }
  const text = String(value);
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
