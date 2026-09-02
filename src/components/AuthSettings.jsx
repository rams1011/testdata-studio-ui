import { useEffect, useState } from "react";

export function emptyAuth() {
  return {
    type: "NONE",
    username: "",
    password: "",
    token: "",
    apiKey: "",
    apiKeyName: "X-API-Key",
    apiKeyIn: "header",
    clientId: "",
    clientSecret: "",
    tokenUrl: "",
    grantType: "client_credentials"
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
  { value: "API_KEY", label: "API key" },
  { value: "OAUTH2", label: "OAuth2 client credentials" }
];

export default function AuthSettings({ auth, onChange, specAuth }) {
  const type = auth?.type || "NONE";

  function patch(fields) {
    onChange({ ...auth, ...fields });
  }

  const typeLabel = AUTH_TYPES.find((item) => item.value === type)?.label || type;

  return (
    <details className="card auth-card" defaultOpen={type !== "NONE"}>
      <summary>
        Run authentication
        <span className="hint">{type === "NONE" ? "Off — click to add credentials" : typeLabel}</span>
      </summary>
      <p className="hint" style={{ marginTop: 8, marginBottom: 12 }}>
        Used only when you click Run — not saved with the case. Choose None for 401 tests that already set Authorization.
        {specAuth && specAuth.type && specAuth.type !== "NONE" ? ` Spec uses ${specAuth.type}${specAuth.schemeName ? ` (${specAuth.schemeName})` : ""}.` : ""}
      </p>
      {type === "NONE" ? (
        <p className="hint" style={{ marginBottom: 12 }}>
          If this API needs login, add credentials before Run. A 401 usually means auth is missing.
        </p>
      ) : null}
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
                <option value="cookie">Cookie</option>
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
      {type === "OAUTH2" ? (
        <>
          <div className="field">
            <label>Token URL</label>
            <input
              value={auth.tokenUrl || ""}
              onChange={(event) => patch({ tokenUrl: event.target.value })}
              placeholder="https://auth.example.com/oauth/token"
            />
          </div>
          <div className="row-2">
            <div className="field">
              <label>Client id</label>
              <input value={auth.clientId || ""} onChange={(event) => patch({ clientId: event.target.value })} />
            </div>
            <div className="field">
              <label>Client secret</label>
              <input
                type="password"
                autoComplete="off"
                value={auth.clientSecret || ""}
                onChange={(event) => patch({ clientSecret: event.target.value })}
              />
            </div>
          </div>
          <div className="row-2">
            <SelectFieldLike
              label="Grant"
              value={auth.grantType || "client_credentials"}
              options={[
                { value: "client_credentials", label: "Client credentials" },
                { value: "password", label: "Password" }
              ]}
              onChange={(grantType) => patch({ grantType })}
            />
            <div className="field">
              <label>Or paste access token</label>
              <input
                type="password"
                autoComplete="off"
                value={auth.token || ""}
                onChange={(event) => patch({ token: event.target.value })}
              />
            </div>
          </div>
          {auth.grantType === "password" ? (
            <div className="row-2">
              <div className="field">
                <label>Username</label>
                <input value={auth.username || ""} onChange={(event) => patch({ username: event.target.value })} />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" autoComplete="off" value={auth.password || ""} onChange={(event) => patch({ password: event.target.value })} />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </details>
  );
}

function SelectFieldLike({ label, value, options, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
