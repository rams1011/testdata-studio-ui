import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Api } from "../api";
import { formatRunTime, runCounts, runTone, triggerLabel } from "../runHistory";

export default function LastRunsStrip({
  specId,
  planId,
  caseId,
  environmentId,
  environmentReady = true,
  refreshKey = 0
}) {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!specId || !planId || !environmentReady) {
      setRuns([]);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setRuns([]);
    setError("");
    setLoading(true);
    Api.listRuns({ specId, planId, caseId, environmentId, limit: 5 })
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
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [specId, planId, caseId, environmentId, environmentReady, refreshKey]);

  if (loading || error || !runs.length) {
    return null;
  }

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
  const query = queryParts.length ? `?${queryParts.join("&")}` : "";

  return (
    <div className="card last-runs">
      <div className="array-toolbar" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Last runs</h3>
        <Link className="hint" to={`/s/${specId}/history${query}`}>View history</Link>
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
