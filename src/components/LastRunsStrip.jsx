import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Api } from "../api";
import { formatRunTime, runCounts, runTone, triggerLabel } from "../runHistory";

export default function LastRunsStrip({ specId, planId, caseId, refreshKey = 0 }) {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!specId) {
      return;
    }
    let cancelled = false;
    Api.listRuns({ specId, planId, caseId, limit: 5 })
      .then((next) => {
        if (!cancelled) {
          setRuns(next || []);
          setError("");
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setRuns([]);
          setError(caught.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [specId, planId, caseId, refreshKey]);

  if (error || !runs.length) {
    return null;
  }

  const query = caseId ? `caseId=${encodeURIComponent(caseId)}` : "";

  return (
    <div className="card last-runs">
      <div className="array-toolbar" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Last runs</h3>
        <Link className="hint" to={`/s/${specId}/history${query ? `?${query}` : ""}`}>View history</Link>
      </div>
      <div className="last-runs-list">
        {runs.map((run) => (
          <Link
            key={run.runId}
            className={`last-runs-row ${runTone(run)}`}
            to={`/s/${specId}/history?runId=${encodeURIComponent(run.runId)}`}
          >
            <span className="hint">{formatRunTime(run.startedAt)}</span>
            <strong>{triggerLabel(run.trigger)}</strong>
            <span className="hint">{runCounts(run)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
