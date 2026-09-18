import { emptyFromSchema } from "./schema";
import { isXmlContentType, looksLikeXml, xmlToJson } from "./xml";
import { emptyAuth } from "./components/AuthSettings";

const SKIP_HEADERS = new Set([
  "content-type", "content-length", "host", "connection", "accept-encoding",
  "content-encoding", "transfer-encoding"
]);

export function matchCurlToOperation(parsed, operations) {
  if (!parsed) {
    return null;
  }
  const method = String(parsed.method || "").toUpperCase();
  const pathname = normalizePath(parsed.pathname);
  let best = null;
  (operations || []).forEach((operation) => {
    if (String(operation.method || "").toUpperCase() !== method) {
      return;
    }
    const hit = matchPathTemplate(operation.path || operation.rawPath, pathname);
    if (!hit) {
      return;
    }
    const score = hit.matchedSegments * 1000 + hit.staticCount * 10 - hit.prefixSegments;
    if (!best || score > best.score) {
      best = { operation, ...hit, score };
    }
  });
  return best;
}

export function applyCurlImport({ form, requestBody, operation, spec, parsed }) {
  const match = matchCurlToOperation(parsed, [operation]);
  const pathParams = { ...(form.pathParams || {}), ...(match?.pathParams || {}) };
  const queryParams = { ...(form.queryParams || {}), ...(parsed.query || {}) };
  const headers = { ...(form.headers || {}) };
  Object.entries(parsed.headers || {}).forEach(([name, value]) => {
    if (SKIP_HEADERS.has(name.toLowerCase())) {
      return;
    }
    headers[paramName(operation, "header", name) || name] = value;
  });
  const cookieParams = { ...(form.cookieParams || {}), ...(parsed.cookies || {}) };
  const contentType = matchContentType(parsed.contentType, operation?.requestContentTypes) || form.contentType;
  const nextBody = bodyFromCurl(parsed, operation, contentType, requestBody);
  const prefix = match?.prefix && match.prefix !== "/" ? match.prefix : "";
  const baseUrl = parsed.origin
    ? `${parsed.origin}${prefix}`
    : (form.baseUrl || spec?.baseUrl || "");
  return {
    form: {
      ...form,
      testName: `Imported curl — ${parsed.method} ${operation?.path || parsed.pathname}`,
      baseUrl,
      contentType,
      pathParams,
      queryParams,
      headers,
      cookieParams
    },
    requestBody: nextBody,
    auth: authFromCurl(parsed)
  };
}

export function authFromCurl(parsed) {
  if (!parsed) {
    return null;
  }
  if (parsed.bearerToken) {
    return { ...emptyAuth(), type: "BEARER", token: parsed.bearerToken };
  }
  if (parsed.username) {
    return { ...emptyAuth(), type: "BASIC", username: parsed.username, password: parsed.password || "" };
  }
  return null;
}

function matchPathTemplate(template, pathname) {
  const tmpl = splitPath(template);
  const path = splitPath(pathname);
  if (!tmpl.length || tmpl.length > path.length) {
    return null;
  }
  const offset = path.length - tmpl.length;
  const pathParams = {};
  let staticCount = 0;
  for (let i = 0; i < tmpl.length; i += 1) {
    const expected = tmpl[i];
    const actual = path[offset + i];
    if (expected.startsWith("{") && expected.endsWith("}")) {
      const name = expected.slice(1, -1).split(":")[0];
      try {
        pathParams[name] = decodeURIComponent(actual);
      } catch {
        pathParams[name] = actual;
      }
      continue;
    }
    if (expected !== actual) {
      return null;
    }
    staticCount += 1;
  }
  const prefixSegments = splitPath("/" + path.slice(0, offset).join("/"));
  return {
    pathParams,
    staticCount,
    matchedSegments: tmpl.length,
    prefixSegments: offset,
    prefix: prefixSegments.length ? `/${prefixSegments.join("/")}` : ""
  };
}

function splitPath(path) {
  return String(path || "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePath(path) {
  const value = String(path || "");
  if (!value || value === "/") {
    return "/";
  }
  return value.replace(/\/+$/, "") || "/";
}

function paramName(operation, location, name) {
  const hit = (operation?.parameters || []).find((item) => (
    item.in === location && String(item.name).toLowerCase() === String(name).toLowerCase()
  ));
  return hit ? hit.name : "";
}

function matchContentType(current, types) {
  const list = types || [];
  if (!current) {
    return list[0] || "";
  }
  if (list.includes(current)) {
    return current;
  }
  const mapped = mappedContentType(current);
  const hit = list.find((item) => mappedContentType(item) === mapped || mappedContentType(item) === current);
  return hit || current;
}

function mappedContentType(mediaType) {
  const value = String(mediaType || "").toLowerCase();
  if (value.includes("json")) return "JSON";
  if (value.includes("multipart")) return "MULTIPART";
  if (value.includes("urlencoded")) return "FORM";
  if (isXmlContentType(mediaType)) return "XML";
  if (value.startsWith("text/")) return "TEXT";
  return mediaType;
}

function bodyFromCurl(parsed, operation, contentType, fallback) {
  const schema = operation?.requestBody?.jsonSchema;
  const raw = parsed?.body;
  if (raw == null || String(raw).trim() === "") {
    return fallback ?? emptyFromSchema(schema) ?? {};
  }
  if (isXmlContentType(contentType) && looksLikeXml(raw)) {
    return xmlToJson(raw, schema) ?? raw;
  }
  const text = String(raw).trim();
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return JSON.parse(text);
    } catch {
      return raw;
    }
  }
  if (String(contentType || "").toLowerCase().includes("urlencoded") || text.includes("=")) {
    const object = {};
    new URLSearchParams(text).forEach((value, name) => {
      object[name] = value;
    });
    return Object.keys(object).length ? object : fallback ?? {};
  }
  return raw;
}
