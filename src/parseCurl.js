const SKIP_FLAGS = new Set([
  "-k", "--insecure", "-L", "--location", "-s", "--silent", "-S", "--show-error",
  "-i", "--include", "-v", "--verbose", "-#", "--progress-bar", "--compressed",
  "--http1.0", "--http1.1", "--http2", "--http2-prior-knowledge", "-4", "-6",
  "--ipv4", "--ipv6", "-f", "--fail", "--fail-with-body", "-n", "--netrc",
  "--location-trusted", "--retry", "--retry-all-errors", "--retry-connrefused"
]);

export function parseCurl(raw) {
  const warnings = [];
  const text = normalizeContinuations(raw);
  if (!String(text).trim()) {
    throw new Error("Paste a curl command");
  }
  if (/^\s*invoke-webrequest\b/i.test(text) || /^\s*iwr\b/i.test(text)) {
    throw new Error("This looks like PowerShell Invoke-WebRequest. Paste a curl command (curl.exe), not iwr.");
  }
  const tokens = tokenize(text);
  if (!tokens.length) {
    throw new Error("Paste a curl command");
  }
  let index = 0;
  if (/^(&)?curl(\.exe)?$/i.test(tokens[0].replace(/^&/, ""))) {
    index = 1;
    if (tokens[0].startsWith("&") && tokens[1] && /^curl(\.exe)?$/i.test(tokens[1])) {
      index = 2;
    }
  } else if (!tokens[0].startsWith("-") && looksLikeUrl(tokens[0])) {
    // url-only
  } else if (!/^curl(\.exe)?$/i.test(tokens[0])) {
    const first = tokens[0];
    if (!first.startsWith("-") && !looksLikeUrl(first)) {
      throw new Error("Paste a curl command starting with curl");
    }
  }

  let method = "";
  let url = "";
  const headerList = [];
  const dataParts = [];
  let jsonBody = "";
  let asGet = false;
  let user = "";
  const cookies = {};
  let formHint = false;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token || token === "--") {
      index += 1;
      continue;
    }
    if (!token.startsWith("-")) {
      if (looksLikeUrl(token) || !url) {
        url = token;
      }
      index += 1;
      continue;
    }

    if (SKIP_FLAGS.has(token) || SKIP_FLAGS.has(token.split("=")[0])) {
      const takesValue = token === "--retry" || token.startsWith("--retry=");
      index += takesValue && !token.includes("=") ? 2 : 1;
      continue;
    }

    if (token === "-X" || token === "--request") {
      method = String(argValue(tokens, index, token)).toUpperCase();
      index = consume(tokens, index, token);
      continue;
    }
    if (token.startsWith("-X") && token.length > 2 && !token.startsWith("--")) {
      method = token.slice(2).toUpperCase();
      index += 1;
      continue;
    }
    if (token === "-I" || token === "--head") {
      method = "HEAD";
      index += 1;
      continue;
    }
    if (token === "-G" || token === "--get") {
      asGet = true;
      index += 1;
      continue;
    }
    if (token === "--url") {
      url = argValue(tokens, index, token);
      index = consume(tokens, index, token);
      continue;
    }
    if (token === "-H" || token === "--header") {
      headerList.push(argValue(tokens, index, token));
      index = consume(tokens, index, token);
      continue;
    }
    if (token === "-u" || token === "--user") {
      user = argValue(tokens, index, token);
      index = consume(tokens, index, token);
      continue;
    }
    if (token === "-b" || token === "--cookie") {
      const value = argValue(tokens, index, token);
      if (value.startsWith("@")) {
        warnings.push("Skipped cookie file " + value);
      } else {
        Object.assign(cookies, parseCookieString(value));
      }
      index = consume(tokens, index, token);
      continue;
    }
    if (token === "--json") {
      jsonBody = argValue(tokens, index, token);
      index = consume(tokens, index, token);
      continue;
    }
    if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary"
        || token === "--data-ascii" || token === "--data-urlencode") {
      const value = argValue(tokens, index, token);
      if (value.startsWith("@")) {
        warnings.push("File bodies like " + value + " cannot be imported. Paste the JSON instead.");
      } else {
        dataParts.push(value);
      }
      index = consume(tokens, index, token);
      continue;
    }
    if (token === "-F" || token === "--form" || token === "--form-string") {
      formHint = true;
      const value = argValue(tokens, index, token);
      if (value.includes("@")) {
        warnings.push("Skipped multipart file field " + value.split("=")[0]);
      } else {
        dataParts.push(value);
      }
      index = consume(tokens, index, token);
      continue;
    }

    if (token.startsWith("--") && token.includes("=")) {
      index += 1;
      continue;
    }
    if (token.startsWith("--") && tokens[index + 1] && !tokens[index + 1].startsWith("-")) {
      index += 2;
      continue;
    }
    index += 1;
  }

  if (!url) {
    throw new Error("curl is missing a URL");
  }

  const headers = parseHeaders(headerList);
  const cookieHeader = headerName(headers, "cookie");
  if (cookieHeader) {
    Object.assign(cookies, parseCookieString(cookieHeader));
    deleteHeader(headers, "cookie");
  }

  let body = jsonBody;
  if (!body && dataParts.length) {
    body = dataParts.join("&");
  }
  if (asGet && body) {
    url = appendQuery(url, body);
    body = "";
  }

  const contentType = headerName(headers, "content-type")
    || (jsonBody ? "application/json" : "")
    || (formHint ? "multipart/form-data" : "")
    || (body && looksLikeJson(body) ? "application/json" : "")
    || (body && body.includes("=") && !looksLikeJson(body) ? "application/x-www-form-urlencoded" : "");

  if (!method) {
    method = body || jsonBody || formHint ? "POST" : "GET";
  }

  const resolved = resolveUrl(url);
  const query = {};
  resolved.searchParams.forEach((value, name) => {
    if (query[name]) {
      const current = query[name];
      query[name] = Array.isArray(current) ? [...current, value] : [current, value];
    } else {
      query[name] = value;
    }
  });
  Object.keys(query).forEach((name) => {
    if (Array.isArray(query[name])) {
      query[name] = JSON.stringify(query[name]);
    }
  });

  const authorization = headerName(headers, "authorization");
  deleteHeader(headers, "authorization");
  deleteHeader(headers, "content-length");
  deleteHeader(headers, "host");
  deleteHeader(headers, "content-type");

  let bearerToken = "";
  let username = "";
  let password = "";
  if (user) {
    const separator = user.indexOf(":");
    username = separator < 0 ? user : user.slice(0, separator);
    password = separator < 0 ? "" : user.slice(separator + 1);
  } else if (authorization) {
    if (/^bearer\s+/i.test(authorization)) {
      bearerToken = authorization.replace(/^bearer\s+/i, "").trim();
    } else if (/^basic\s+/i.test(authorization)) {
      try {
        const decoded = atob(authorization.replace(/^basic\s+/i, "").trim());
        const separator = decoded.indexOf(":");
        username = separator < 0 ? decoded : decoded.slice(0, separator);
        password = separator < 0 ? "" : decoded.slice(separator + 1);
      } catch {
        warnings.push("Could not decode Basic authorization");
      }
    } else {
      headers.Authorization = authorization;
    }
  }

  return {
    method,
    url: resolved.href,
    origin: resolved.origin,
    pathname: resolved.pathname,
    query,
    headers,
    cookies,
    body,
    contentType,
    bearerToken,
    username,
    password,
    warnings
  };
}

