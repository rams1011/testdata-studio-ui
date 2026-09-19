const TOKEN_KEY = "testdata.sessionToken";
const TENANT_KEY = "testdata.tenantId";

export function getSessionToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function getTenantId() {
  return sessionStorage.getItem(TENANT_KEY) || "";
}

export function saveSession(token, tenantId) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  if (tenantId) {
    sessionStorage.setItem(TENANT_KEY, tenantId);
  } else {
    sessionStorage.removeItem(TENANT_KEY);
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TENANT_KEY);
}

export function canManageMembers(session) {
  if (!session?.saas) return false;
  const role = session?.tenant?.role;
  return role === "OWNER" || role === "ADMIN";
}

export function isSaasAdmin(session) {
  return Boolean(session?.saas && session?.saasAdmin);
}

export function isWorkspaceReady(session) {
  if (!session?.saas) return true;
  if (!session?.authenticated) return false;
  return session.tenant?.ready !== false;
}
