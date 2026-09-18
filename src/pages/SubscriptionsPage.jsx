import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Api } from "../api";
import { clearSession, isSaasAdmin, saveSession } from "../session";
import { useToast } from "../components/Toast";

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const signedIn = Boolean(session?.authenticated || session?.account);
  const admin = isSaasAdmin(session);

  useEffect(() => {
    let cancelled = false;
    Api.session()
      .then((next) => {
        if (cancelled) return;
        if (next?.tenant?.id) {
          saveSession(next.token || undefined, next.tenant.id);
        }
        setSession(next);
        if (!next?.saas || !next?.authenticated || !next?.saasAdmin) {
          return;
        }
        return Api.listSubscriptions()
          .then((list) => {
            if (!cancelled) setSubscriptions(list || []);
          })
          .catch((error) => {
            if (!cancelled) toast(error.message, true);
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

  async function setReady(item, ready) {
    setBusyId(item.tenantId);
    try {
      const updated = await Api.updateSubscription(item.tenantId, { ready });
      setSubscriptions((current) => current.map((row) => (
        row.tenantId === updated.tenantId ? updated : row
      )));
      toast(ready
        ? `${item.name} is ready for use`
        : `${item.name} is disabled`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusyId("");
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
        <h1>Subscriptions</h1>
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

  if (!admin) {
    return (
      <div className="hero">
        <div className="hero-head">
          <h1>Subscriptions</h1>
          <Link className="btn" to="/">Back to specs</Link>
        </div>
        <div className="card">
          <h3>SaaS admin access required</h3>
          <p className="hint">Only a SaaS admin can enable or disable customer workspaces.</p>
        </div>
      </div>
    );
  }

  const pending = subscriptions.filter((item) => !item.ready).length;

  return (
    <div className="hero admin-page">
      <div className="hero-head">
        <h1>Subscriptions</h1>
        <div className="hero-actions">
          <Link className="btn" to="/">Back to specs</Link>
          <button type="button" className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <p>
        Enable a workspace when that customer is ready to use Studio.
        Until you mark it ready, nobody in that workspace can open specs.
      </p>
      <div className="card">
        <div className="card-head">
          <h3>Workspaces</h3>
          <span className="hint">{pending} waiting · {subscriptions.length} total</span>
        </div>
        <div className="member-list">
          {subscriptions.length === 0 ? (
            <div className="hint">No customer workspaces yet.</div>
          ) : subscriptions.map((item) => (
            <div key={item.tenantId} className="member-row">
              <div className="member-copy">
                <div className="member-name">
                  {item.name}
                  <span className={`member-you ${item.ready ? "ready-pill" : ""}`}>
                    {item.ready ? "Ready" : "Pending"}
                  </span>
                </div>
                <div className="hint">
                  {item.ownerEmail || "No owner"}
                  {item.ownerName ? ` · ${item.ownerName}` : ""}
                </div>
              </div>
              {item.ready ? (
                <button
                  type="button"
                  className="btn danger"
                  disabled={Boolean(busyId)}
                  onClick={() => setReady(item, false)}
                >
                  Disable
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  disabled={Boolean(busyId)}
                  onClick={() => setReady(item, true)}
                >
                  Enable
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
