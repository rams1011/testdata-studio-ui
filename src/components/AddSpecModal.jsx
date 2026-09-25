import { useEffect, useRef, useState } from "react";
import { Api } from "../api";
import LabelField, { uniqueLabels } from "./LabelField";
import { useToast } from "./Toast";

export default function AddSpecModal({
  open,
  initialSource = "url",
  labelCatalog = [],
  apiDown = false,
  onClose,
  onCreated
}) {
  const { toast } = useToast();
  const nameRef = useRef(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [source, setSource] = useState(initialSource);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSource(initialSource);
    setUrl("");
    setName("");
    setLabel("");
    setBaseUrl("");
    setPaste("");
    setDragging(false);
    setLoading(false);
    nameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, initialSource, onClose, loading]);

  if (!open) {
    return null;
  }

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

  function finish(spec) {
    onCreated?.(spec, { source });
    onClose();
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
      finish(spec);
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
      finish(spec);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
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
          <button type="button" className="btn" disabled={loading} onClick={onClose}>
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
            disabled={loading}
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
          suggestions={uniqueLabels(labelCatalog)}
        />
        <div className="field">
          <label>API base URL</label>
          <input
            value={baseUrl}
            disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
  );
}

function nameFromFile(file) {
  if (!file?.name) return "";
  return file.name.replace(/\.(json|ya?ml)$/i, "").replace(/[_-]+/g, " ").trim();
}
