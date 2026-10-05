import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Api } from "../api";
import { canManageMembers, isBillingEnabled, isAuthEnabled, isSignedIn, isWorkspaceReady, clearSession } from "../session";
import Sidebar, { reloadSpecToast } from "../components/Sidebar";
import WorkspaceBar from "../components/WorkspaceBar";
import AddApiModal from "../components/AddApiModal";
import SidebarQuickAdd from "../components/SidebarQuickAdd";
import { useToast } from "../components/Toast";
import { operationRequestFromCurl } from "../curlImport";
import { resolveWriteConflict } from "../conflict";

function planStorageKey(specId) {
  return `testdata.plan.${specId}`;
}

export default function StudioLayout() {
  const { specId } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [spec, setSpec] = useState(null);
  const [operations, setOperations] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(() => sessionStorage.getItem(planStorageKey(specId)) || "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [cases, setCases] = useState([]);
  const [envEpoch, setEnvEpoch] = useState(0);
  const [runEnvironment, setRunEnvironment] = useState(null);
  const [environmentReady, setEnvironmentReady] = useState(false);
  const [environmentSpecId, setEnvironmentSpecId] = useState(specId);
  const [session, setSession] = useState(null);
  const [addApiOpen, setAddApiOpen] = useState(false);
  const specRevisionRef = useRef(null);

  useEffect(() => {
    specRevisionRef.current = spec?.updatedAt ?? null;
  }, [spec?.updatedAt]);

  const redirectIfMissingOperation = useCallback((nextOperations) => {
    const match = location.pathname.match(/\/op\/([^/]+)/);
    if (!match) {
      return;
    }
    const key = decodeURIComponent(match[1]);
    if (!(nextOperations || []).some((operation) => operation.key === key)) {
      navigate(`/s/${specId}/cases`, { replace: true });
    }
  }, [location.pathname, navigate, specId]);

  const syncSpecCatalogFromServer = useCallback(async (specHint, { notify = false } = {}) => {
    const [nextSpec, nextOperations] = await Promise.all([
      specHint ? Promise.resolve(specHint) : Api.getSpec(specId),
      Api.listOperations(specId)
    ]);
    setSpec(nextSpec);
    setOperations(nextOperations);
    specRevisionRef.current = nextSpec?.updatedAt ?? null;
    redirectIfMissingOperation(nextOperations);
    if (planId && environmentReady) {
      try {
        const nextCases = await Api.listCases(specId, undefined, planId, runEnvironment?.id);
        setCases(nextCases || []);
      } catch {
        setCases([]);
      }
    }
    if (notify) {
      toast("Spec was updated — refreshed operations");
    }
    return { spec: nextSpec, operations: nextOperations };
  }, [specId, planId, environmentReady, runEnvironment?.id, toast, redirectIfMissingOperation]);

  useEffect(() => {
    let cancelled = false;
    if (!specId || !spec?.updatedAt) {
      return undefined;
    }
    async function poll() {
      try {
        const remote = await Api.getSpec(specId);
        if (cancelled || !remote?.updatedAt) {
          return;
        }
        if (remote.updatedAt !== specRevisionRef.current) {
          await syncSpecCatalogFromServer(remote, { notify: true });
        }
      } catch {
        // Ignore transient poll errors.
      }
    }
    poll();
    const timer = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [specId, spec?.updatedAt, syncSpecCatalogFromServer]);

  useEffect(() => {
    let cancelled = false;
    Api.session()
      .then((next) => {
        if (cancelled) return;
        setSession(next);
        if (next?.saas && !next?.authenticated) {
          navigate("/login", { replace: true, state: { from: location.pathname } });
          return;
        }
        if (next?.saas && next?.authenticated && next.tenant?.ready === false) {
          navigate("/", { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    function onUnauthorized() {
      navigate("/login", { replace: true });
    }
    window.addEventListener("testdata:unauthorized", onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener("testdata:unauthorized", onUnauthorized);
    };
  }, [navigate, location.pathname]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSpec(null);
    Promise.all([
      Api.getSpec(specId),
      Api.listOperations(specId),
      Api.listPlans(specId)
    ])
      .then(([nextSpec, nextOperations, nextPlans]) => {
        if (cancelled) return;
        setSpec(nextSpec);
        setOperations(nextOperations);
        setPlans(nextPlans || []);
        const stored = sessionStorage.getItem(planStorageKey(specId));
        const selected = (nextPlans || []).some((plan) => plan.id === stored)
          ? stored
          : nextPlans?.[0]?.id || "";
        setPlanId(selected);
        if (selected) {
          sessionStorage.setItem(planStorageKey(specId), selected);
        }
        setSearch("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        toast(err.message, true);
      });
    return () => { cancelled = true; };
  }, [specId, toast]);

  useEffect(() => {
    if (!location.state?.addApi) {
      return;
    }
    if (spec?.manual) {
      setAddApiOpen(true);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, spec?.manual]);

  if (environmentSpecId !== specId) {
    setEnvironmentSpecId(specId);
    setRunEnvironment(null);
    setEnvironmentReady(false);
  }

  const handleEnvironmentChange = useCallback((environment) => {
    setRunEnvironment(environment);
    setEnvironmentReady(true);
  }, []);

  useEffect(() => {
    if (!specId || !planId || !environmentReady) {
      setCases([]);
      return;
    }
    let cancelled = false;
    Api.listCases(specId, undefined, planId, runEnvironment?.id)
      .then((next) => {
        if (!cancelled) setCases(next || []);
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      });
    return () => { cancelled = true; };
  }, [specId, planId, location.pathname, runEnvironment?.id, environmentReady]);

  function selectPlan(nextPlanId) {
    setPlanId(nextPlanId);
    sessionStorage.setItem(planStorageKey(specId), nextPlanId);
  }

  async function reloadPlans(preferredId) {
    const nextPlans = await Api.listPlans(specId);
    setPlans(nextPlans);
    const nextId = preferredId && nextPlans.some((plan) => plan.id === preferredId)
      ? preferredId
      : nextPlans[0]?.id || "";
    selectPlan(nextId);
    return nextPlans;
  }

  async function reloadCases() {
    if (!specId || !planId) return [];
    const next = await Api.listCases(specId, undefined, planId, runEnvironment?.id);
    setCases(next || []);
    return next || [];
  }

  async function reloadOperations() {
    const { operations: nextOperations } = await syncSpecCatalogFromServer(null);
    return nextOperations;
  }

  async function addManualOperation(payload) {
    const created = await Api.addOperation(specId, payload);
    await reloadOperations();
    return created;
  }

  async function deleteManualOperation(operationKey) {
    await Api.deleteOperation(specId, operationKey);
    await reloadOperations();
  }

  async function importCurlAsCase(parsed, match) {
    let operation = match?.operation;
    if (!operation) {
      operation = await addManualOperation(operationRequestFromCurl(parsed, spec));
    }
    if (!operation) {
      throw new Error(`No operation in this spec matches ${parsed.method} ${parsed.pathname}`);
    }
    navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}`, { state: { curlImport: parsed } });
    return operation;
  }

  async function saveManualOperation(payload) {
    const created = await addManualOperation(payload);
    setAddApiOpen(false);
    toast(`Added ${created.method} ${created.path}`);
    navigate(`/s/${specId}/op/${encodeURIComponent(created.key)}`);
    return created;
  }

  async function quickAddManualOperation(payload) {
    const created = await saveManualOperation(payload);
    return created;
  }

  async function handleSpecUpdated(updated) {
    await syncSpecCatalogFromServer(updated);
  }

  async function reloadSpec(file, { forceOverwrite = false } = {}) {
    const revision = specRevisionRef.current ?? spec?.updatedAt;
    const reloadPayload = {
      ...(spec?.baseUrl ? { baseUrl: spec.baseUrl } : {}),
      ...(revision && !forceOverwrite ? { expectedUpdatedAt: revision } : {}),
      ...(forceOverwrite ? { forceOverwrite: true } : {})
    };
    try {
      const result = file
        ? await Api.reloadSpecUpload(specId, file, spec?.baseUrl, reloadPayload)
        : await Api.reloadSpec(specId, reloadPayload);
      await syncSpecCatalogFromServer(null);
      toast(reloadSpecToast(result));
      return result;
    } catch (error) {
      const outcome = await resolveWriteConflict(error, {
        overwritePrompt: "Reload anyway and overwrite the server revision?",
        onReload: async (current) => {
          await syncSpecCatalogFromServer(current);
          toast("Loaded server copy");
        },
        onOverwrite: async () => {
          await reloadSpec(file, { forceOverwrite: true });
        }
      }).catch(() => null);
      if (outcome === "cancel" || outcome === "reload" || outcome === "overwrite") {
        return null;
      }
      throw error;
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

  const caseCounts = useMemo(() => {
    const counts = {};
    cases.forEach((item) => {
      counts[item.operationKey] = (counts[item.operationKey] || 0) + 1;
    });
    return counts;
  }, [cases]);

  if (error) {
    return <Navigate to="/" replace />;
  }

  const plan = plans.find((item) => item.id === planId) || plans[0];
  const ready = spec && planId;

  return (
    <div className="shell">
      {ready ? (
        <Sidebar
          spec={spec}
          operations={operations}
          caseCounts={caseCounts}
          search={search}
          onSearch={setSearch}
          quickAdd={spec?.manual ? (
            <SidebarQuickAdd onAdd={quickAddManualOperation} />
          ) : null}
        />
      ) : (
        <aside className="sidebar">
          <div className="brand">
            <h1>Test Data Studio</h1>
            <p>Loading spec…</p>
          </div>
        </aside>
      )}
      <div className="workspace">
        {ready ? (
          <WorkspaceBar
            spec={spec}
            plans={plans}
            planId={planId}
            onSelectPlan={selectPlan}
            onPlansChange={reloadPlans}
            onReloadSpec={reloadSpec}
            onAddApi={spec?.manual ? () => setAddApiOpen(true) : undefined}
            caseCount={cases.length}
            onSpecRenamed={handleSpecUpdated}
            envEpoch={envEpoch}
            onEnvironmentChange={handleEnvironmentChange}
            onEnvironmentsChanged={() => setEnvEpoch((current) => current + 1)}
            account={isSignedIn(session) ? session.account : null}
            canManage={isAuthEnabled(session) && isWorkspaceReady(session) && canManageMembers(session)}
            canManageSubscriptions={isSignedIn(session) && isBillingEnabled(session)}
            onSignOut={isSignedIn(session) ? signOut : null}
          />
        ) : null}
        <main className="main">
          {ready ? (
            <Outlet context={{
              spec,
              operations,
              allOperations: operations,
              plans,
              plan,
              planId,
              selectPlan,
              reloadPlans,
              reloadCases,
              reloadOperations,
              caseCounts,
              onAddApi: spec?.manual ? () => setAddApiOpen(true) : undefined,
              importCurlAsCase,
              deleteManualOperation,
              onSpecUpdated: handleSpecUpdated,
              onEnvironmentsChanged: () => setEnvEpoch((current) => current + 1),
              envEpoch,
              runEnvironment,
              environmentReady
            }} />
          ) : (
            <div className="empty">Loading spec…</div>
          )}
        </main>
      </div>
      {addApiOpen ? (
        <AddApiModal
          onClose={() => setAddApiOpen(false)}
          onSave={saveManualOperation}
        />
      ) : null}
    </div>
  );
}

export function FirstOperationRedirect() {
  const { specId } = useParams();
  return <Navigate to={`/s/${specId}/cases`} replace />;
}
