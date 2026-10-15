import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Api } from "../api";
import { isAuthEnabled, isBillingEnabled, saveSession } from "../session";
import HomeLink from "../components/HomeLink";
import { useToast } from "../components/Toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState(true);
  const [authProvider, setAuthProvider] = useState("local");
  const [loginHint, setLoginHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([Api.config(), Api.session()])
      .then(([config, session]) => {
        if (cancelled) return;
        setAuthProvider(String(config?.authProvider || "local").toLowerCase());
        setLoginHint(config?.loginHint || "");
        const nextBilling = isBillingEnabled(session, config);
        setBilling(nextBilling);
        if (!nextBilling) {
          setMode("login");
        }
        if (!isAuthEnabled(session, config) || session?.authenticated) {
          navigate("/", { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) setBilling(true);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const ldap = authProvider === "ldap";
  const register = billing && mode === "register" && !ldap;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const session = register
        ? await Api.register({ email, password, name, workspace })
        : await Api.login({ email, password });
      saveSession(session.token, session.tenant?.id);
      if (register) {
        toast(`Organization ${session.organization?.name || session.tenant?.name} is on a 14-day trial`);
      } else {
        toast(`Signed in to ${session.tenant?.name}`);
      }
      const next = typeof location.state?.from === "string" && location.state.from.startsWith("/")
        ? location.state.from
        : "/";
      navigate(next, { replace: true });
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero">
      <div className="hero-head">
        <h1>Test Data Studio</h1>
        <div className="hero-head-actions">
          <HomeLink />
        </div>
      </div>
      <p>
        {ldap
          ? "Sign in with your company directory account. Specs stay private to your workspace."
          : billing
            ? "Sign in to a workspace. Specs, collections, and environments stay private to that tenant."
            : "Sign in with the account your administrator created. Specs stay private to your workspace."}
      </p>
      <form className="card login-card" onSubmit={submit}>
        <h3>{register ? "Create an organization" : "Sign in"}</h3>
        {register ? (
          <div className="field">
            <label htmlFor="signup-name">Your name</label>
            <input id="signup-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="signup-email">{ldap ? "Username" : "Email"}</label>
          <input
            id="signup-email"
            type={ldap ? "text" : "email"}
            required
            value={email}
            placeholder={ldap ? (loginHint || "you@company.com") : undefined}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete={ldap ? "username" : "email"}
          />
        </div>
        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" required minLength={ldap ? 1 : 8} value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={register ? "new-password" : "current-password"} />
          {register ? <div className="hint">At least 8 characters. Stored hashed, never in specs.</div> : null}
        </div>
        {register ? (
          <div className="field">
            <label htmlFor="signup-workspace">Workspace name</label>
            <input id="signup-workspace" value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
              placeholder="e.g. Acme QA" />
            <div className="hint">Creates your organization, a workspace, and a 14-day trial you can use immediately.</div>
          </div>
        ) : null}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : register ? "Start trial" : "Sign in"}
          </button>
        </div>
        {ldap ? (
          <p className="hint">Use the same username and password as your company directory.</p>
        ) : billing ? (
          <p className="hint">
            {register ? (
              <button type="button" className="linkish" onClick={() => setMode("login")}>
                Already have an account? Sign in
              </button>
            ) : (
              <button type="button" className="linkish" onClick={() => setMode("register")}>
                New here? Create a workspace
              </button>
            )}
          </p>
        ) : (
          <p className="hint">Ask an administrator if you need an account.</p>
        )}
      </form>
    </div>
  );
}
