import { useEffect, useRef } from "react";

export default function PlanModal({ mode, name, onChange, saving, onSave, onClose }) {
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

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title">
        <div className="card-head">
          <h3 id="plan-modal-title">{creating ? "New test plan" : "Edit test plan"}</h3>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          {creating
            ? "Cases you add after switching to this plan belong to it."
            : "Renaming keeps the cases already in this plan."}
        </p>
        <div className="field">
          <label htmlFor="plan-modal-name">Name <span className="req">*</span></label>
          <input
            id="plan-modal-name"
            ref={nameRef}
            value={name}
            placeholder="Smoke, Regression"
            disabled={saving}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
          />
        </div>
        <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" className="btn primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : creating ? "Create plan" : "Save plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
