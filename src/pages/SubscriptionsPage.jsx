import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Api } from "../api";
import AccountMenu from "../components/AccountMenu";
import GuideLink from "../components/GuideLink";
import HomeLink from "../components/HomeLink";
import { canManageMembers, clearSession, isBillingEnabled, isSaasAdmin, isWorkspaceReady, saveSession } from "../session";
import { useToast } from "../components/Toast";

function usage(used, limit) {
  return `${used ?? 0} / ${limit ?? 0}`;
}

function planLabel(plan) {
  if (!plan) return "None";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function statusLabel(item) {
  if (item?.writable) return item.status === "trial" ? "Trial" : "Active";
  if (item?.status === "trial") return "Trial ended";
  if (item?.status === "past_due") return "Past due";
  if (item?.status === "canceled") return "Canceled";
  if (item?.status === "suspended") return "Suspended";
  return item?.status || "Unknown";
}

function UsageCard({ item }) {
  if (!item) return null;
  return (
    <div className="card">
      <div className="card-head">
        <h3>{item.name}</h3>
        <span className={`member-you ${item.writable ? "ready-pill" : ""}`}>
          {planLabel(item.plan)} · {statusLabel(item)}
        </span>
      </div>
      <p className="hint">
        {item.ownerEmail || "Organization subscription"}
        {item.ownerName ? ` · ${item.ownerName}` : ""}
        {item.trialEndsAt && item.status === "trial" ? ` · Trial ends ${new Date(item.trialEndsAt).toLocaleDateString()}` : ""}
      </p>
      <div className="member-list">
        <div className="member-row">
          <div className="member-copy">Workspaces</div>
          <div className="hint">{usage(item.workspacesUsed, item.workspaceLimit)}</div>
        </div>
        <div className="member-row">
          <div className="member-copy">Seats</div>
          <div className="hint">{usage(item.seatsUsed, item.seatLimit)}</div>
        </div>
        <div className="member-row">
          <div className="member-copy">Specs</div>
          <div className="hint">{usage(item.specsUsed, item.specLimit)}</div>
        </div>
        <div className="member-row">
          <div className="member-copy">Runs this month</div>
          <div className="hint">{usage(item.runsUsed, item.runLimitMonth)}</div>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [mine, setMine] = useState(null);
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
        if (!next?.saas || !next?.authenticated) {
          return;
        }
        setMine(next.subscription || null);
        const loadMine = next.subscription
          ? Promise.resolve(next.subscription)
          : Api.currentSubscription().catch(() => null);
        const loadAll = next.saasAdmin
          ? Api.listSubscriptions()
          : Promise.resolve([]);
        return Promise.all([loadMine, loadAll])
          .then(([current, list]) => {
            if (cancelled) return;
            if (current) setMine(current);
            setSubscriptions(list || []);
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
    setBusyId(item.orgId);
    try {
      const updated = await Api.updateSubscription(item.orgId, { ready });
      setSubscriptions((current) => current.map((row) => (
        row.orgId === updated.orgId ? updated : row
      )));
      if (mine?.orgId === updated.orgId) {
        setMine(updated);
      }
      toast(ready
        ? `${item.name} is active`
        : `${item.name} is suspended`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusyId("");
    }
  }

  async function setPlan(item, plan) {
    setBusyId(item.orgId);
    try {
      const updated = await Api.updateSubscription(item.orgId, { plan, status: "active" });
      setSubscriptions((current) => current.map((row) => (
        row.orgId === updated.orgId ? updated : row
      )));
      toast(`${item.name} is now on the ${planLabel(plan)} plan`);
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
        <h1>Plan</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (session && (session.saas === false || !isBillingEnabled(session))) {
    return <Navigate to="/" replace />;
  }

  if (!signedIn) {
    return <Navigate to="/login" replace />;
  }

  const waiting = subscriptions.filter((item) => !item.writable).length;

  return (
    <div className="hero admin-page">
      <div className="hero-head">
        <h1>{admin ? "Subscriptions" : "Plan"}</h1>
        <div className="hero-head-actions">
          <HomeLink />
          <GuideLink />
          <AccountMenu
            account={session?.account}
            canManage={isWorkspaceReady(session) && canManageMembers(session)}
            canManageSubscriptions={isBillingEnabled(session)}
            onSignOut={signOut}
          />
        </div>
      </div>
      <p>
        {admin
          ? "Organizations own the subscription. Workspaces under an organization share that plan, seats, and usage."
          : "Your organization owns this plan. Every workspace in the organization shares these limits."}
      </p>

      <UsageCard item={mine} />

      {admin ? (
        <div className="card">
          <div className="card-head">
            <h3>Organizations</h3>
            <span className="hint">{waiting} not writable · {subscriptions.length} total</span>
          </div>
          <div className="member-list">
            {subscriptions.length === 0 ? (
              <div className="hint">No customer organizations yet.</div>
            ) : subscriptions.map((item) => (
              <div key={item.orgId} className="member-row">
                <div className="member-copy">
                  <div className="member-name">
                    {item.name}
                    <span className={`member-you ${item.writable ? "ready-pill" : ""}`}>
                      {planLabel(item.plan)} · {statusLabel(item)}
                    </span>
                  </div>
                  <div className="hint">
                    {item.ownerEmail || "No owner"}
                    {item.ownerName ? ` · ${item.ownerName}` : ""}
                    {` · ${usage(item.workspacesUsed, item.workspaceLimit)} workspaces`}
                    {` · ${usage(item.seatsUsed, item.seatLimit)} seats`}
                  </div>
                </div>
                <div className="hero-actions">
                  {item.plan !== "team" ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={Boolean(busyId)}
                      onClick={() => setPlan(item, "team")}
                    >
                      Team
                    </button>
                  ) : null}
                  {item.plan !== "enterprise" ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={Boolean(busyId)}
                      onClick={() => setPlan(item, "enterprise")}
                    >
                      Enterprise
                    </button>
                  ) : null}
                  {item.writable ? (
                    <button
                      type="button"
                      className="btn danger"
                      disabled={Boolean(busyId)}
                      onClick={() => setReady(item, false)}
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={Boolean(busyId)}
                      onClick={() => setReady(item, true)}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
