import { useEffect, useState } from "react";

export function emptyAuth() {
  return {
    type: "NONE",
    username: "",
    password: "",
    token: "",
    apiKey: "",
    apiKeyName: "X-API-Key",
    apiKeyIn: "header"
  };
}

function storageKey(specId) {
  return `testdata.auth.${specId}`;
}

export function loadAuth(specId) {
  if (!specId) {
    return emptyAuth();
  }
  try {
    const raw = sessionStorage.getItem(storageKey(specId));
    return raw ? { ...emptyAuth(), ...JSON.parse(raw) } : emptyAuth();
  } catch {
    return emptyAuth();
  }
}

export function saveAuth(specId, auth) {
  if (!specId) {
    return;
  }
  sessionStorage.setItem(storageKey(specId), JSON.stringify(auth));
}

export function useSpecAuth(specId) {
  const [auth, setAuthState] = useState(() => loadAuth(specId));
  useEffect(() => {
    setAuthState(loadAuth(specId));
  }, [specId]);

  function setAuth(next) {
    const value = typeof next === "function" ? next(auth) : next;
    saveAuth(specId, value);
    setAuthState(value);
  }

  return [auth, setAuth];
}

const AUTH_TYPES = [
  { value: "NONE", label: "None" },
  { value: "BASIC", label: "Credentials (Basic)" },
  { value: "BEARER", label: "Bearer token" },
  { value: "API_KEY", label: "API key" }
];

export default function AuthSettings({ auth, onChange }) {
  const type = auth?.type || "NONE";

  function patch(fields) {
    onChange({ ...auth, ...fields });
  }

  return (
    <div className="card">
      <h3>Run authentication</h3>
      <p className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
        Applied at run time only — not saved with the case. Use None when a case already sets Authorization (for example 401 tests).
      </p>
      <div className="field">
        <label>Auth type</label>
        <select value={type} onChange={(event) => patch({ type: event.target.value })}>
          {AUTH_TYPES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>
      {type === "BASIC" ? (
        <div className="row-2">
          <div className="field">
            <label>Username</label>
            <input
              autoComplete="off"
              value={auth.username || ""}
              onChange={(event) => patch({ username: event.target.value })}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              autoComplete="off"
              value={auth.password || ""}
              onChange={(event) => patch({ password: event.target.value })}
            />
          </div>
        </div>
      ) : null}
      {type === "BEARER" ? (
        <div className="field">
          <label>Token</label>
          <input
            type="password"
            autoComplete="off"
            placeholder="Paste token; Bearer prefix is optional"
            value={auth.token || ""}
            onChange={(event) => patch({ token: event.target.value })}
          />
        </div>
      ) : null}
      {type === "API_KEY" ? (
        <>
          <div className="row-3">
            <div className="field">
              <label>Key name</label>
              <input
                value={auth.apiKeyName || ""}
                onChange={(event) => patch({ apiKeyName: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Send in</label>
              <select value={auth.apiKeyIn || "header"} onChange={(event) => patch({ apiKeyIn: event.target.value })}>
                <option value="header">Header</option>
                <option value="query">Query</option>
              </select>
            </div>
            <div className="field">
              <label>Key value</label>
              <input
                type="password"
                autoComplete="off"
                value={auth.apiKey || ""}
                onChange={(event) => patch({ apiKey: event.target.value })}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
