import { useEffect, useRef, useState } from "react";
import { Api } from "../api";
import LabelField, { uniqueLabels } from "./LabelField";
import { useToast } from "./Toast";

export default function AddSpecModal({
  open,
  initialSource = "url",
  emptyCatalog = false,
  labelCatalog = [],
  apiDown = false,
  onClose,
  onCreated
}) {
  const { toast } = useToast();
  const nameRef = useRef(null);
  const urlRef = useRef(null);
  const pasteRef = useRef(null);
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
    setSource(emptyCatalog ? "url" : initialSource);
    setUrl("");
    setName("");
    setLabel("");
    setBaseUrl("");
    setPaste("");
    setDragging(false);
    setLoading(false);
    if (emptyCatalog) {
      nameRef.current?.focus();
    } else if (initialSource === "paste") {
      pasteRef.current?.focus();
    } else if (initialSource === "url") {
      urlRef.current?.focus();
    } else {
      nameRef.current?.focus();
    }
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
  }, [open, initialSource, emptyCatalog, onClose, loading]);

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
    onCreated?.(spec, { source: emptyCatalog ? "rest" : source });
    onClose();
  }

  async function load() {
    const specName = requireName();
    if (!specName) return;
    if (emptyCatalog) {
      setLoading(true);
      try {
        const spec = await Api.loadSpec({
          name: specName,
          label: label.trim(),
          baseUrl: baseUrl.trim() || null,
          manual: true
        });
        finish(spec);
      } catch (error) {
        toast(error.message, true);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (source === "url" && !url.trim()) {
      toast("Enter a spec URL", true);
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
          <h3 id="add-spec-title">{emptyCatalog ? "Empty REST catalog" : "Add a spec"}</h3>
          <button type="button" className="btn" disabled={loading} onClick={onClose}>
            Cancel
          </button>
        </div>
        {!emptyCatalog ? (
          <>
            <div className="source-tabs" role="tablist" aria-label="How to provide the OpenAPI document">
              {[
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
            {source === "url" ? (
              <div className="field">
                <label htmlFor="new-spec-url">
                  Spec URL <span className="req">*</span>
                </label>
                <input
                  id="new-spec-url"
                  ref={urlRef}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={url}
                  disabled={loading}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://petstore.swagger.io/v2/swagger.json"
                />
                <div className="hint">
                  http(s) link to the OpenAPI document. Use the <strong>File</strong> tab to choose a document from
                  this computer — the URL field cannot browse your disk.
                </div>
              </div>
            ) : null}
            {source === "paste" ? (
              <div className="field">
                <label htmlFor="new-spec-paste">
                  OpenAPI JSON or YAML <span className="req">*</span>
                </label>
                <textarea
                  id="new-spec-paste"
                  ref={pasteRef}
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
                <strong>
                  OpenAPI file <span className="req">*</span>
                </strong>
                <div className="hint">Drop JSON, YAML, or YML — or choose a file below</div>
                <input
                  type="file"
                  accept=".json,.yaml,.yml"
                  disabled={loading}
                  onChange={(event) => event.target.files[0] && upload(event.target.files[0])}
                />
              </div>
            ) : null}
          </>
        ) : null}
        <div className="field">
          <label htmlFor="new-spec-name">
            {emptyCatalog ? "Catalog name" : "Spec name"} <span className="req">*</span>
          </label>
          <input
            id="new-spec-name"
            ref={nameRef}
            value={name}
            autoComplete="off"
            disabled={loading}
            onChange={(event) => setName(event.target.value)}
            placeholder={emptyCatalog ? "e.g. My APIs" : "e.g. HRM local"}
          />
          <div className="hint">
            {emptyCatalog
              ? "Must be unique in this workspace."
              : "Must be unique. Your name for this API in Studio — not the OpenAPI title."}
          </div>
        </div>
        <LabelField
          id="new-spec-label"
          value={label}
          onChange={setLabel}
          suggestions={uniqueLabels(labelCatalog)}
          hint="Optional. Groups specs on the home page (defaults to General)."
        />
        <div className="field">
          <label htmlFor="new-spec-base-url">API base URL</label>
          <input
            id="new-spec-base-url"
            value={baseUrl}
            disabled={loading}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="Optional, e.g. http://localhost:8080"
          />
          <div className="hint">
            {emptyCatalog
              ? "Default base URL for requests in this catalog."
              : "Overrides servers from the OpenAPI document when set."}
          </div>
        </div>
        {emptyCatalog ? (
          <p className="hint" style={{ marginTop: 0 }}>
            No APIs yet — use <strong>Add API</strong> in the studio after you open this catalog.
          </p>
        ) : null}
        {source !== "file" || emptyCatalog ? (
          <div className="actions">
            <button type="button" className="btn primary" onClick={load} disabled={loading || apiDown}>
              {loading
                ? (emptyCatalog ? "Creating…" : "Loading…")
                : (emptyCatalog ? "Create catalog" : "Load spec")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function nameFromFile(file) {
  if (!file?.name) return "";
  return file.name.replace(/\.(json|ya?ml)$/i, "").replace(/[_-]+/g, " ").trim();
}
