import { useEffect, useRef } from "react";

export default function EnvironmentModal({
  mode,
  form,
  onChange,
  saving,
  onSave,
  onClose,
  onDuplicate
}) {
  const nameRef = useRef(null);
  const creating = mode === "create";

  useEffect(() => {
    nameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  function patch(next) {
    onChange({ ...form, ...next });
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="environment-modal-title">
        <div className="card-head">
          <h3 id="environment-modal-title">{creating ? "New environment" : "Edit environment"}</h3>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          {creating
            ? "Cases you add after switching to this environment belong to it."
            : "Renaming keeps existing cases. Duplicate copies this host, auth, and its cases."}
        </p>
        <div className="field">
          <label htmlFor="environment-modal-name">Name <span className="req">*</span></label>
          <input
            id="environment-modal-name"
            ref={nameRef}
            value={form.name}
            placeholder="local, int, prod"
            disabled={saving}
            onChange={(event) => patch({ name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="environment-modal-base-url">Base URL <span className="req">*</span></label>
          <input
            id="environment-modal-base-url"
            value={form.baseUrl}
            placeholder="https://int.example.com/employee-service"
            disabled={saving}
            onChange={(event) => patch({ baseUrl: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="environment-modal-auth">Auth type</label>
          <select
            id="environment-modal-auth"
            value={form.authType}
            disabled={saving}
            onChange={(event) => patch({ authType: event.target.value })}
          >
            <option value="NONE">None</option>
            <option value="BEARER">Bearer token</option>
            <option value="BASIC">Basic</option>
            <option value="API_KEY">API key</option>
            <option value="OAUTH2">OAuth2</option>
          </select>
        </div>
        <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end", gap: 8 }}>
          {!creating && onDuplicate ? (
            <button type="button" className="btn" onClick={onDuplicate} disabled={saving}>
              Duplicate
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : creating ? "Create environment" : "Save environment"}
          </button>
        </div>
      </div>
    </div>
  );
}
