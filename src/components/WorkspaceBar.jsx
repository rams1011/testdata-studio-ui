import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "./Toast";
import AccountMenu from "./AccountMenu";
import AddSpecModal from "./AddSpecModal";
import SpecMoreMenu from "./SpecMoreMenu";
import SpecSwitcherModal from "./SpecSwitcherModal";
import SearchIcon from "./SearchIcon";
import GuideLink from "./GuideLink";
import { touchRecentSpec } from "../specCatalog";

const SWITCH_SPEC_TIP = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
  ? "Switch spec (⌘K)"
  : "Switch spec (Ctrl+K)";
import EnvironmentModal from "./EnvironmentModal";
import EnvironmentPicker from "./EnvironmentPicker";
import ItemPicker from "./ItemPicker";
import PlanModal from "./PlanModal";
import SpecSettingsModal, { specSettingsForm } from "./SpecSettingsModal";
import { uniqueLabels } from "./LabelField";
import { RELOAD_SPEC_CONFIRM } from "./Sidebar";

export default function WorkspaceBar({
  spec,
  plans,
  planId,
  onSelectPlan,
  onPlansChange,
  onReloadSpec,
  onAddApi,
  caseCount = 0,
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [catalogSpecs, setCatalogSpecs] = useState([]);
  const [addSpecOpen, setAddSpecOpen] = useState(false);
  const [addSpecSource, setAddSpecSource] = useState("url");
  const [specSwitcherOpen, setSpecSwitcherOpen] = useState(false);
  const [planModal, setPlanModal] = useState(null);
  const [planEditingId, setPlanEditingId] = useState("");
  const [planFormName, setPlanFormName] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [environmentId, setEnvironmentId] = useState("");
  const [envModal, setEnvModal] = useState(null);
  const [envEditingId, setEnvEditingId] = useState("");
  const [envForm, setEnvForm] = useState({ name: "Default", baseUrl: "", authType: "NONE" });
  const [savingEnv, setSavingEnv] = useState(false);
  const [specSettingsOpen, setSpecSettingsOpen] = useState(false);
  const [specForm, setSpecForm] = useState(() => specSettingsForm(spec));
  const [savingSpec, setSavingSpec] = useState(false);
  const [labelCatalog, setLabelCatalog] = useState([]);

  useEffect(() => {
    setSpecForm(specSettingsForm(spec));
    setSpecSettingsOpen(false);
  }, [spec.specId]);

  useEffect(() => {
    let cancelled = false;
    Api.listSpecs()
      .then((next) => {
        if (!cancelled) setCatalogSpecs(next || []);
      })
      .catch(() => {
        if (!cancelled) setCatalogSpecs([]);
      });
    return () => { cancelled = true; };
  }, [spec.specId, spec.name, spec.title]);

  useEffect(() => {
    touchRecentSpec(specId);
  }, [specId]);

  useEffect(() => {
    function onKey(event) {
      const tag = event.target?.tagName?.toLowerCase();
      const editing = tag === "input" || tag === "textarea" || tag === "select" || event.target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !editing) {
        event.preventDefault();
        setSpecSwitcherOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

  function openSpecSettings() {
    setSpecForm(specSettingsForm(spec));
    setSpecSettingsOpen(true);
  }

  async function saveSpecSettings() {
    const nextName = specForm.name.trim();
    if (!nextName) {
      toast("Spec name is required", true);
      return;
    }
    setSavingSpec(true);
    try {
      const updated = await Api.renameSpec(specId, {
        name: nextName,
        label: specForm.label,
        baseUrl: specForm.baseUrl.trim()
      });
      onSpecRenamed?.(updated);
      setSpecForm(specSettingsForm(updated));
      setLabelCatalog((current) => uniqueLabels([...current.map((item) => ({ label: item })), updated]));
      setSpecSettingsOpen(false);
      toast("Spec saved");
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSavingSpec(false);
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

  function openAddSpec(source = "url") {
    setAddSpecSource(source);
    setAddSpecOpen(true);
  }

  function selectSpec(nextSpecId) {
    if (!nextSpecId || nextSpecId === specId) {
      return;
    }
    touchRecentSpec(nextSpecId);
    navigate(`/s/${nextSpecId}/cases`);
  }

  function onSpecCreated(created, meta) {
    touchRecentSpec(created.specId);
    setCatalogSpecs((current) => {
      const without = current.filter((item) => item.specId !== created.specId);
      return [...without, created];
    });
    Api.listSpecs()
      .then((next) => setCatalogSpecs(next || []))
      .catch(() => {});
    if (meta?.source === "rest") {
      navigate(`/s/${created.specId}/cases`, { state: { addApi: true } });
    } else {
      navigate(`/s/${created.specId}/cases`);
    }
  }

  const specTitle = spec.name || spec.title || specId;
  const catalogControlLabel = spec.manual ? "Catalog" : "Spec";

  return (
    <header className="workspace-bar">
      <div className="workspace-control workspace-control-spec">
        <span className="workspace-control-label">{catalogControlLabel}</span>
        <div className="workspace-spec-current">
          <span className="workspace-spec-name" title={specTitle}>
            {specTitle}
          </span>
          <button
            type="button"
            className="btn workspace-spec-switch"
            onClick={() => setSpecSwitcherOpen(true)}
            title={SWITCH_SPEC_TIP}
            aria-label={SWITCH_SPEC_TIP}
          >
            <SearchIcon size={16} />
          </button>
        </div>
      </div>
      <div className="workspace-control">
        <span className="workspace-control-label">Environment</span>
        <EnvironmentPicker
          environments={environments}
          selectedId={environmentId}
          onSelect={applyEnvironment}
          onEdit={(environment) => openEnvironmentModal("edit", environment)}
          onDelete={removeEnvironment}
          onCreate={() => openEnvironmentModal("create")}
        />
      </div>
      <div className="workspace-control">
        <span className="workspace-control-label">Test plan</span>
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
      </div>
      <NavLink
        to={`/s/${specId}/cases`}
        className={({ isActive }) => `workspace-nav-link workspace-cases${isActive ? " active" : ""}`}
      >
        Cases
        {caseCount ? <span className="workspace-cases-count">{caseCount}</span> : null}
      </NavLink>
      {onAddApi ? (
        <button type="button" className="btn" onClick={onAddApi}>
          Add API
        </button>
      ) : null}
      <SpecMoreMenu specId={specId} onSpecSettings={openSpecSettings} />
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
      <div className="workspace-bar-trailing">
        <GuideLink />
        <AccountMenu
          account={account}
          canManage={canManage}
          canManageSubscriptions={canManageSubscriptions}
          onSignOut={onSignOut}
        />
      </div>
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
      {specSettingsOpen ? (
        <SpecSettingsModal
          spec={spec}
          form={specForm}
          onChange={setSpecForm}
          labelCatalog={labelCatalog}
          saving={savingSpec}
          reloading={reloading}
          onSave={saveSpecSettings}
          onClose={() => setSpecSettingsOpen(false)}
          onUpdateSpec={spec.manual ? undefined : chooseReloadSource}
        />
      ) : null}
      {specSwitcherOpen ? (
        <SpecSwitcherModal
          open={specSwitcherOpen}
          specs={catalogSpecs}
          currentSpecId={specId}
          onClose={() => setSpecSwitcherOpen(false)}
          onSelect={selectSpec}
          onNewSpec={() => openAddSpec("url")}
        />
      ) : null}
      {addSpecOpen ? (
        <AddSpecModal
          open={addSpecOpen}
          initialSource={addSpecSource}
          labelCatalog={catalogSpecs}
          onClose={() => setAddSpecOpen(false)}
          onCreated={onSpecCreated}
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
    name: "Default",
    baseUrl: spec?.baseUrl || "",
    authType: "NONE"
  };
}
