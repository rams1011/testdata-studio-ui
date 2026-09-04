import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_DISPLAY, Api } from "../api";
import { useToast } from "../components/Toast";
import LabelField, { specLabel, uniqueLabels } from "../components/LabelField";
import { RELOAD_SPEC_CONFIRM, reloadSpecToast } from "../components/Sidebar";

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
  const [deletingId, setDeletingId] = useState("");
  const [reloadingId, setReloadingId] = useState("");
  const [backend, setBackend] = useState({ status: "checking", specs: [] });
  const reloadFileRef = useRef(null);
  const reloadTargetRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([Api.config(), Api.listSpecs()])
      .then(([config, specs]) => {
        if (!cancelled) {
          setBackend({ status: "ok", config, specs: specs || [] });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBackend({ status: "down", error: error.message, specs: [] });
        }
      });
    return () => { cancelled = true; };
  }, []);

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
        baseUrl: baseUrl.trim() || null
      });
      navigate(`/s/${spec.specId}`);
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

  async function refreshSpecs() {
    const next = await Api.listSpecs();
    setBackend((current) => ({ ...current, specs: next || [] }));
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

  return (
    <div className="hero">
      <h1>Test Data Studio</h1>
      <p>
        Open an API spec, generate test cases from each operation, run them, and export Excel
        for api-automation.
      </p>

      <div className={`status-banner ${backend.status}`}>
        {backend.status === "checking" && "Connecting to the studio API…"}
        {backend.status === "ok" && (
          <>Ready · {storageLabel(backend.config?.storageType)} · {API_DISPLAY}</>
        )}
        {backend.status === "down" && (
          <>
            Cannot reach the studio API at {API_DISPLAY}. Start testdata-generator-api, then reload.
            {backend.error ? <div className="hint">{backend.error}</div> : null}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Your specs</h3>
          {backend.specs.length ? (
            <input
              type="search"
              className="inline-search"
              placeholder="Search by name, label, or URL"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
        </div>
        {!backend.specs.length ? (
          <div className="empty">
            {backend.status === "checking"
              ? "Looking for saved specs…"
              : "Nothing loaded yet. Add a spec below — a unique name is all you need besides the OpenAPI file."}
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
                          {spec.operationCount} operations
                          {spec.baseUrl ? ` · ${spec.baseUrl}` : ""}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={!!reloadingId || !!deletingId}
                        onClick={(event) => startReload(spec, event)}
                      >
                        {reloadingId === spec.specId ? "Updating…" : "Update spec"}
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={!!reloadingId || !!deletingId}
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

      <div className="card">
        <h3>Add a spec</h3>
        <div className="field">
          <label>Name <span className="req">*</span></label>
          <input
            value={name}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. HRM local"
          />
          <div className="hint">Must be unique. This is your name for the spec — not the OpenAPI title.</div>
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
            ["url", "URL"],
            ["file", "File"],
            ["paste", "Paste"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={source === id}
              className={`source-tab ${source === id ? "active" : ""}`}
              onClick={() => setSource(id)}
            >
              {label}
            </button>
          ))}
        </div>
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
              {loading ? "Loading…" : "Load spec"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
