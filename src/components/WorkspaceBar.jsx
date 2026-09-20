import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "./Toast";
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
  onEnvironmentsChanged
}) {
  const { specId } = useParams();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [reloading, setReloading] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [environmentId, setEnvironmentId] = useState("");
  const [envDraft, setEnvDraft] = useState(false);
  const [envManageOpen, setEnvManageOpen] = useState(false);
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
        setEnvDraft(false);
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
      setEnvDraft(true);
      setEnvManageOpen(true);
      setEnvForm({
        name: "",
        baseUrl: "",
        authType: "NONE"
      });
      notifyEnvironment(null);
      return null;
    }
    const nextId = preferredId && (list || []).some((environment) => environment.id === preferredId)
      ? preferredId
      : (list || [])[0]?.id || "";
    setEnvironmentId(nextId);
    setEnvDraft(false);
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

  function onEnvironmentMenu(nextId) {
    if (nextId === "__new__") {
      startNewEnvironment();
      return;
    }
    if (!nextId) {
      return;
    }
    if (envDraft) {
      setEnvDraft(false);
      setEnvForm(envFormFrom(environments, nextId, spec));
    }
    applyEnvironment(nextId);
  }

  function startNewEnvironment() {
    setEnvDraft(true);
    setEnvManageOpen(true);
    setEnvForm({
      name: "",
      baseUrl: "",
      authType: "NONE"
    });
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
      if (envDraft || !environmentId) {
        const created = await Api.createEnvironment(specId, {
          name,
          baseUrl,
          authType: envForm.authType
        });
        await refreshEnvironments(created.id, true);
        onEnvironmentsChanged?.();
        toast(`Created environment ${created.name}`);
      } else {
        const updated = await Api.updateEnvironment(specId, environmentId, {
          name,
          baseUrl,
          authType: envForm.authType
        });
        await refreshEnvironments(updated.id, environmentId === sessionStorage.getItem(`testdata.env.${specId}`));
        onEnvironmentsChanged?.();
        toast(`Saved environment ${updated.name}`);
      }
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSavingEnv(false);
    }
  }

  async function removeEnvironment() {
    if (!environmentId || envDraft) {
      setEnvDraft(false);
      setEnvForm(envFormFrom(environments, environmentId, spec));
      return;
    }
    const current = selectedEnvironment();
    if (!window.confirm(`Delete environment "${current?.name || environmentId}"?\n\nCases that exist only in this environment will be deleted.`)) {
      return;
    }
    try {
      await Api.deleteEnvironment(specId, environmentId);
      sessionStorage.removeItem(`testdata.env.${specId}`);
      await refreshEnvironments(null, false);
      onEnvironmentsChanged?.();
      toast("Environment deleted");
    } catch (error) {
      toast(error.message, true);
    }
  }

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
            <select
              id="environment-select"
              value={envDraft ? "__new__" : environmentId || environments[0]?.id || "__new__"}
              onChange={(event) => onEnvironmentMenu(event.target.value)}
            >
              {environments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
              <option value="__new__">New environment…</option>
            </select>
          </div>
        )}
        <details
          className="plan-manage"
          open={envManageOpen}
          onToggle={(event) => setEnvManageOpen(event.currentTarget.open)}
        >
          <summary>Manage environment</summary>
          <div className="env-manage">
            <p className="hint">
              {envDraft
                ? "Enter a name and base URL, then Save. Cases you add after switching to it belong to that environment."
                : `Editing ${selectedEnvironment()?.name || "environment"}. Cases you save while it is selected belong to it.`}
            </p>
            <div className="field">
              <label htmlFor="workspace-env-name">Name</label>
              <input
                id="workspace-env-name"
                value={envForm.name}
                placeholder="local, int, prod"
                onChange={(event) => setEnvForm({ ...envForm, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveEnvironment();
                  }
                  if (event.key === "Escape" && envDraft) {
                    removeEnvironment();
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="workspace-env-base-url">Base URL</label>
              <input
                id="workspace-env-base-url"
                value={envForm.baseUrl}
                placeholder="https://int.example.com/employee-service"
                onChange={(event) => setEnvForm({ ...envForm, baseUrl: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveEnvironment();
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="workspace-env-auth">Auth type</label>
              <select
                id="workspace-env-auth"
                value={envForm.authType}
                onChange={(event) => setEnvForm({ ...envForm, authType: event.target.value })}
              >
                <option value="NONE">None</option>
                <option value="BEARER">Bearer token</option>
                <option value="BASIC">Basic</option>
                <option value="API_KEY">API key</option>
                <option value="OAUTH2">OAuth2</option>
              </select>
            </div>
            <div className="env-manage-actions">
              <button type="button" className="btn primary" onClick={saveEnvironment} disabled={savingEnv}>
                {savingEnv ? "Saving…" : envDraft ? "Save new" : "Save"}
              </button>
              {envDraft ? (
                <button type="button" className="linkish" onClick={removeEnvironment}>
                  Cancel
                </button>
              ) : environmentId ? (
                <button type="button" className="linkish" onClick={removeEnvironment}>
                  Delete {selectedEnvironment()?.name || "environment"}
                </button>
              ) : null}
            </div>
          </div>
        </details>
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
          <select id="plan-select" value={planId} onChange={(event) => onSelectPlan(event.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
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
        <details className="plan-manage">
          <summary>Manage plan</summary>
          <div className="plan-add">
            <input
              value={newPlanName}
              placeholder="New plan name"
              onChange={(event) => setNewPlanName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addPlan();
              }}
            />
            <button type="button" className="btn" onClick={addPlan}>Add</button>
          </div>
          <button type="button" className="btn" onClick={removePlan} disabled={plans.length <= 1}>
            Delete plan
          </button>
        </details>
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
