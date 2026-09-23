import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "./Toast";
import AccountMenu from "./AccountMenu";
import EnvironmentModal from "./EnvironmentModal";
import EnvironmentPicker from "./EnvironmentPicker";
import ItemPicker from "./ItemPicker";
import PlanModal from "./PlanModal";
import LabelField, { specLabel, uniqueLabels } from "./LabelField";
import { RELOAD_SPEC_CONFIRM } from "./Sidebar";

export default function WorkspaceBar({
  spec,
  plans,
  planId,
  onSelectPlan,
  onPlansChange,
  onReloadSpec,
  onAddApi,
  onSpecRenamed,
  envEpoch,
  onEnvironmentChange,
  onEnvironmentsChanged,
  account,
  canManage = false,
  canManageSubscriptions = false,
  onSignOut
}) {
  const { specId } = useParams();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [planModal, setPlanModal] = useState(null);
  const [planEditingId, setPlanEditingId] = useState("");
  const [planFormName, setPlanFormName] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [environmentId, setEnvironmentId] = useState("");
  const [envModal, setEnvModal] = useState(null);
  const [envEditingId, setEnvEditingId] = useState("");
  const [envForm, setEnvForm] = useState({ name: "local", baseUrl: "", authType: "NONE" });
  const [savingEnv, setSavingEnv] = useState(false);
  const needsRename = spec.name && spec.title && spec.name === spec.title;
  const [renaming, setRenaming] = useState(false);
  const [renameFocus, setRenameFocus] = useState(false);
  const [specName, setSpecName] = useState(spec.name || "");
  const [specLabelValue, setSpecLabelValue] = useState(specLabel(spec));
  const [labelCatalog, setLabelCatalog] = useState([]);
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [specBaseUrl, setSpecBaseUrl] = useState(spec.baseUrl || "");

  useEffect(() => {
    setSpecName(spec.name || "");
    setSpecLabelValue(specLabel(spec));
    setSpecBaseUrl(spec.baseUrl || "");
    setRenaming(false);
    setRenameFocus(false);
    setEditingLabel(false);
    setEditingBaseUrl(false);
  }, [spec.specId, spec.name, spec.title, spec.label, spec.baseUrl]);

  useEffect(() => {
    let cancelled = false;
    Api.listSpecs()
      .then((specs) => {
        if (!cancelled) {
          setLabelCatalog(uniqueLabels(specs));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLabelCatalog([]);
        }
      });
    return () => { cancelled = true; };
  }, [spec.specId]);

  useEffect(() => {
    let cancelled = false;
    Api.listEnvironments(specId)
      .then((next) => {
        if (cancelled) return;
        const list = next || [];
        setEnvironments(list);
        const stored = sessionStorage.getItem(`testdata.env.${specId}`);
        const selected = list.some((environment) => environment.id === stored)
          ? stored
          : list.find((environment) => environment.baseUrl && environment.baseUrl === spec.baseUrl)?.id
            || list[0]?.id
            || "";
        setEnvironmentId(selected);
        setEnvForm(envFormFrom(list, selected, spec));
        if (selected) {
          sessionStorage.setItem(`testdata.env.${specId}`, selected);
        }
        notifyEnvironment(list.find((environment) => environment.id === selected) || null);
      })
      .catch(() => {
        if (!cancelled) {
          setEnvironments([]);
          setEnvironmentId("");
          notifyEnvironment(null);
        }
      });
    return () => { cancelled = true; };
  }, [spec.specId, spec.baseUrl, specId, envEpoch]);

  async function saveSpecName() {
    const nextName = specName.trim();
    if (!nextName) {
      toast("Spec name is required", true);
      return;
    }
    try {
      const updated = await Api.renameSpec(specId, { name: nextName });
      onSpecRenamed?.(updated);
      setRenaming(false);
      toast("Name saved");
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function saveSpecLabel() {
    try {
      const updated = await Api.renameSpec(specId, {
        name: spec.name || specName,
        label: specLabelValue
      });
      onSpecRenamed?.(updated);
      setSpecLabelValue(specLabel(updated));
      setLabelCatalog((current) => uniqueLabels([...current.map((item) => ({ label: item })), updated]));
      setEditingLabel(false);
      toast("Label saved");
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function saveSpecBaseUrl() {
    try {
      const updated = await Api.renameSpec(specId, {
        name: spec.name || specName,
        baseUrl: specBaseUrl.trim()
      });
      onSpecRenamed?.(updated);
      setSpecBaseUrl(updated.baseUrl || "");
      setEditingBaseUrl(false);
      toast("Base URL saved");
    } catch (error) {
      toast(error.message, true);
    }
  }

  function selectedEnvironment() {
    return environments.find((environment) => environment.id === environmentId);
  }

  function notifyEnvironment(environment) {
    if (!onEnvironmentChange) {
      return;
    }
    if (!environment) {
      onEnvironmentChange(null);
      return;
    }
    onEnvironmentChange({
      id: environment.id,
      name: environment.name,
      authType: environment.authType || "NONE"
    });
  }

  async function refreshEnvironments(preferredId, applySelected = false) {
    const list = await Api.listEnvironments(specId);
    setEnvironments(list || []);
    if (!(list || []).length) {
      sessionStorage.removeItem(`testdata.env.${specId}`);
      setEnvironmentId("");
      notifyEnvironment(null);
      return null;
    }
    const nextId = preferredId && (list || []).some((environment) => environment.id === preferredId)
      ? preferredId
      : (list || [])[0]?.id || "";
    setEnvironmentId(nextId);
    setEnvForm(envFormFrom(list || [], nextId, spec));
    if (nextId) {
      sessionStorage.setItem(`testdata.env.${specId}`, nextId);
    } else {
      sessionStorage.removeItem(`testdata.env.${specId}`);
    }
    const current = (list || []).find((environment) => environment.id === nextId) || null;
    notifyEnvironment(current);
    if (applySelected && nextId) {
      const applied = await Api.applyEnvironment(specId, nextId);
      const updated = await Api.getSpec(specId);
      onSpecRenamed?.(updated);
      return applied;
    }
    return current;
  }

  async function applyEnvironment(nextId) {
    if (!nextId) {
      setEnvironmentId("");
      sessionStorage.removeItem(`testdata.env.${specId}`);
      notifyEnvironment(null);
      return;
    }
    try {
      const applied = await Api.applyEnvironment(specId, nextId);
      sessionStorage.setItem(`testdata.env.${specId}`, nextId);
      setEnvironmentId(nextId);
      const updated = await Api.getSpec(specId);
      onSpecRenamed?.(updated);
      toast(`Using environment ${applied.name}`);
      setEnvForm(envFormFrom(environments, nextId, spec));
      notifyEnvironment(environments.find((environment) => environment.id === nextId) || {
        id: nextId,
        name: applied.name,
        authType: "NONE"
      });
    } catch (error) {
      toast(error.message, true);
    }
  }

  function openEnvironmentModal(mode, environment) {
    if (mode === "edit") {
      if (!environment?.id) {
        return;
      }
      setEnvEditingId(environment.id);
      setEnvForm({
        name: environment.name || "",
        baseUrl: environment.baseUrl || "",
        authType: environment.authType || "NONE"
      });
    } else {
      setEnvEditingId("");
      setEnvForm({
        name: "",
        baseUrl: spec?.baseUrl || "",
        authType: "NONE"
      });
    }
    setEnvModal(mode);
  }

  async function saveEnvironment() {
    const name = envForm.name.trim();
    const baseUrl = envForm.baseUrl.trim();
    if (!name) {
      toast("Enter an environment name", true);
      return;
    }
    if (!baseUrl) {
      toast("Enter a base URL", true);
      return;
    }
    setSavingEnv(true);
    try {
      if (envModal === "create" || !envEditingId) {
        const created = await Api.createEnvironment(specId, {
          name,
          baseUrl,
          authType: envForm.authType
        });
        await refreshEnvironments(created.id, true);
        onEnvironmentsChanged?.();
        setEnvModal(null);
        toast(`Created environment ${created.name}`);
      } else {
        const updated = await Api.updateEnvironment(specId, envEditingId, {
          name,
          baseUrl,
          authType: envForm.authType
        });
        await refreshEnvironments(updated.id, envEditingId === sessionStorage.getItem(`testdata.env.${specId}`));
        onEnvironmentsChanged?.();
        setEnvModal(null);
        toast(`Saved environment ${updated.name}`);
      }
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSavingEnv(false);
    }
  }

  async function duplicateCurrentEnvironment() {
    const targetId = envEditingId || environmentId;
    if (!targetId) {
      return;
    }
    setSavingEnv(true);
    try {
      const created = await Api.duplicateEnvironment(specId, targetId);
      await refreshEnvironments(created.id, true);
      onEnvironmentsChanged?.();
      setEnvModal(null);
      toast(`Duplicated environment to ${created.name} with its cases`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSavingEnv(false);
    }
  }

  async function removeEnvironment(environment) {
    const target = environment || selectedEnvironment();
    if (!target?.id) {
      return;
    }
    if (!window.confirm(`Delete environment "${target.name || target.id}"?\n\nCases that exist only in this environment will be deleted.`)) {
      return;
    }
    try {
      await Api.deleteEnvironment(specId, target.id);
      if (target.id === environmentId) {
        sessionStorage.removeItem(`testdata.env.${specId}`);
      }
      const remaining = await refreshEnvironments(
        target.id === environmentId ? null : environmentId,
        false
      );
      onEnvironmentsChanged?.();
      toast("Environment deleted");
      if (!remaining) {
        openEnvironmentModal("create");
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  function openPlanModal(mode, plan) {
    if (mode === "edit") {
      if (!plan?.id) {
        return;
      }
      setPlanEditingId(plan.id);
      setPlanFormName(plan.name || "");
    } else {
      setPlanEditingId("");
      setPlanFormName("");
    }
    setPlanModal(mode);
  }

  async function savePlan() {
    const name = planFormName.trim();
    if (!name) {
      toast("Enter a plan name", true);
      return;
    }
    setSavingPlan(true);
    try {
      if (planModal === "create" || !planEditingId) {
        const created = await Api.createPlan(specId, { name });
        await onPlansChange(created.id);
        setPlanModal(null);
        toast(`Created plan ${created.name}`);
      } else {
        const updated = await Api.updatePlan(specId, planEditingId, { name });
        await onPlansChange(updated.id === planId ? updated.id : planId);
        setPlanModal(null);
        toast(`Saved plan ${updated.name}`);
      }
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSavingPlan(false);
    }
  }

  async function removePlan(plan) {
    if (plans.length <= 1) {
      toast("Keep at least one plan", true);
      return;
    }
    const target = plan || plans.find((item) => item.id === planId);
    if (!target?.id) {
      return;
    }
    if (!window.confirm(`Delete plan "${target.name || target.id}" and its test cases?`)) {
      return;
    }
    try {
      await Api.deletePlan(specId, target.id);
      await onPlansChange(target.id === planId ? undefined : planId);
      toast("Plan deleted");
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
    <header className="workspace-bar">
      <div className="workspace-spec">
        <Link to="/" className="workspace-home">All specs</Link>
        {renaming ? (
          <div className="plan-add">
            <input
              value={specName}
              autoFocus={renameFocus}
              placeholder="Unique spec name"
              onChange={(event) => setSpecName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveSpecName();
                if (event.key === "Escape") setRenaming(false);
              }}
            />
            <button type="button" className="btn" onClick={saveSpecName}>Save</button>
            <button type="button" className="btn" onClick={() => setRenaming(false)}>Cancel</button>
          </div>
        ) : (
          <div className="spec-title-row">
            <div className="workspace-spec-name">{spec.name || spec.title}</div>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setRenameFocus(true);
                setRenaming(true);
              }}
            >
              Rename
            </button>
          </div>
        )}
        {needsRename ? (
          <div className="hint">Give this spec a unique name so you can tell it apart from the OpenAPI title.</div>
        ) : spec.title && spec.title !== spec.name ? (
          <div className="hint">{spec.title}</div>
        ) : null}
        {editingLabel ? (
          <div className="spec-label-edit">
            <LabelField
              id="workspace-spec-label"
              value={specLabelValue}
              onChange={setSpecLabelValue}
              suggestions={labelCatalog}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveSpecLabel();
                }
                if (event.key === "Escape") {
                  setSpecLabelValue(specLabel(spec));
                  setEditingLabel(false);
                }
              }}
            />
            <div className="plan-add">
              <button type="button" className="btn" onClick={saveSpecLabel}>Save label</button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSpecLabelValue(specLabel(spec));
                  setEditingLabel(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="workspace-spec-meta">
            <span>Label · {specLabel(spec)}</span>
            <button type="button" className="linkish" onClick={() => setEditingLabel(true)}>
              Change
            </button>
            <span>
              {spec.manual
                ? `REST · ${spec.operationCount || 0} API${spec.operationCount === 1 ? "" : "s"}`
                : `${spec.operationCount} operations`}
            </span>
            <span>Base URL · {spec.baseUrl || "not set"}</span>
            <button type="button" className="linkish" onClick={() => setEditingBaseUrl(true)}>
              Change
            </button>
            <label htmlFor="environment-select">Environment</label>
            <EnvironmentPicker
              environments={environments}
              selectedId={environmentId}
              onSelect={applyEnvironment}
              onEdit={(environment) => openEnvironmentModal("edit", environment)}
              onDelete={removeEnvironment}
              onCreate={() => openEnvironmentModal("create")}
            />
          </div>
        )}
        {editingBaseUrl ? (
          <div className="spec-label-edit">
            <div className="field">
              <label htmlFor="workspace-spec-base-url">API base URL</label>
              <input
                id="workspace-spec-base-url"
                value={specBaseUrl}
                autoFocus
                placeholder="e.g. http://localhost:8080"
                onChange={(event) => setSpecBaseUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveSpecBaseUrl();
                  }
                  if (event.key === "Escape") {
                    setSpecBaseUrl(spec.baseUrl || "");
                    setEditingBaseUrl(false);
                  }
                }}
              />
              <div className="hint">
                Saved cases that still use the previous spec URL are updated. Cases with a custom URL are left as-is.
                Leave blank to use the OpenAPI servers URL.
              </div>
            </div>
            <div className="plan-add">
              <button type="button" className="btn" onClick={saveSpecBaseUrl}>Save base URL</button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSpecBaseUrl(spec.baseUrl || "");
                  setEditingBaseUrl(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="workspace-plan">
        <label htmlFor="plan-select">Test plan</label>
        <div className="workspace-plan-row">
          <ItemPicker
            items={plans}
            selectedId={planId}
            triggerId="plan-select"
            ariaLabel="Test plans"
            emptyTrigger="No plan"
            emptyList="No plans yet"
            newLabel="New plan…"
            onSelect={onSelectPlan}
            onEdit={(plan) => openPlanModal("edit", plan)}
            onDelete={removePlan}
            onCreate={() => openPlanModal("create")}
          />
          {onAddApi ? (
            <button type="button" className="btn" onClick={onAddApi}>
              Add API
            </button>
          ) : (
            <button type="button" className="btn" onClick={chooseReloadSource} disabled={reloading}>
              {reloading ? "Updating…" : "Update spec"}
            </button>
          )}
        </div>
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
      <AccountMenu
        account={account}
        canManage={canManage}
        canManageSubscriptions={canManageSubscriptions}
        onSignOut={onSignOut}
      />
      {planModal ? (
        <PlanModal
          mode={planModal}
          name={planFormName}
          onChange={setPlanFormName}
          saving={savingPlan}
          onSave={savePlan}
          onClose={() => {
            setPlanModal(null);
            setPlanEditingId("");
          }}
        />
      ) : null}
      {envModal ? (
        <EnvironmentModal
          mode={envModal}
          form={envForm}
          onChange={setEnvForm}
          saving={savingEnv}
          onSave={saveEnvironment}
          onClose={() => {
            setEnvModal(null);
            setEnvEditingId("");
          }}
          onDuplicate={envModal === "edit" ? duplicateCurrentEnvironment : undefined}
        />
      ) : null}
    </header>
  );
}

function envFormFrom(list, selectedId, spec) {
  const current = (list || []).find((environment) => environment.id === selectedId);
  if (current) {
    return {
      name: current.name || "",
      baseUrl: current.baseUrl || "",
      authType: current.authType || "NONE"
    };
  }
  return {
    name: "local",
    baseUrl: spec?.baseUrl || "",
    authType: "NONE"
  };
}
