const HTTP_STATUS_TEXT = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  409: "Conflict",
  412: "Precondition Failed",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout"
};

export const STANDARD_HTTP_STATUS_CODES = Object.keys(HTTP_STATUS_TEXT).map(Number);

export function statusLabel(code) {
  const text = HTTP_STATUS_TEXT[Number(code)];
  return text ? `${code} ${text}` : String(code);
}

export function allowedStatusCodes(operation, current) {
  const fromSpec = (operation?.statusCodes || [])
    .map(Number)
    .filter((code) => Number.isInteger(code) && code > 0);
  const codes = new Set(fromSpec.length ? fromSpec : STANDARD_HTTP_STATUS_CODES);
  if (operation?.response?.statusCode != null) {
    codes.add(Number(operation.response.statusCode));
  }
  const currentCode = Number(current);
  if (Number.isInteger(currentCode) && currentCode > 0) {
    codes.add(currentCode);
  }
  return [...codes].sort((a, b) => a - b);
}
