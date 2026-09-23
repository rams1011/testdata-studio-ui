import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_DISPLAY, Api } from "../api";
import { canManageMembers, clearSession, isWorkspaceReady, saveSession, subscriptionBanner } from "../session";
import { useToast } from "../components/Toast";
import LabelField, { specLabel, uniqueLabels } from "../components/LabelField";
import { RELOAD_SPEC_CONFIRM, reloadSpecToast } from "../components/Sidebar";
import { importCollectionToast } from "./ExportPage";

export default function LoadSpecPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [source, setSource] = useState("url");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [reloadingId, setReloadingId] = useState("");
  const [backend, setBackend] = useState({ status: "checking", specs: [], session: null });
  const reloadFileRef = useRef(null);
  const reloadTargetRef = useRef(null);
  const importFileRef = useRef(null);
  const nameRef = useRef(null);
  const workspaceNameRef = useRef(null);
  const addButtonRef = useRef(null);
  const workspaceSelectRef = useRef(null);
  const loadingRef = useRef(false);
  const workspaceBusyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadHome() {
      try {
        const config = await Api.config();
        const saas = config?.saas === "true" || config?.saas === true;
        const session = await Api.session();
        if (cancelled) return;
        if (saas && !session?.authenticated) {
          setBackend({ status: "ok", config, specs: [], session, saas: true });
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
      loadHome();
    }
    window.addEventListener("testdata:unauthorized", onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener("testdata:unauthorized", onUnauthorized);
    };
  }, []);

  loadingRef.current = loading;

  useEffect(() => {
    if (!adding) return undefined;
    nameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape" && !loadingRef.current) {
        setAdding(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      addButtonRef.current?.focus();
    };
  }, [adding]);

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

  function requireName(file) {
    const trimmed = name.trim() || nameFromFile(file);
    if (!trimmed) {
      toast("Give this spec a unique name first", true);
      return null;
    }
    if (!name.trim() && trimmed) {
      setName(trimmed);
    }
    return trimmed;
  }

  async function load() {
    const specName = requireName();
    if (!specName) return;
    if (source === "url" && !url.trim()) {
      toast("Enter a spec URL or file path", true);
      return;
    }
    if (source === "paste" && !paste.trim()) {
      toast("Paste OpenAPI JSON or YAML", true);
      return;
    }
    if (source === "file") {
      toast("Drop a file, or choose File below", true);
      return;
    }
    setLoading(true);
    try {
      const spec = await Api.loadSpec({
        name: specName,
        label: label.trim(),
        location: source === "url" ? (url.trim() || null) : null,
        content: source === "paste" ? (paste.trim() || null) : null,
        baseUrl: baseUrl.trim() || null,
        manual: source === "rest" ? true : undefined
      });
      navigate(source === "rest" ? `/s/${spec.specId}/cases` : `/s/${spec.specId}`, {
        state: source === "rest" ? { addApi: true } : undefined
      });
    } catch (error) {
      toast(error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function upload(file) {
    const specName = requireName(file);
    if (!specName) return;
    setLoading(true);
    try {
      const spec = await Api.uploadSpec(file, baseUrl.trim(), specName, label.trim());
      navigate(`/s/${spec.specId}`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function importCollection(file) {
    if (!file) return;
    setLoading(true);
    try {
      const imported = await Api.importCollection(file);
      sessionStorage.setItem(`testdata.plan.${imported.specId}`, imported.planId);
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
  const saasOn = Boolean(backend.saas || backend.session?.saas);
  const signedIn = saasOn && Boolean(backend.session?.authenticated || backend.session?.account);
  const saasLocked = saasOn && !signedIn;
  const workspacePending = signedIn && !isWorkspaceReady(backend.session);
  const studioOpen = signedIn && isWorkspaceReady(backend.session);
  const showAdmin = studioOpen && canManageMembers(backend.session);
  const showSubscriptions = signedIn;

  return (
    <div className="hero">
      <div className="hero-head">
        <h1>Test Data Studio</h1>
        {signedIn ? (
          <div className="hero-actions">
            {showSubscriptions ? <Link className="btn" to="/subscriptions">Plan</Link> : null}
            {showAdmin ? <Link className="btn" to="/admin">Admin</Link> : null}
            <button type="button" className="btn" onClick={signOut}>Sign out</button>
          </div>
        ) : null}
      </div>
      <p>
        Open an API spec or add REST APIs without Swagger, generate test cases, import a collection,
        and export JSON or Excel for api-automation.
      </p>

      {backend.saas && signedIn ? (
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
          {backend.session.account?.email ? (
            <span className="hint">{backend.session.account.email}</span>
          ) : null}
        </div>
      ) : null}

      <div className={`status-banner ${workspacePending ? "pending" : backend.status}`}>
        {backend.status === "checking" && "Connecting to the studio API…"}
        {backend.status === "ok" && saasLocked && (
          <>
            This Studio is hosted as SaaS. Sign in to open specs for your workspace.
            <div className="actions" style={{ marginTop: 12 }}>
              <Link className="btn primary" to="/login">Sign in</Link>
            </div>
          </>
        )}
        {backend.status === "ok" && workspacePending && (
          <>
            {subscriptionBanner(backend.session)
              || `${backend.session.tenant?.name || "This workspace"} is read-only until the organization plan is active.`}
            {" "}
            <Link to="/subscriptions">View plan</Link>
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
              onClick={() => {
                setSource("rest");
                setAdding(true);
              }}
            >
              Add REST APIs
            </button>
            <button
              ref={addButtonRef}
              type="button"
              className="btn primary"
              disabled={workspacePending || apiDown || backend.status === "checking"}
              onClick={() => {
                setSource("url");
                setAdding(true);
              }}
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
                        onClick={() => navigate(`/s/${spec.specId}`)}
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

      {adding && !saasLocked ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) {
              setAdding(false);
            }
          }}
        >
          <div
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-spec-title"
          >
            <div className="card-head">
              <h3 id="add-spec-title">{source === "rest" ? "Add REST APIs" : "Add a spec"}</h3>
              <button type="button" className="btn" disabled={loading} onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
            <div className="field">
              <label htmlFor="new-spec-name">Name <span className="req">*</span></label>
              <input
                id="new-spec-name"
                ref={nameRef}
                value={name}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. HRM local"
              />
              <div className="hint">
                {source === "rest"
                  ? "Must be unique. This catalog holds REST APIs you add by method and path."
                  : "Must be unique. This is your name for the spec — not the OpenAPI title."}
              </div>
            </div>
            <LabelField
              id="new-spec-label"
              value={label}
              onChange={setLabel}
              suggestions={uniqueLabels(backend.specs)}
            />
            <div className="field">
              <label>API base URL</label>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="Optional override, e.g. http://localhost:8080"
              />
            </div>
            <div className="source-tabs" role="tablist">
              {[
                ["rest", "REST"],
                ["url", "URL"],
                ["file", "File"],
                ["paste", "Paste"]
              ].map(([id, tabLabel]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={source === id}
                  className={`source-tab ${source === id ? "active" : ""}`}
                  onClick={() => setSource(id)}
                >
                  {tabLabel}
                </button>
              ))}
            </div>
            {source === "rest" ? (
              <p className="hint" style={{ marginTop: 0 }}>
                Creates an empty catalog. Add GET/POST paths in Studio, then save test cases. No OpenAPI file required.
              </p>
            ) : null}
            {source === "url" ? (
              <div className="field">
                <label>Spec URL or local file path</label>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://petstore.swagger.io/v2/swagger.json"
                />
              </div>
            ) : null}
            {source === "paste" ? (
              <div className="field">
                <label>OpenAPI JSON or YAML</label>
                <textarea
                  value={paste}
                  onChange={(event) => setPaste(event.target.value)}
                  placeholder="Paste the spec here"
                />
              </div>
            ) : null}
            {source === "file" ? (
              <div
                className={`drop ${dragging ? "drag" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files[0];
                  if (file) upload(file);
                }}
              >
                <strong>Drop a Swagger or OpenAPI file</strong>
                <div className="hint">JSON, YAML, or YML — or choose a file</div>
                <input
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={(event) => event.target.files[0] && upload(event.target.files[0])}
                />
              </div>
            ) : (
              <div className="actions">
                <button type="button" className="btn primary" onClick={load} disabled={loading || apiDown}>
                  {loading ? (source === "rest" ? "Creating…" : "Loading…") : source === "rest" ? "Create catalog" : "Load spec"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const NEW_WORKSPACE_VALUE = "__new_workspace__";

function groupSpecs(specs) {
  const groups = new Map();
  (specs || []).forEach((spec) => {
    const label = specLabel(spec);
    const key = label.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { title: label, items: [] });
    }
    groups.get(key).items.push(spec);
  });
  return [...groups.values()]
    .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }))
    .map((group) => [group.title, group.items]);
}

function nameFromFile(file) {
  if (!file?.name) return "";
  return file.name.replace(/\.(json|ya?ml)$/i, "").replace(/[_-]+/g, " ").trim();
}

function storageLabel(type) {
  if (type === "h2") return "saved locally";
  if (type === "excel") return "saved in Excel";
  if (type === "database") return "saved in the database";
  return type ? `storage: ${type}` : "connected";
}
