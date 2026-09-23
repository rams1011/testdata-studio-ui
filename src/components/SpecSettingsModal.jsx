import { useEffect, useRef } from "react";
import LabelField, { specLabel } from "./LabelField";

export default function SpecSettingsModal({
  spec,
  form,
  onChange,
  labelCatalog = [],
  saving,
  reloading,
  onSave,
  onClose,
  onUpdateSpec
}) {
  const nameRef = useRef(null);
  const needsRename = spec.name && spec.title && spec.name === spec.title;

  useEffect(() => {
    nameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape" && !saving && !reloading) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving, reloading]);

  function patch(next) {
    onChange({ ...form, ...next });
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !reloading) {
          onClose();
        }
      }}
    >
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="spec-settings-title">
        <div className="card-head">
          <h3 id="spec-settings-title">Spec settings</h3>
          <button type="button" className="btn" disabled={saving || reloading} onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          {spec.manual
            ? `REST · ${spec.operationCount || 0} API${spec.operationCount === 1 ? "" : "s"}`
            : `${spec.operationCount || 0} operations`}
          {spec.title && spec.title !== spec.name ? ` · ${spec.title}` : ""}
        </p>
        {needsRename ? (
          <p className="hint">Give this spec a unique name so you can tell it apart from the OpenAPI title.</p>
        ) : null}
        <div className="field">
          <label htmlFor="spec-settings-name">Name <span className="req">*</span></label>
          <input
            id="spec-settings-name"
            ref={nameRef}
            value={form.name}
            placeholder="Unique spec name"
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
        <LabelField
          id="spec-settings-label"
          value={form.label}
          onChange={(label) => patch({ label })}
          suggestions={labelCatalog}
        />
        <div className="field">
          <label htmlFor="spec-settings-base-url">API base URL</label>
          <input
            id="spec-settings-base-url"
            value={form.baseUrl}
            placeholder="e.g. http://localhost:8080"
            disabled={saving}
            onChange={(event) => patch({ baseUrl: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
          />
          <div className="hint">
            Saved cases that still use the previous spec URL are updated. Cases with a custom URL are left as-is.
            Leave blank to use the OpenAPI servers URL.
          </div>
        </div>
        <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end", gap: 8 }}>
          {onUpdateSpec ? (
            <button type="button" className="btn" onClick={onUpdateSpec} disabled={saving || reloading}>
              {reloading ? "Updating…" : "Update spec"}
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={onSave} disabled={saving || reloading}>
            {saving ? "Saving…" : "Save spec"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function specSettingsForm(spec) {
  return {
    name: spec?.name || spec?.title || "",
    label: specLabel(spec),
    baseUrl: spec?.baseUrl || ""
  };
}
