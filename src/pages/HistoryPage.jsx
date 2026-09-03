import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { Api } from "../api";
import RunComparePanel from "../components/RunComparePanel";
import RunResultPanel from "../components/RunResultPanel";
import { useToast } from "../components/Toast";
import {
  compareSlot,
  formatRunTime,
  pickHistoryResult,
  runCounts,
  runTone,
  sameSnapshot,
  triggerLabel
} from "../runHistory";

export default function HistoryPage() {
  const { specId } = useParams();
  const { plans } = useOutletContext();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [loading, setLoading] = useState(false);
  const [maxPerSpec, setMaxPerSpec] = useState("");
  const [leftSlot, setLeftSlot] = useState(null);
  const [rightSlot, setRightSlot] = useState(null);
  const [compare, setCompare] = useState(null);
  const [planFilter, setPlanFilter] = useState(() => searchParams.get("planId") || "");
  const [caseFilter, setCaseFilter] = useState(() => searchParams.get("caseId") || "");
  const [outcome, setOutcome] = useState(() => searchParams.get("outcome") || "");
  const [trigger, setTrigger] = useState(() => searchParams.get("trigger") || "");

  const selectedRunId = searchParams.get("runId") || "";

  useEffect(() => {
    Api.config()
      .then((config) => setMaxPerSpec(config?.runHistoryMaxPerSpec || ""))
      .catch(() => setMaxPerSpec(""));
  }, []);

  useEffect(() => {
    if (!specId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    Api.listRuns({
      specId,
      planId: planFilter || undefined,
      caseId: caseFilter || undefined,
      outcome: outcome || undefined,
      trigger: trigger || undefined,
      limit: 100
    })
      .then((next) => {
        if (!cancelled) {
          setRuns(next || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRuns([]);
          toast(error.message, true);
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
  }, [specId, planFilter, caseFilter, outcome, trigger, toast]);

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      setSelectedResultId("");
      return;
    }
    let cancelled = false;
    Api.getRun(selectedRunId)
      .then((run) => {
        if (cancelled) {
          return;
        }
        setDetail(run);
        const preferred = searchParams.get("resultId");
        const picked = pickHistoryResult(run, preferred);
        setSelectedResultId(picked?.resultId || "");
      })
      .catch((error) => {
        if (!cancelled) {
          setDetail(null);
          toast(error.message, true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, searchParams, toast]);

  useEffect(() => {
    if (!leftSlot || !rightSlot) {
      setCompare(null);
      return;
    }
    if (sameSnapshot(leftSlot, rightSlot)) {
      setCompare(null);
      return;
    }
    let cancelled = false;
    Api.compareRuns({
      leftRunId: leftSlot.runId,
      leftResultId: leftSlot.resultId,
      rightRunId: rightSlot.runId,
      rightResultId: rightSlot.resultId
    })
      .then((next) => {
        if (!cancelled) {
          setCompare(next);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCompare(null);
          toast(error.message, true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leftSlot, rightSlot, toast]);

  const selectedResult = useMemo(
    () => pickHistoryResult(detail, selectedResultId),
    [detail, selectedResultId]
  );

  function openRun(runId) {
    const next = new URLSearchParams(searchParams);
    next.set("runId", runId);
    next.delete("resultId");
    setSearchParams(next);
  }

  function openResult(resultId) {
    const next = new URLSearchParams(searchParams);
    if (selectedRunId) {
      next.set("runId", selectedRunId);
    }
    next.set("resultId", resultId);
    setSelectedResultId(resultId);
    setSearchParams(next);
  }

  function assignSlot(side, result) {
    const slot = compareSlot(result);
    if (!slot) {
      toast("Open a snapshot first", true);
      return;
    }
    if (side === "left") {
      if (sameSnapshot(slot, rightSlot)) {
        toast("Pick two different snapshots", true);
        return;
      }
      setLeftSlot(slot);
      return;
    }
    if (sameSnapshot(slot, leftSlot)) {
      toast("Pick two different snapshots", true);
      return;
    }
    setRightSlot(slot);
  }

  async function assignRun(side, runId) {
    try {
      const run = detail?.runId === runId ? detail : await Api.getRun(runId);
      const result = pickHistoryResult(run, runId === selectedRunId ? selectedResultId : undefined);
      assignSlot(side, result);
      if (runId !== selectedRunId) {
        openRun(runId);
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  function clearCompare() {
    setLeftSlot(null);
    setRightSlot(null);
    setCompare(null);
  }

  async function removeRun(runId) {
    if (!window.confirm("Delete this run and its snapshots?")) {
      return;
    }
    try {
      await Api.deleteRun(runId);
      setRuns((current) => current.filter((run) => run.runId !== runId));
      if (selectedRunId === runId) {
        const next = new URLSearchParams(searchParams);
        next.delete("runId");
        next.delete("resultId");
        setSearchParams(next);
        setDetail(null);
      }
      if (leftSlot?.runId === runId) {
        setLeftSlot(null);
      }
      if (rightSlot?.runId === runId) {
        setRightSlot(null);
      }
      toast("Run deleted");
    } catch (error) {
      toast(error.message, true);
    }
  }

  const pruneHint = maxPerSpec && Number(maxPerSpec) > 0
    ? ` Oldest batches are pruned after ${maxPerSpec} per spec.`
    : "";

  return (
    <div>
      <div className="topbar">
        <div>
          <h2>History</h2>
          <p className="hint" style={{ marginTop: 6 }}>
            Snapshots from Try, Run, and Run plan. Bodies stay even after you edit the case.
            {pruneHint} Use Left and Right on two rows to compare them.
          </p>
        </div>
      </div>

      <div className="card compare-tray" style={{ marginTop: 16 }}>
        <div className="compare-slot">
          <span className="hint">Left snapshot</span>
          <strong>{leftSlot?.label || "Click Left on a run"}</strong>
        </div>
        <div className="compare-slot">
          <span className="hint">Right snapshot</span>
          <strong>{rightSlot?.label || "Click Right on another run"}</strong>
        </div>
        <button type="button" className="btn" disabled={!leftSlot && !rightSlot} onClick={clearCompare}>
          Clear compare
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="fill-bar">
          <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
            <option value="">All plans</option>
            {(plans || []).map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
          <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            <option value="">All outcomes</option>
            <option value="failed">Failed</option>
            <option value="passed">Passed</option>
            <option value="error">Error</option>
            <option value="skipped">Skipped</option>
          </select>
          <select value={trigger} onChange={(event) => setTrigger(event.target.value)}>
            <option value="">All triggers</option>
            <option value="try">Try</option>
            <option value="case">Case</option>
            <option value="plan">Plan</option>
          </select>
          <input
            type="search"
            className="inline-search"
            placeholder="Filter by case id"
            value={caseFilter}
            onChange={(event) => setCaseFilter(event.target.value.trim())}
          />
        </div>
        {loading ? <div className="empty">Loading history…</div> : null}
        {!loading && !runs.length ? (
          <div className="empty">
            No saved runs yet. Use Try this request, Run, or Run plan. History is stored in H2 or PostgreSQL.
          </div>
        ) : null}
        {!loading && runs.length ? (
          <table className="table">
            <thead>
              <tr>
                {["When", "Trigger", "Results", "Plan", "Compare", ""].map((text) => <th key={text}>{text}</th>)}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.runId}
                  className={run.runId === selectedRunId ? "history-row-active" : ""}
                  style={{ cursor: "pointer" }}
                  onClick={() => openRun(run.runId)}
                >
                  <td>{formatRunTime(run.startedAt)}</td>
                  <td>{triggerLabel(run.trigger)}</td>
                  <td>
                    <span className={`run-badge ${runTone(run) === "fail" ? "fail" : runTone(run) === "pass" ? "pass" : "skip"}`}>
                      {runCounts(run)}
                    </span>
                  </td>
                  <td>{(plans || []).find((plan) => plan.id === run.planId)?.name || run.planId || "—"}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <div className="history-row-actions">
                      <button type="button" className="btn" onClick={() => assignRun("left", run.runId)}>Left</button>
                      <button type="button" className="btn" onClick={() => assignRun("right", run.runId)}>Right</button>
                    </div>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="btn danger" onClick={() => removeRun(run.runId)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {detail ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="array-toolbar">
            <div>
              <h3 style={{ margin: 0 }}>{triggerLabel(detail.trigger)} · {formatRunTime(detail.startedAt)}</h3>
              <p className="hint" style={{ margin: "6px 0 0" }}>{runCounts(detail)}</p>
            </div>
            <div className="history-row-actions">
              <button type="button" className="btn" disabled={!selectedResult} onClick={() => assignSlot("left", selectedResult)}>
                Left
              </button>
              <button type="button" className="btn" disabled={!selectedResult} onClick={() => assignSlot("right", selectedResult)}>
                Right
              </button>
              <button type="button" className="btn danger" onClick={() => removeRun(detail.runId)}>Delete run</button>
            </div>
          </div>
          {(detail.results || []).length > 1 ? (
            <div className="history-results">
              {detail.results.map((item) => (
                <div key={item.resultId} className={`history-result ${item.resultId === selectedResultId ? "active" : ""}`}>
                  <button type="button" className="history-result-main" onClick={() => openResult(item.resultId)}>
                    <strong>{item.testName || item.operationKey || item.method}</strong>
                    <span className="hint">{item.outcome}{item.actualStatus ? ` · HTTP ${item.actualStatus}` : ""}</span>
                  </button>
                  <div className="history-row-actions">
                    <button type="button" className="btn" onClick={() => assignSlot("left", item)}>Left</button>
                    <button type="button" className="btn" onClick={() => assignSlot("right", item)}>Right</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <RunComparePanel compare={compare} onClear={clearCompare} />

      <div style={{ marginTop: 16 }}>
        <RunResultPanel result={selectedResult} title="Saved snapshot" />
      </div>
    </div>
  );
}