function normalizeContinuations(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\\n/g, " ")
    .replace(/\^\n/g, " ");
}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const text = String(input);
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) {
      i += 1;
    }
    if (i >= text.length) {
      break;
    }
    if (text[i] === "'") {
      i += 1;
      let token = "";
      while (i < text.length && text[i] !== "'") {
        token += text[i];
        i += 1;
      }
      if (i < text.length) {
        i += 1;
      }
      tokens.push(token);
      continue;
    }
    if (text[i] === "\"") {
      i += 1;
      let token = "";
      while (i < text.length && text[i] !== "\"") {
        if (text[i] === "\\" && i + 1 < text.length) {
          i += 1;
          token += text[i];
          i += 1;
          continue;
        }
        token += text[i];
        i += 1;
      }
      if (i < text.length) {
        i += 1;
      }
      tokens.push(token);
      continue;
    }
    let token = "";
    while (i < text.length && !/\s/.test(text[i])) {
      if (text[i] === "\\" && i + 1 < text.length) {
        i += 1;
        token += text[i];
        i += 1;
        continue;
      }
      token += text[i];
      i += 1;
    }
    tokens.push(token);
  }
  return tokens;
}

function argValue(tokens, index, flag) {
  const eq = flag.startsWith("--") ? flag.indexOf("=") : -1;
  if (eq > 1) {
    return flag.slice(eq + 1);
  }
  return tokens[index + 1] || "";
}

function consume(tokens, index, flag) {
  const eq = flag.startsWith("--") ? flag.indexOf("=") : -1;
  if (eq > 1) {
    return index + 1;
  }
  return index + (tokens[index + 1] == null ? 1 : 2);
}

function looksLikeUrl(value) {
  const text = String(value || "");
  return /^https?:\/\//i.test(text) || text.startsWith("/") || /^[a-z0-9.-]+:\d+/i.test(text);
}

function resolveUrl(value) {
  const text = String(value || "").trim();
  try {
    return new URL(text);
  } catch {
    try {
      return new URL(`http://${text}`);
    } catch {
      throw new Error("curl URL is not valid");
    }
  }
}

function parseHeaders(list) {
  const headers = {};
  (list || []).forEach((item) => {
    const separator = String(item).indexOf(":");
    if (separator < 0) {
      return;
    }
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (name) {
      headers[name] = value;
    }
  });
  return headers;
}

function headerName(headers, name) {
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name);
  return key ? headers[key] : "";
}

function deleteHeader(headers, name) {
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === name) {
      delete headers[key];
    }
  });
}

function parseCookieString(raw) {
  const cookies = {};
  String(raw || "").split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) {
      return;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      return;
    }
    cookies[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  });
  return cookies;
}

function appendQuery(url, data) {
  const resolved = resolveUrl(url);
  const extra = new URLSearchParams(data);
  extra.forEach((value, name) => resolved.searchParams.append(name, value));
  return resolved.href;
}

function looksLikeJson(value) {
  const text = String(value || "").trim();
  return text.startsWith("{") || text.startsWith("[");
}
