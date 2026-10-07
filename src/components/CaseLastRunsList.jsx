import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Api } from "../api";
import { formatRunTime, runCounts, runTone, triggerLabel } from "../runHistory";

export default function CaseLastRunsList({
  specId,
  planId,
  caseId,
  environmentId,
  environmentReady = true,
  refreshKey = 0,
  emptyMessage = "No runs yet.",
  limit = 5,
  silentEmpty = false
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
    setLoading(true);
    setError("");
    Api.listRuns({ specId, planId, caseId, environmentId, limit })
      .then((next) => {
        if (!cancelled) {
          setRuns(next || []);
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
  }, [specId, planId, caseId, environmentId, environmentReady, refreshKey, limit]);

  if (silentEmpty && (loading || error || !runs.length)) {
    return null;
  }
  if (loading) {
    return <p className="hint">Loading runs…</p>;
  }
  if (error) {
    return <p className="run-error">{error}</p>;
  }
  if (!runs.length) {
    return <p className="hint">{emptyMessage}</p>;
  }

  return (
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
  );
}
