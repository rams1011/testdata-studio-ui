const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

export function normalizeManualPath(path) {
  const trimmed = String(path || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function pathParamNamesFromPath(path) {
  const names = [];
  const text = normalizeManualPath(path);
  const re = /\{([^}]+)\}/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const name = match[1]?.trim();
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export function inferHasRequestBody(method, explicit) {
  if (explicit != null) {
    return explicit;
  }
  return BODY_METHODS.has(String(method || "").toUpperCase());
}

export function buildManualOperationPayload({
  method,
  path,
  summary,
  tag,
  queryNames,
  headerNames,
  hasRequestBody,
  requestExample
}) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const normalizedPath = normalizeManualPath(path);
  const body = inferHasRequestBody(normalizedMethod, hasRequestBody);
  return {
    method: normalizedMethod,
    path: normalizedPath,
    summary: summary?.trim() || undefined,
    tag: tag?.trim() || "General",
    hasRequestBody: body,
    requestExample: body ? (requestExample?.trim() || undefined) : undefined,
    queryNames: splitNames(queryNames),
    headerNames: splitNames(headerNames)
  };
}

export function splitNames(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateManualPath(path) {
  const normalized = normalizeManualPath(path);
  if (!normalized || normalized === "/") {
    return "Enter a path, e.g. /users/{id}";
  }
  return null;
}
