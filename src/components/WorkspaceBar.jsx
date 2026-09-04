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
  onSpecRenamed
}) {
  const { specId } = useParams();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [reloading, setReloading] = useState(false);
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
              {spec.operationCount} operations
            </span>
            <span>Base URL · {spec.baseUrl || "not set"}</span>
            <button type="button" className="linkish" onClick={() => setEditingBaseUrl(true)}>
              Change
            </button>
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
          <select id="plan-select" value={planId} onChange={(event) => onSelectPlan(event.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
          <button type="button" className="btn" onClick={chooseReloadSource} disabled={reloading}>
            {reloading ? "Updating…" : "Update spec"}
          </button>
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
