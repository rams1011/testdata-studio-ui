import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import Sidebar, { reloadSpecToast } from "../components/Sidebar";
import { useToast } from "../components/Toast";

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
  const [config, setConfig] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
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
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        toast(err.message, true);
      });
    return () => { cancelled = true; };
  }, [specId, toast]);

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

  if (error) {
    return <Navigate to="/" replace />;
  }
  if (!spec || !planId) {
    return <div className="hero"><p>Loading spec…</p></div>;
  }

  const plan = plans.find((item) => item.id === planId) || plans[0];

  return (
    <div className="shell">
      <Sidebar
        spec={spec}
        operations={operations}
        search={search}
        onSearch={setSearch}
        config={config}
        plans={plans}
        planId={planId}
        onSelectPlan={selectPlan}
        onPlansChange={reloadPlans}
        onReloadSpec={reloadSpec}
      />
      <main className="main">
        <Outlet context={{ spec, operations, config, plans, plan, planId, selectPlan, reloadPlans }} />
      </main>
    </div>
  );
}

export function FirstOperationRedirect() {
  const { specId } = useParams();
  const { operations } = useOutletContext();
  if (!operations.length) {
    return <div className="empty">No operations found in this spec.</div>;
  }
  return <Navigate to={`/s/${specId}/op/${encodeURIComponent(operations[0].key)}`} replace />;
}
