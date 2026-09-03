const API_PROXY_TARGET = String(
  import.meta.env.API_PROXY_TARGET || import.meta.env.VITE_API_PROXY_TARGET || "http://localhost:8083"
).replace(/\/$/, "");
const API_BASE = String(import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export { API_BASE, API_PROXY_TARGET };
export const API_DISPLAY = API_BASE || `${API_PROXY_TARGET}/api`;

const inflightListeners = new Set();
let inflight = 0;

function notifyInflight() {
  inflightListeners.forEach((listener) => listener(inflight));
}

function beginRequest() {
  inflight += 1;
  notifyInflight();
}

function endRequest() {
  inflight = Math.max(0, inflight - 1);
  notifyInflight();
}

export function subscribeInflight(listener) {
  inflightListeners.add(listener);
  listener(inflight);
  return () => inflightListeners.delete(listener);
}

export function apiUrl(path) {
  if (!path.startsWith("/")) {
    return path;
  }
  return `${API_BASE}${path}`;
}

function errorMessage(body, status) {
  if (body && typeof body.error === "string" && body.error) {
    return body.error;
  }
  if (body && typeof body.message === "string" && body.message) {
    return body.message;
  }
  return `Request failed (${status})`;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  beginRequest();
  try {
    let response;
    try {
      response = await fetch(apiUrl(path), { ...options, headers });
    } catch {
      throw new Error(`Cannot reach API at ${API_DISPLAY}. Start testdata-generator-api at ${API_PROXY_TARGET}.`);
    }
    if (response.status === 204) {
      return null;
    }
    const body = await parseBody(response);
    if (!response.ok) {
      throw new Error(errorMessage(body, response.status));
    }
    return body;
  } finally {
    endRequest();
  }
}

function filenameFromDisposition(header) {
  if (!header) {
    return "";
  }
  const utf = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i);
  if (utf) {
    return decodeURIComponent(utf[1]);
  }
  const ascii = header.match(/filename="?([^";]+)"?/i);
  return ascii ? ascii[1] : "";
}

async function download(path, payload) {
  beginRequest();
  try {
    let response;
    try {
      response = await fetch(apiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error(`Cannot reach API at ${API_DISPLAY}. Start testdata-generator-api at ${API_PROXY_TARGET}.`);
    }

    if (!response.ok) {
      const body = await parseBody(response);
      throw new Error(errorMessage(body, response.status));
    }

    const blob = await response.blob();
    const fileName = filenameFromDisposition(response.headers.get("Content-Disposition"))
      || payload?.excelFileName
      || "TestData.xlsx";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { fileName, size: blob.size };
  } finally {
    endRequest();
  }
}

export const Api = {
  config() {
    return request("/api/testdata/config");
  },

  listSpecs() {
    return request("/api/specs");
  },

  loadSpec(payload) {
    return request("/api/specs", { method: "POST", body: JSON.stringify(payload) });
  },

  renameSpec(specId, payload) {
    return request(`/api/specs/${encodeURIComponent(specId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },

  uploadSpec(file, baseUrl, name, label) {
    const data = new FormData();
    data.append("file", file);
    if (name) {
      data.append("name", name);
    }
    if (label != null) {
      data.append("label", label);
    }
    if (baseUrl) {
      data.append("baseUrl", baseUrl);
    }
    return request("/api/specs/upload", { method: "POST", body: data });
  },

  reloadSpec(specId, payload = {}) {
    return request(`/api/specs/${encodeURIComponent(specId)}/reload`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  reloadSpecUpload(specId, file, baseUrl) {
    const data = new FormData();
    data.append("file", file);
    if (baseUrl) {
      data.append("baseUrl", baseUrl);
    }
    return request(`/api/specs/${encodeURIComponent(specId)}/reload/upload`, { method: "POST", body: data });
  },

  deleteSpec(specId) {
    return request(`/api/specs/${encodeURIComponent(specId)}`, { method: "DELETE" });
  },

  getSpec(specId) {
    return request(`/api/specs/${encodeURIComponent(specId)}`);
  },

  listOperations(specId) {
    return request(`/api/specs/${encodeURIComponent(specId)}/operations`);
  },

  getOperation(specId, operationKey) {
    return request(`/api/specs/${encodeURIComponent(specId)}/operations/${encodeURIComponent(operationKey)}`);
  },

  listCases(specId, operationKey, planId) {
    const query = new URLSearchParams();
    if (specId) query.set("specId", specId);
    if (planId) query.set("planId", planId);
    if (operationKey) query.set("operationKey", operationKey);
    return request(`/api/testdata?${query.toString()}`);
  },

  listPlans(specId) {
    return request(`/api/specs/${encodeURIComponent(specId)}/plans`);
  },

  createPlan(specId, payload) {
    return request(`/api/specs/${encodeURIComponent(specId)}/plans`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updatePlan(specId, planId, payload) {
    return request(`/api/specs/${encodeURIComponent(specId)}/plans/${encodeURIComponent(planId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },

  deletePlan(specId, planId) {
    return request(`/api/specs/${encodeURIComponent(specId)}/plans/${encodeURIComponent(planId)}`, {
      method: "DELETE"
    });
  },

  createCase(payload) {
    return request("/api/testdata", { method: "POST", body: JSON.stringify(payload) });
  },

  updateCase(id, payload) {
    return request(`/api/testdata/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
  },

  deleteCase(id) {
    return request(`/api/testdata/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  exportCases(payload) {
    return download("/api/testdata/export", payload);
  },

  generateCases(payload) {
    return request("/api/testdata/generate", { method: "POST", body: JSON.stringify(payload) });
  },

  generatePlans(payload) {
    return request("/api/testdata/generate-plans", { method: "POST", body: JSON.stringify(payload) });
  },

  runCase(id, auth) {
    return request(`/api/testdata/${encodeURIComponent(id)}/run`, {
      method: "POST",
      body: JSON.stringify({ auth })
    });
  },

  runDraft(payload) {
    return request("/api/testdata/run", { method: "POST", body: JSON.stringify(payload) });
  },

  runPlan(payload) {
    return request("/api/testdata/run-plan", { method: "POST", body: JSON.stringify(payload) });
  },

  listRuns({ specId, planId, caseId, outcome, trigger, limit } = {}) {
    const query = new URLSearchParams();
    if (specId) query.set("specId", specId);
    if (planId) query.set("planId", planId);
    if (caseId) query.set("caseId", caseId);
    if (outcome) query.set("outcome", outcome);
    if (trigger) query.set("trigger", trigger);
    if (limit) query.set("limit", String(limit));
    return request(`/api/runs?${query.toString()}`);
  },

  getRun(runId) {
    return request(`/api/runs/${encodeURIComponent(runId)}`);
  },

  getRunResult(runId, resultId) {
    return request(`/api/runs/${encodeURIComponent(runId)}/results/${encodeURIComponent(resultId)}`);
  },

  deleteRun(runId) {
    return request(`/api/runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
  },

  compareRuns({ leftRunId, leftResultId, rightRunId, rightResultId } = {}) {
    const query = new URLSearchParams();
    if (leftRunId) query.set("leftRunId", leftRunId);
    if (leftResultId) query.set("leftResultId", leftResultId);
    if (rightRunId) query.set("rightRunId", rightRunId);
    if (rightResultId) query.set("rightResultId", rightResultId);
    return request(`/api/runs/compare?${query.toString()}`);
  },

  uploadRequestFile(caseId, file) {
    const data = new FormData();
    data.append("file", file);
    return request(`/api/testdata/${encodeURIComponent(caseId)}/files`, { method: "POST", body: data });
  }
};
