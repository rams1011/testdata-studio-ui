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
  if (session.subscription && session.subscription.writable === false) return false;
  return session.tenant?.ready !== false;
}

export function subscriptionBanner(session) {
  const sub = session?.subscription;
  if (!sub || sub.writable !== false) return "";
  if (sub.status === "trial") {
    return "Your trial has ended. Studio is read-only until a plan is activated.";
  }
  if (sub.status === "past_due") {
    return "This subscription is past due. Studio is read-only until billing is updated.";
  }
  if (sub.status === "canceled") {
    return "This subscription is canceled. Studio is read-only until a plan is activated.";
  }
  if (sub.status === "suspended") {
    return "This organization is suspended. Studio is read-only.";
  }
  return "This organization does not have an active subscription.";
}
