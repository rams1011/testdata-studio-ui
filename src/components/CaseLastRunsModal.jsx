import { useEffect } from "react";
import { Link } from "react-router-dom";
import CaseLastRunsList from "./CaseLastRunsList";

export default function CaseLastRunsModal({
  specId,
  planId,
  caseId,
  caseName,
  environmentId,
  environmentReady,
  refreshKey = 0,
  onClose
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const queryParts = [];
  if (planId) {
    queryParts.push(`planId=${encodeURIComponent(planId)}`);
  }
  if (environmentId) {
    queryParts.push(`environmentId=${encodeURIComponent(environmentId)}`);
  }
  if (caseId) {
    queryParts.push(`caseId=${encodeURIComponent(caseId)}`);
  }
  const historyQuery = queryParts.length ? `?${queryParts.join("&")}` : "";

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="case-last-runs-title">
        <div className="card-head">
          <h3 id="case-last-runs-title">Last runs — {caseName || "test case"}</h3>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
        <CaseLastRunsList
          specId={specId}
          planId={planId}
          caseId={caseId}
          environmentId={environmentId}
          environmentReady={environmentReady}
          refreshKey={refreshKey}
          emptyMessage="No runs recorded for this case yet."
        />
        <p className="hint" style={{ marginBottom: 0 }}>
          <Link to={`/s/${specId}/history${historyQuery}`} onClick={onClose}>Open full history</Link>
        </p>
      </div>
    </div>
  );
}
