import { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import Sidebar, { reloadSpecToast } from "../components/Sidebar";
import WorkspaceBar from "../components/WorkspaceBar";
import { useToast } from "../components/Toast";

function planStorageKey(specId) {
  return `testdata.plan.${specId}`;
}

export function lastOpKey(specId) {
  return `testdata.op.${specId}`;
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
  const [config, setConfig] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [cases, setCases] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSpec(null);
    Promise.all([
      Api.getSpec(specId),
      Api.listOperations(specId),
      Api.listPlans(specId),
      Api.config().catch(() => null)
    ])
      .then(([nextSpec, nextOperations, nextPlans, nextConfig]) => {
        if (cancelled) return;
        setSpec(nextSpec);
        setOperations(nextOperations);
        setPlans(nextPlans || []);
        setConfig(nextConfig);
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
    if (!specId || !planId) {
      setCases([]);
      return;
    }
    let cancelled = false;
    Api.listCases(specId, undefined, planId)
      .then((next) => {
        if (!cancelled) setCases(next || []);
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      });
    return () => { cancelled = true; };
  }, [specId, planId, location.pathname]);

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
    const next = await Api.listCases(specId, undefined, planId);
    setCases(next || []);
    return next || [];
  }

  async function reloadSpec(file) {
    const result = file
      ? await Api.reloadSpecUpload(specId, file, spec?.baseUrl)
      : await Api.reloadSpec(specId, spec?.baseUrl ? { baseUrl: spec.baseUrl } : {});
    const [nextSpec, nextOperations] = await Promise.all([
      Api.getSpec(specId),
      Api.listOperations(specId)
    ]);
    setSpec(nextSpec);
    setOperations(nextOperations);
    const match = location.pathname.match(/\/op\/([^/]+)/);
    if (match) {
      const key = decodeURIComponent(match[1]);
      if (!nextOperations.some((operation) => operation.key === key)) {
        navigate(`/s/${specId}/cases`, { replace: true });
      }
    }
    toast(reloadSpecToast(result));
    return result;
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
          operations={operations}
          caseCounts={caseCounts}
          search={search}
          onSearch={setSearch}
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
            onSpecRenamed={setSpec}
          />
        ) : null}
        <main className="main">
          {ready ? (
            <Outlet context={{
              spec,
              operations,
              config,
              plans,
              plan,
              planId,
              selectPlan,
              reloadPlans,
              reloadCases,
              caseCounts
            }} />
          ) : (
            <div className="empty">Loading spec…</div>
          )}
        </main>
      </div>
    </div>
  );
}

export function FirstOperationRedirect() {
  const { specId } = useParams();
  const { operations } = useOutletContext();
  const last = sessionStorage.getItem(lastOpKey(specId));
  if (last && (operations || []).some((operation) => operation.key === last)) {
    return <Navigate to={`/s/${specId}/op/${encodeURIComponent(last)}`} replace />;
  }
  return <Navigate to={`/s/${specId}/cases`} replace />;
}
