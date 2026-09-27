import { useEffect, useRef } from "react";

export default function DuplicateCaseModal({
  sourceTestName,
  testName,
  onTestNameChange,
  targetEnvironmentId,
  onTargetEnvironmentChange,
  environments,
  currentEnvironmentId,
  openCopy,
  onOpenCopyChange,
  saving,
  onConfirm,
  onClose
}) {
  const nameRef = useRef(null);
  const currentName = environments.find((item) => item.id === currentEnvironmentId)?.name || "this environment";
  const targetName = environments.find((item) => item.id === targetEnvironmentId)?.name || "environment";
  const sameTarget = targetEnvironmentId === currentEnvironmentId;

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
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
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-case-title">
        <div className="card-head">
          <h3 id="duplicate-case-title">Duplicate test case</h3>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Creates a new case with a new id and copies request files. The original case is unchanged.
        </p>
        <div className="field">
          <label htmlFor="duplicate-case-name">Name <span className="req">*</span></label>
          <input
            id="duplicate-case-name"
            ref={nameRef}
            value={testName}
            disabled={saving}
            onChange={(event) => onTestNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && testName.trim()) {
                event.preventDefault();
                onConfirm();
              }
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="duplicate-case-env">Environment</label>
          <select
            id="duplicate-case-env"
            value={targetEnvironmentId}
            disabled={saving || !environments.length}
            onChange={(event) => onTargetEnvironmentChange(event.target.value)}
          >
            {environments.map((environment) => (
              <option key={environment.id} value={environment.id}>{environment.name}</option>
            ))}
          </select>
          <span className="hint">
            {sameTarget
              ? `Copy stays in ${currentName}.`
              : `Copy is saved for ${targetName}. Your workspace stays on ${currentName} unless you open the copy below.`}
          </span>
        </div>
        <label className="check" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={openCopy}
            disabled={saving}
            onChange={(event) => onOpenCopyChange(event.target.checked)}
          />
          Open copy in editor
          {!sameTarget && openCopy ? (
            <span className="hint" style={{ margin: 0 }}>
              {" "}— switches workspace to {targetName}
            </span>
          ) : null}
        </label>
        <div className="actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn primary"
            onClick={onConfirm}
            disabled={saving || !testName.trim() || !targetEnvironmentId}
          >
            {saving ? "Duplicating…" : "Create copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
