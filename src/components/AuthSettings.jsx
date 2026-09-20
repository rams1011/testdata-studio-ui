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

export function normalizeAuthType(value) {
  const type = String(value || "NONE").trim().toUpperCase();
  if (type === "TOKEN") return "BEARER";
  if (type === "CREDENTIALS") return "BASIC";
  if (type === "APIKEY" || type === "API-KEY") return "API_KEY";
  if (type === "OAUTH") return "OAUTH2";
  return AUTH_TYPES.some((item) => item.value === type) ? type : "NONE";
}

export function authCredentialsMissing(auth, environmentAuthType) {
  const type = normalizeAuthType(environmentAuthType || auth?.type);
  if (type === "NONE") return true;
  if (type === "BEARER") return !String(auth?.token || "").trim();
  if (type === "BASIC") {
    return !String(auth?.username || "").trim() || !String(auth?.password || "").trim();
  }
  if (type === "API_KEY") return !String(auth?.apiKey || "").trim();
  if (type === "OAUTH2") {
    if (String(auth?.token || "").trim()) return false;
    return !String(auth?.clientId || "").trim() || !String(auth?.clientSecret || "").trim()
      || !String(auth?.tokenUrl || "").trim();
  }
  return false;
}

export default function AuthSettings({ auth, onChange, specAuth, environment }) {
  const envType = environment ? normalizeAuthType(environment.authType) : "";
  const type = envType || normalizeAuthType(auth?.type);
  const typeLabel = AUTH_TYPES.find((item) => item.value === type)?.label || type;
  const envName = environment?.name;

  useEffect(() => {
    if (!envType) {
      return;
    }
    if (normalizeAuthType(auth?.type) === envType) {
      return;
    }
    onChange({ ...emptyAuth(), ...auth, type: envType });
  }, [envType, auth, onChange]);

  function patch(fields) {
    onChange({ ...auth, type, ...fields });
  }

  return (
    <details className="card auth-card" defaultOpen={type !== "NONE"}>
      <summary>
        Run authentication
        <span className="hint">
          {type === "NONE"
            ? envName ? `${envName} · Off` : "Off"
            : envName ? `${envName} · ${typeLabel}` : typeLabel}
        </span>
      </summary>
      <p className="hint" style={{ marginTop: 8, marginBottom: 12 }}>
        Used only when you click Run — not saved with the case.
        {type === "NONE"
          ? ` ${envName || "This environment"} does not send credentials. Change Auth type under Manage environment if this host needs login.`
          : ` Enter credentials for ${envName || "this environment"}. Change Auth type under Manage environment.`}
        {specAuth && specAuth.type && specAuth.type !== "NONE" ? ` Spec uses ${specAuth.type}${specAuth.schemeName ? ` (${specAuth.schemeName})` : ""}.` : ""}
      </p>
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
