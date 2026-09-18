import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Api } from "../api";
import { canManageMembers, clearSession, isWorkspaceReady, saveSession } from "../session";
import { useToast } from "../components/Toast";

const ROLES = ["MEMBER", "ADMIN", "OWNER"];

export default function AdminPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MEMBER");

  const signedIn = Boolean(session?.authenticated || session?.account);
  const manager = canManageMembers(session);
  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const canAssignOwner = session?.tenant?.role === "OWNER";
  const assignableRoles = canAssignOwner ? ROLES : ROLES.filter((item) => item !== "OWNER");

  useEffect(() => {
    let cancelled = false;
    Api.session()
      .then((next) => {
        if (cancelled) return;
        if (next?.tenant?.id) {
          saveSession(next.token || undefined, next.tenant.id);
        }
        setSession(next);
        if (!next?.saas) {
          setLoading(false);
          return;
        }
        if (!next?.authenticated) {
          setLoading(false);
          return;
        }
        if (next.tenant?.ready === false) {
          setLoading(false);
          return;
        }
        return Api.listMembers()
          .then((list) => {
            if (!cancelled) {
              setMembers(list || []);
              setForbidden(false);
            }
          })
          .catch((error) => {
            if (cancelled) return;
            if (String(error.message || "").toLowerCase().includes("only owners")) {
              setForbidden(true);
            } else {
              toast(error.message, true);
            }
          });
      })
      .catch((error) => {
        if (!cancelled) toast(error.message, true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function refreshMembers() {
    const list = await Api.listMembers();
    setMembers(list || []);
  }

  async function addMember(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { email, name, role };
      if (password.trim()) {
        payload.password = password;
      }
      await Api.addMember(payload);
      await refreshMembers();
      setEmail("");
      setName("");
      setPassword("");
      setRole("MEMBER");
      toast("Member added");
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member, nextRole) {
    if (nextRole === member.role) return;
    setBusy(true);
    try {
      await Api.updateMember(member.accountId, { role: nextRole });
      await refreshMembers();
      toast(`${member.email} is now ${nextRole.toLowerCase()}`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.email} from this workspace?`)) {
      return;
    }
    setBusy(true);
    try {
      await Api.removeMember(member.accountId);
      await refreshMembers();
      toast(`${member.email} was removed`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await Api.logout();
    } catch {
      clearSession();
    }
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="hero">
        <h1>Workspace admin</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (session && session.saas === false) {
    return <Navigate to="/" replace />;
  }

  if (!signedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!isWorkspaceReady(session)) {
    return (
      <div className="hero">
        <div className="hero-head">
          <h1>Workspace admin</h1>
          <Link className="btn" to="/">Back to specs</Link>
        </div>
        <div className="card">
          <h3>This workspace is not enabled</h3>
          <p className="hint">A SaaS admin must mark it ready before you can manage members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hero admin-page">
      <div className="hero-head">
        <h1>Workspace admin</h1>
        <div className="hero-actions">
          <Link className="btn" to="/">Back to specs</Link>
          <button type="button" className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <p>
        Manage who can open specs in {session.tenant?.name || "this workspace"}.
        Add a teammate by email — create a login, or attach someone who already has an account.
      </p>

      {forbidden || !manager ? (
        <div className="card">
          <h3>You need owner or admin access</h3>
          <p className="hint">Ask a workspace owner to promote you if you should manage members.</p>
          <div className="actions">
            <Link className="btn primary" to="/">Back to specs</Link>
          </div>
        </div>
      ) : (
        <>
          <form className="card add-member-card" onSubmit={addMember}>
            <h3>Add member</h3>
            <div className="add-member-grid">
              <div className="field">
                <label htmlFor="member-email">Email</label>
                <input
                  id="member-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="member-name">Name</label>
                <input
                  id="member-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Optional"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="member-password">Password</label>
                <input
                  id="member-password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <div className="hint">Required for a new account. Leave blank to add an existing user.</div>
              </div>
              <div className="field">
                <label htmlFor="member-role">Role</label>
                <select id="member-role" value={role} onChange={(event) => setRole(event.target.value)}>
                  {assignableRoles.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "Please wait…" : "Add member"}
              </button>
            </div>
          </form>

          <div className="card">
            <div className="card-head">
              <h3>Members</h3>
              <span className="hint">{members.length} in this workspace</span>
            </div>
            <div className="member-list">
              {members.map((member) => {
                const lastOwner = member.role === "OWNER" && ownerCount <= 1;
                const isYou = member.accountId === session.account?.id;
                return (
                  <div key={member.accountId} className="member-row">
                    <div className="member-copy">
                      <div className="member-name">
                        {member.name || member.email}
                        {isYou ? <span className="member-you">You</span> : null}
                      </div>
                      <div className="hint">{member.email}</div>
                    </div>
                    <select
                      aria-label={`Role for ${member.email}`}
                      value={member.role}
                      disabled={busy || lastOwner || (member.role === "OWNER" && !canAssignOwner)}
                      onChange={(event) => changeRole(member, event.target.value)}
                    >
                      {(member.role === "OWNER" && !canAssignOwner ? ROLES : assignableRoles).map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busy || lastOwner}
                      onClick={() => removeMember(member)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
