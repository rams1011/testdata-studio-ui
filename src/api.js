import { clearSession, getSessionToken, getTenantId } from "./session";

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

function authHeaders() {
  const headers = {};
  const token = getSessionToken();
  const tenantId = getTenantId();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }
  return headers;
}

async function request(path, options = {}) {
  const headers = { ...authHeaders(), ...(options.headers || {}) };
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
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event("testdata:unauthorized"));
    }
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

async function download(path, payload, fallbackName) {
  beginRequest();
  try {
    let response;
    try {
      response = await fetch(apiUrl(path), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error(`Cannot reach API at ${API_DISPLAY}. Start testdata-generator-api at ${API_PROXY_TARGET}.`);
    }

    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event("testdata:unauthorized"));
    }
    if (!response.ok) {
      const body = await parseBody(response);
      throw new Error(errorMessage(body, response.status));
    }

    const blob = await response.blob();
    const fileName = filenameFromDisposition(response.headers.get("Content-Disposition"))
      || fallbackName
      || payload?.excelFileName
      || "download";
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

  session() {
    return request("/api/auth/session");
  },

  register(payload) {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
  },

  login(payload) {
    return request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
  },

  logout() {
    return request("/api/auth/logout", { method: "POST" }).finally(() => clearSession());
  },

  switchTenant(tenantId) {
    return request("/api/auth/switch-tenant", {
      method: "POST",
      body: JSON.stringify({ tenantId })
    });
  },

  createTenant(payload) {
    return request("/api/tenants", { method: "POST", body: JSON.stringify(payload) });
  },

  listMembers() {
    return request("/api/tenants/current/members");
  },

  addMember(payload) {
    return request("/api/tenants/current/members", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateMember(accountId, payload) {
    return request(`/api/tenants/current/members/${encodeURIComponent(accountId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },

  removeMember(accountId) {
    return request(`/api/tenants/current/members/${encodeURIComponent(accountId)}`, {
      method: "DELETE"
    });
  },

  listSubscriptions() {
    return request("/api/saas/subscriptions");
  },

  updateSubscription(tenantId, payload) {
    return request(`/api/saas/subscriptions/${encodeURIComponent(tenantId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
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

  addOperation(specId, payload) {
    return request(`/api/specs/${encodeURIComponent(specId)}/operations`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  deleteOperation(specId, operationKey) {
    return request(`/api/specs/${encodeURIComponent(specId)}/operations/${encodeURIComponent(operationKey)}`, {
      method: "DELETE"
    });
  },

  listCases(specId, operationKey, planId, environmentId) {
    const query = new URLSearchParams();
    if (specId) query.set("specId", specId);
    if (planId) query.set("planId", planId);
    if (operationKey) query.set("operationKey", operationKey);
    if (environmentId) query.set("environmentId", environmentId);
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

  deleteCase(id, environmentId) {
    const query = new URLSearchParams();
    if (environmentId) query.set("environmentId", environmentId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/testdata/${encodeURIComponent(id)}${suffix}`, { method: "DELETE" });
  },

  exportCases(payload) {
    return download("/api/testdata/export", payload);
  },

  exportCollection(payload) {
    return download("/api/testdata/export-collection", payload, "collection.json");
  },

  importCollection(file, specId, environmentId) {
    const data = new FormData();
    data.append("file", file);
    const query = new URLSearchParams();
    if (specId) query.set("specId", specId);
    if (environmentId) query.set("environmentId", environmentId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/testdata/import-collection${suffix}`, { method: "POST", body: data });
  },

  exportEnvironment(payload) {
    return download("/api/testdata/export-environment", payload, "environment.json");
  },

  importEnvironment(file, specId, apply = true) {
    const data = new FormData();
    data.append("file", file);
    const query = new URLSearchParams();
    query.set("specId", specId);
    query.set("apply", apply ? "true" : "false");
    return request(`/api/testdata/import-environment?${query.toString()}`, { method: "POST", body: data });
  },

  listEnvironments(specId) {
    return request(`/api/specs/${encodeURIComponent(specId)}/environments`);
  },

  createEnvironment(specId, payload) {
    return request(`/api/specs/${encodeURIComponent(specId)}/environments`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateEnvironment(specId, environmentId, payload) {
    return request(
      `/api/specs/${encodeURIComponent(specId)}/environments/${encodeURIComponent(environmentId)}`,
      { method: "PUT", body: JSON.stringify(payload) }
    );
  },

  duplicateEnvironment(specId, environmentId) {
    return request(
      `/api/specs/${encodeURIComponent(specId)}/environments/${encodeURIComponent(environmentId)}/duplicate`,
      { method: "POST" }
    );
  },

  applyEnvironment(specId, environmentId) {
    return request(
      `/api/specs/${encodeURIComponent(specId)}/environments/${encodeURIComponent(environmentId)}/apply`,
      { method: "POST" }
    );
  },

  deleteEnvironment(specId, environmentId) {
    return request(
      `/api/specs/${encodeURIComponent(specId)}/environments/${encodeURIComponent(environmentId)}`,
      { method: "DELETE" }
    );
  },

  generateCases(payload) {
    return request("/api/testdata/generate", { method: "POST", body: JSON.stringify(payload) });
  },

  generatePlans(payload) {
    return request("/api/testdata/generate-plans", { method: "POST", body: JSON.stringify(payload) });
  },

  runCase(id, auth, environmentId) {
    return request(`/api/testdata/${encodeURIComponent(id)}/run`, {
      method: "POST",
      body: JSON.stringify({ auth, environmentId })
    });
  },

  runDraft(payload) {
    return request("/api/testdata/run", { method: "POST", body: JSON.stringify(payload) });
  },

  runPlan(payload) {
    return request("/api/testdata/run-plan", { method: "POST", body: JSON.stringify(payload) });
  },

  duplicateCase(id, payload) {
    return request(`/api/testdata/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
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

  uploadRequestFile(caseId, file, part = "file") {
    const data = new FormData();
    data.append("file", file);
    const query = new URLSearchParams();
    if (part) query.set("part", part);
    return request(`/api/testdata/${encodeURIComponent(caseId)}/files?${query.toString()}`, {
      method: "POST",
      body: data
    });
  }
};
