import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_DISPLAY, Api } from "../api";
import { canManageMembers, clearSession, isAuthEnabled, isBillingEnabled, isWorkspaceReady, saveSession, subscriptionBanner } from "../session";
import AccountMenu from "../components/AccountMenu";
import AddSpecModal from "../components/AddSpecModal";
import { useToast } from "../components/Toast";
import { groupSpecs, touchRecentSpec } from "../specCatalog";
import { RELOAD_SPEC_CONFIRM, reloadSpecToast } from "../components/Sidebar";
import { importCollectionToast } from "./ExportPage";

export default function LoadSpecPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [addSpecSource, setAddSpecSource] = useState(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [reloadingId, setReloadingId] = useState("");
  const [backend, setBackend] = useState({ status: "checking", specs: [], session: null });
  const reloadFileRef = useRef(null);
  const reloadTargetRef = useRef(null);
  const importFileRef = useRef(null);
  const workspaceNameRef = useRef(null);
  const workspaceSelectRef = useRef(null);
  const loadingRef = useRef(false);
  const workspaceBusyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadHome() {
      try {
        const config = await Api.config();
        const saas = isAuthEnabled(null, config);
        const session = await Api.session();
        if (cancelled) return;
        if (saas && !session?.authenticated) {
          navigate("/login", { replace: true, state: { from: "/" } });
          return;
        }
        if (session?.tenant?.id) {
          saveSession(session.token || undefined, session.tenant.id);
        }
        const specs = await Api.listSpecs();
        if (!cancelled) {
          setBackend({ status: "ok", config, specs: specs || [], session, saas });
        }
      } catch (error) {
        if (!cancelled) {
          setBackend({ status: "down", error: error.message, specs: [], session: null });
        }
      }
    }
    loadHome();
    function onUnauthorized() {
      navigate("/login", { replace: true, state: { from: "/" } });
    }
    window.addEventListener("testdata:unauthorized", onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener("testdata:unauthorized", onUnauthorized);
    };
  }, [navigate]);

  loadingRef.current = loading;

  workspaceBusyRef.current = workspaceBusy;

  useEffect(() => {
    if (!creatingWorkspace) return undefined;
    workspaceNameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape" && !workspaceBusyRef.current) {
        setCreatingWorkspace(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      workspaceSelectRef.current?.focus();
    };
  }, [creatingWorkspace]);

  const specs = (backend.specs || []).filter((spec) => {
    if (!query.trim()) return true;
    const haystack = `${spec.name || ""} ${spec.title || ""} ${spec.label || ""} ${spec.baseUrl || ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function onSpecCreated(spec, meta) {
    touchRecentSpec(spec.specId);
    refreshSpecs();
    if (meta?.source === "rest") {
      navigate(`/s/${spec.specId}/cases`, { state: { addApi: true } });
    } else {
      navigate(`/s/${spec.specId}/cases`);
    }
  }

  async function importCollection(file) {
    if (!file) return;
    setLoading(true);
    try {
      const imported = await Api.importCollection(file);
      sessionStorage.setItem(`testdata.plan.${imported.specId}`, imported.planId);
      touchRecentSpec(imported.specId);
      toast(importCollectionToast(imported));
      navigate(`/s/${imported.specId}/cases`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSpecs() {
    const next = await Api.listSpecs();
    setBackend((current) => ({ ...current, specs: next || [] }));
  }

  async function switchWorkspace(tenantId) {
    if (tenantId === NEW_WORKSPACE_VALUE) {
      if (studioOpen) {
        openWorkspaceModal();
      }
      return;
    }
    try {
      const session = await Api.switchTenant(tenantId);
      saveSession(session.token || undefined, session.tenant?.id);
      const specs = await Api.listSpecs();
      setBackend((current) => ({ ...current, session, specs: specs || [] }));
      toast(`Using workspace ${session.tenant?.name}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  function openWorkspaceModal() {
    setWorkspaceName("");
    setCreatingWorkspace(true);
  }

  async function addWorkspace() {
    const trimmed = workspaceName.trim();
    if (!trimmed) {
      toast("Give this workspace a name first", true);
      workspaceNameRef.current?.focus();
      return;
    }
    setWorkspaceBusy(true);
    try {
      const tenant = await Api.createTenant({ name: trimmed });
      saveSession(undefined, tenant.id);
      const session = await Api.session();
      saveSession(session.token || undefined, tenant.id);
      const specs = await Api.listSpecs();
      setBackend((current) => ({ ...current, session, specs: specs || [] }));
      setCreatingWorkspace(false);
      toast(`Created workspace ${tenant.name}`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function signOut() {
    try {
      await Api.logout();
    } catch {
      clearSession();
    }
    setBackend((current) => ({
      ...current,
      session: { saas: true, authenticated: false, tenants: [] },
      specs: []
    }));
    navigate("/login");
  }

  async function reloadExisting(spec, file) {
    setReloadingId(spec.specId);
    try {
      const result = file
        ? await Api.reloadSpecUpload(spec.specId, file, spec.baseUrl)
        : await Api.reloadSpec(spec.specId, spec.baseUrl ? { baseUrl: spec.baseUrl } : {});
      await refreshSpecs();
      toast(reloadSpecToast(result));
    } catch (error) {
      toast(error.message, true);
    } finally {
      setReloadingId("");
    }
  }

  async function deleteSpec(spec, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete spec "${spec.name || spec.title}" and all of its plans and cases?`)) {
      return;
    }
    setDeletingId(spec.specId);
    try {
      await Api.deleteSpec(spec.specId);
      await refreshSpecs();
      toast("Spec deleted");
    } catch (error) {
      toast(error.message, true);
    } finally {
      setDeletingId("");
    }
  }

  function startReload(spec, event) {
    event.stopPropagation();
    if (spec.sourceLocation) {
      if (!window.confirm(RELOAD_SPEC_CONFIRM)) {
        return;
      }
      reloadExisting(spec);
      return;
    }
    reloadTargetRef.current = spec;
    reloadFileRef.current?.click();
  }

  const apiDown = backend.status === "down";
  const saasOn = isAuthEnabled(backend.session, backend.config) || Boolean(backend.saas);
  const billingOn = isBillingEnabled(backend.session, backend.config);
  const signedIn = saasOn && Boolean(backend.session?.authenticated || backend.session?.account);
  const saasLocked = saasOn && !signedIn;
  const workspacePending = signedIn && !isWorkspaceReady(backend.session);
  const studioOpen = signedIn && isWorkspaceReady(backend.session);
  const showAdmin = studioOpen && canManageMembers(backend.session);
  const showSubscriptions = signedIn && billingOn;

  return (
    <div className="hero">
      <div className="hero-head">
        <h1>Test Data Studio</h1>
        {signedIn ? (
          <AccountMenu
            account={backend.session?.account}
            canManage={showAdmin}
            canManageSubscriptions={showSubscriptions}
            onSignOut={signOut}
          />
        ) : null}
      </div>
      <p>
        Open an API spec or add REST APIs without Swagger, build test cases, import a collection,
        and export JSON or Excel for api-automation.
      </p>

      {saasOn && signedIn ? (
        <div className="workspace-bar-home">
          <label className="hint" htmlFor="workspace-select">Workspace</label>
          <select
            id="workspace-select"
            ref={workspaceSelectRef}
            value={backend.session.tenant?.id || ""}
            onChange={(event) => switchWorkspace(event.target.value)}
          >
            {(backend.session.tenants || []).map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}{tenant.ready === false ? " (read-only)" : ""}
              </option>
            ))}
            {studioOpen ? (
              <option value={NEW_WORKSPACE_VALUE}>New workspace…</option>
            ) : null}
          </select>
        </div>
      ) : null}

      <div className={`status-banner ${workspacePending ? "pending" : backend.status}`}>
        {backend.status === "checking" && "Connecting to the studio API…"}
        {backend.status === "ok" && saasLocked && (
          <>
            {billingOn
              ? "This Studio is hosted as SaaS. Sign in to open specs for your workspace."
              : "This Studio requires sign in. Use the account your administrator created."}
            <div className="actions" style={{ marginTop: 12 }}>
              <Link className="btn primary" to="/login">Sign in</Link>
            </div>
          </>
        )}
        {backend.status === "ok" && workspacePending && (
          <>
            {subscriptionBanner(backend.session)
              || `${backend.session.tenant?.name || "This workspace"} is read-only until the organization plan is active.`}
            {billingOn ? <>{" "}<Link to="/subscriptions">View plan</Link></> : null}
          </>
        )}
        {backend.status === "ok" && !saasLocked && !workspacePending && (
          <>Ready · {storageLabel(backend.config?.storageType)} · {API_DISPLAY}
            {backend.session?.tenant?.name ? ` · ${backend.session.tenant.name}` : ""}</>
        )}
        {backend.status === "down" && (
          <>
            Cannot reach the studio API at {API_DISPLAY}. Start testdata-generator-api, then reload.
            {backend.error ? <div className="hint">{backend.error}</div> : null}
          </>
        )}
      </div>

      {saasLocked ? null : (
      <div className="card home-specs">
        <div className="card-head">
          <h3>Your specs</h3>
          <div className="card-head-actions">
            {backend.specs.length ? (
              <input
                type="search"
                className="inline-search"
                placeholder="Search by name, label, or URL"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={workspacePending || apiDown || backend.status === "checking" || loading}
              onClick={() => importFileRef.current?.click()}
            >
              Import collection
            </button>
            <button
              type="button"
              className="btn"
              disabled={workspacePending || apiDown || backend.status === "checking"}
              onClick={() => setAddSpecSource("rest")}
            >
              Add REST APIs
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={workspacePending || apiDown || backend.status === "checking"}
              onClick={() => setAddSpecSource("url")}
            >
              Add spec
            </button>
          </div>
        </div>
        {!backend.specs.length ? (
          <div className="empty">
            {backend.status === "checking" ? (
              "Looking for saved specs…"
            ) : (
              <>
                Nothing loaded yet. Use Add spec for OpenAPI, or Add REST APIs if you do not have Swagger.
              </>
            )}
          </div>
        ) : !specs.length ? (
          <div className="empty">No specs match “{query}”.</div>
        ) : (
          <div className="spec-list">
            {groupSpecs(specs).map(([group, items]) => (
              <details key={group} className="spec-group" open>
                <summary>
                  <span className="spec-group-title">{group}</span>
                  <span className="hint">{items.length} spec{items.length === 1 ? "" : "s"}</span>
                </summary>
                <div className="spec-group-body">
                  {items.map((spec) => (
                    <div key={spec.specId} className="spec-row">
                      <button
                        type="button"
                        className="spec-open"
                        onClick={() => {
                          touchRecentSpec(spec.specId);
                          navigate(`/s/${spec.specId}/cases`);
                        }}
                      >
                        <div className="spec-open-title">{spec.name || spec.title}</div>
                        {spec.title && spec.title !== spec.name ? (
                          <div className="hint">{spec.title}</div>
                        ) : null}
                        <div className="hint">
                          {spec.manual ? "REST catalog" : `${spec.operationCount} operations`}
                          {spec.manual && spec.operationCount
                            ? ` · ${spec.operationCount} API${spec.operationCount === 1 ? "" : "s"}`
                            : ""}
                          {spec.baseUrl ? ` · ${spec.baseUrl}` : ""}
                        </div>
                      </button>
                      {spec.manual ? null : (
                      <button
                        type="button"
                        className="btn"
                        disabled={workspacePending || !!reloadingId || !!deletingId}
                        onClick={(event) => startReload(spec, event)}
                      >
                        {reloadingId === spec.specId ? "Updating…" : "Update spec"}
                      </button>
                      )}
                      <button
                        type="button"
                        className="btn danger"
                        disabled={workspacePending || !!reloadingId || !!deletingId}
                        onClick={(event) => deleteSpec(spec, event)}
                      >
                        {deletingId === spec.specId ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
        <input
          ref={importFileRef}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            importCollection(file);
          }}
        />
        <input
          ref={reloadFileRef}
          type="file"
          accept=".json,.yaml,.yml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const spec = reloadTargetRef.current;
            event.target.value = "";
            reloadTargetRef.current = null;
            if (file && spec) {
              if (!window.confirm(RELOAD_SPEC_CONFIRM)) {
                return;
              }
              reloadExisting(spec, file);
            }
          }}
        />
      </div>
      )}

      {creatingWorkspace && !saasLocked ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !workspaceBusy) {
              setCreatingWorkspace(false);
            }
          }}
        >
          <div
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-workspace-title"
          >
            <div className="card-head">
              <h3 id="new-workspace-title">New workspace</h3>
              <button
                type="button"
                className="btn"
                disabled={workspaceBusy}
                onClick={() => setCreatingWorkspace(false)}
              >
                Cancel
              </button>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              Specs, collections, and environments stay private to this workspace.
              It uses the same organization plan as your other workspaces.
            </p>
            <div className="field">
              <label htmlFor="new-workspace-name">Name <span className="req">*</span></label>
              <input
                id="new-workspace-name"
                ref={workspaceNameRef}
                value={workspaceName}
                autoComplete="off"
                disabled={workspaceBusy}
                onChange={(event) => setWorkspaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addWorkspace();
                  }
                }}
                placeholder="e.g. Acme QA"
              />
            </div>
            <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn primary"
                disabled={workspaceBusy}
                onClick={addWorkspace}
              >
                {workspaceBusy ? "Creating…" : "Create workspace"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addSpecSource && !saasLocked ? (
        <AddSpecModal
          open={!!addSpecSource}
          initialSource={addSpecSource}
          labelCatalog={backend.specs}
          apiDown={apiDown}
          onClose={() => setAddSpecSource(null)}
          onCreated={onSpecCreated}
        />
      ) : null}
    </div>
  );
}

const NEW_WORKSPACE_VALUE = "__new_workspace__";

function storageLabel(type) {
  if (type === "h2") return "saved locally";
  if (type === "excel") return "saved in Excel";
  if (type === "database") return "saved in the database";
  return type ? `storage: ${type}` : "connected";
}
