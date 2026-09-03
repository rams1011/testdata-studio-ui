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
