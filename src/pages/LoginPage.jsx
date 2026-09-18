import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Api } from "../api";
import { saveSession } from "../session";
import { useToast } from "../components/Toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const session = mode === "register"
        ? await Api.register({ email, password, name, workspace })
        : await Api.login({ email, password });
      saveSession(session.token, session.tenant?.id);
      if (session.tenant?.ready === false) {
        toast(`${session.tenant?.name || "This workspace"} is waiting for a SaaS admin to enable it`);
      } else if (mode === "register") {
        toast(`Workspace ${session.tenant?.name} was created and is waiting for a SaaS admin to enable it`);
      } else {
        toast(`Signed in to ${session.tenant?.name}`);
      }
      navigate("/");
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero">
      <h1>Test Data Studio</h1>
      <p>Sign in to a workspace. Specs, collections, and environments stay private to that tenant.</p>
      <form className="card login-card" onSubmit={submit}>
        <h3>{mode === "register" ? "Create a workspace" : "Sign in"}</h3>
        {mode === "register" ? (
          <div className="field">
            <label htmlFor="signup-name">Your name</label>
            <input id="signup-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" required value={email}
            onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" required minLength={8} value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"} />
          {mode === "register" ? <div className="hint">At least 8 characters. Stored hashed, never in specs.</div> : null}
        </div>
        {mode === "register" ? (
          <div className="field">
            <label htmlFor="signup-workspace">Workspace name</label>
            <input id="signup-workspace" value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
              placeholder="e.g. Acme QA" />
            <div className="hint">Each customer gets an isolated workspace. A SaaS admin must enable it before Studio can be used.</div>
          </div>
        ) : null}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : mode === "register" ? "Create workspace" : "Sign in"}
          </button>
        </div>
        <p className="hint">
          {mode === "register" ? (
            <button type="button" className="linkish" onClick={() => setMode("login")}>
              Already have an account? Sign in
            </button>
          ) : (
            <button type="button" className="linkish" onClick={() => setMode("register")}>
              New here? Create a workspace
            </button>
          )}
        </p>
      </form>
    </div>
  );
}
