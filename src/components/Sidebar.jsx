import { useRef, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "./Toast";
import { generatePlansToast } from "../pages/CasesPage";

export default function Sidebar({
  spec,
  operations,
  search,
  onSearch,
  config,
  plans,
  planId,
  onSelectPlan,
  onPlansChange,
  onReloadSpec
}) {
  const { specId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [includeNegativePlan, setIncludeNegativePlan] = useState(true);
  const [reloading, setReloading] = useState(false);
  const grouped = groupOperations(
    operations.filter((operation) => matchesSearch(operation, search))
  );

  async function addPlan() {
    const name = newPlanName.trim();
    if (!name) {
      toast("Enter a plan name", true);
      return;
    }
    try {
      const created = await Api.createPlan(specId, { name });
      setNewPlanName("");
      await onPlansChange(created.id);
      toast(`Created plan ${created.name}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function removePlan() {
    if (plans.length <= 1) {
      toast("Keep at least one plan", true);
      return;
    }
    const current = plans.find((plan) => plan.id === planId);
    if (!window.confirm(`Delete plan "${current?.name || planId}" and its test cases?`)) {
      return;
    }
    try {
      await Api.deletePlan(specId, planId);
      await onPlansChange();
      toast("Plan deleted");
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function generatePlans() {
    try {
      const result = await Api.generatePlans({
        specId,
        includeNegative: includeNegativePlan
      });
      await onPlansChange(result.smokePlan.id);
      toast(generatePlansToast(result));
      navigate(`/s/${specId}/cases`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function reloadSpec(file) {
    if (!window.confirm(RELOAD_SPEC_CONFIRM)) {
      return;
    }
    setReloading(true);
    try {
      await onReloadSpec(file);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setReloading(false);
    }
  }

  function chooseReloadSource() {
    if (spec?.sourceLocation) {
      reloadSpec();
      return;
    }
    fileRef.current?.click();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>Test Data Studio</h1>
        <p>Schema-driven test cases</p>
      </div>
      <div className="spec-meta">
        <div className="title">{spec.title}</div>
        <div className="sub">
          {spec.operationCount} operations · {spec.baseUrl}
        </div>
        {config?.storageType ? (
          <div className="sub">API storage: {config.storageType}</div>
        ) : null}
        <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={chooseReloadSource} disabled={reloading}>
          {reloading ? "Reloading…" : "Reload spec"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.yaml,.yml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) reloadSpec(file);
          }}
        />
      </div>
      <div className="plan-picker">
        <label htmlFor="plan-select">Test plan</label>
        <select id="plan-select" value={planId} onChange={(event) => onSelectPlan(event.target.value)}>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
        <div className="plan-add">
          <input
            value={newPlanName}
            placeholder="New plan name"
            onChange={(event) => setNewPlanName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addPlan();
            }}
          />
          <button type="button" className="btn ghost" onClick={addPlan}>Add</button>
        </div>
        <button type="button" className="btn ghost" onClick={removePlan} disabled={plans.length <= 1}>
          Delete plan
        </button>
        <div className="plan-generate">
          <button type="button" className="btn primary" onClick={generatePlans}>
            Generate Smoke plan
          </button>
          <label className="plan-check">
            <input
              type="checkbox"
              checked={includeNegativePlan}
              onChange={(event) => setIncludeNegativePlan(event.target.checked)}
            />
            Also Negative plan
          </label>
        </div>
      </div>
      <div className="side-search">
        <input
          type="search"
          placeholder="Filter operations"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <nav className="nav">
        <NavLink to={`/s/${specId}/cases`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Saved test cases
        </NavLink>
        <NavLink to={`/s/${specId}/export`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Export Excel
        </NavLink>
        {Object.entries(grouped).map(([tag, ops]) => (
          <div key={tag}>
            <div className="tag-label">{tag}</div>
            {ops.map((operation) => (
              <NavLink
                key={operation.key}
                to={`/s/${specId}/op/${encodeURIComponent(operation.key)}`}
                className={({ isActive }) => `op-item ${isActive ? "active" : ""}`}
              >
                <span className={`method ${operation.method}`}>{operation.method}</span>
                <span className="op-copy">
                  <div className="name">{operation.summary || operation.key}</div>
                  <div className="path">{operation.path}</div>
                </span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding: 16 }}>
        <NavLink to="/" className="btn ghost">Load another spec</NavLink>
      </div>
    </aside>
  );
}

function groupOperations(operations) {
  return operations.reduce((groups, operation) => {
    const tag = operation.tag || "generated";
    groups[tag] = groups[tag] || [];
    groups[tag].push(operation);
    return groups;
  }, {});
}

function matchesSearch(operation, search) {
  if (!search) return true;
  const haystack = `${operation.method} ${operation.path} ${operation.summary} ${operation.tag} ${operation.key}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export function reloadSpecToast(result) {
  const added = result?.addedOperations?.length ?? 0;
  const removed = result?.removedOperations?.length ?? 0;
  const orphaned = result?.orphanedCaseCount ?? 0;
  let message = `Spec reloaded (${result?.spec?.operationCount ?? 0} operations)`;
  if (added) {
    message += `. +${added} new`;
  }
  if (removed) {
    message += `. ${removed} removed`;
  }
  if (orphaned) {
    message += `. ${orphaned} saved cases still point at removed operations`;
  }
  return message;
}

export const RELOAD_SPEC_CONFIRM =
  "Reload the OpenAPI document in place?\n\nPlans and saved cases are kept. Operation forms pick up the new schema. Cases for operations that disappear stay in the plan but cannot be opened until you delete them or restore that operation.";

