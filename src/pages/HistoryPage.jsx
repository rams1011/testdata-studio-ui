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

function byTime(left, right) {
  const leftTime = Date.parse(left?.createdAt || "") || 0;
  const rightTime = Date.parse(right?.createdAt || "") || 0;
  return leftTime <= rightTime ? [left, right] : [right, left];
}

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
  const [picks, setPicks] = useState([]);
  const [compare, setCompare] = useState(null);
  const [planFilter, setPlanFilter] = useState(() => searchParams.get("planId") || "");
  const [caseFilter, setCaseFilter] = useState(() => searchParams.get("caseId") || "");
  const [outcome, setOutcome] = useState(() => searchParams.get("outcome") || "");
  const [trigger, setTrigger] = useState(() => searchParams.get("trigger") || "");

  const selectedRunId = searchParams.get("runId") || "";
  const selectedResultParam = searchParams.get("resultId") || "";

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
        const picked = pickHistoryResult(run, selectedResultParam);
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
  }, [selectedRunId, toast]);

  useEffect(() => {
    if (picks.length !== 2) {
      setCompare(null);
      return;
    }
    if (sameSnapshot(picks[0], picks[1])) {
      setCompare(null);
      return;
    }
    const [older, newer] = byTime(picks[0], picks[1]);
    let cancelled = false;
    Api.compareRuns({
      leftRunId: older.runId,
      leftResultId: older.resultId,
      rightRunId: newer.runId,
      rightResultId: newer.resultId
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
  }, [picks, toast]);

  const selectedResult = useMemo(
    () => pickHistoryResult(detail, selectedResultId),
    [detail, selectedResultId]
  );

  function clearOpenedRun() {
    setDetail(null);
    setSelectedResultId("");
    if (!searchParams.get("runId") && !searchParams.get("resultId")) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("runId");
    next.delete("resultId");
    setSearchParams(next, { replace: true });
  }

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

  function runIsPicked(runId) {
    return picks.some((pick) => pick.runId === runId);
  }

  function resultIsPicked(result) {
    return picks.some((pick) => sameSnapshot(pick, compareSlot(result)));
  }

  async function toggleRunPick(runId) {
    if (runIsPicked(runId)) {
      setPicks((current) => current.filter((pick) => pick.runId !== runId));
      return;
    }
    if (picks.length >= 2) {
      toast("Uncheck one snapshot first", true);
      return;
    }
    try {
      const run = detail?.runId === runId ? detail : await Api.getRun(runId);
      const result = pickHistoryResult(run, runId === selectedRunId ? selectedResultId : undefined);
      const slot = compareSlot(result);
      if (!slot) {
        toast("That run has no snapshot to compare", true);
        return;
      }
      setPicks((current) => [...current, slot]);
    } catch (error) {
      toast(error.message, true);
    }
  }

  function toggleResultPick(result) {
    const slot = compareSlot(result);
    if (!slot) {
      return;
    }
    setPicks((current) => {
      if (current.some((pick) => sameSnapshot(pick, slot))) {
        return current.filter((pick) => !sameSnapshot(pick, slot));
      }
      const sameRun = current.findIndex((pick) => pick.runId === slot.runId);
      if (sameRun >= 0) {
        const next = [...current];
        next[sameRun] = slot;
        return next;
      }
      if (current.length >= 2) {
        toast("Uncheck one snapshot first", true);
        return current;
      }
      return [...current, slot];
    });
  }

  function clearCompare() {
    setPicks([]);
    setCompare(null);
  }

  async function removeRun(runId) {
    if (!window.confirm("Delete this run and its snapshots?")) {
      return;
    }
    try {
      await Api.deleteRun(runId);
      setRuns((current) => current.filter((run) => run.runId !== runId));
      setPicks((current) => current.filter((pick) => pick.runId !== runId));
      if (selectedRunId === runId) {
        const next = new URLSearchParams(searchParams);
        next.delete("runId");
        next.delete("resultId");
        setSearchParams(next);
        setDetail(null);
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
            {pruneHint} Tick two runs to compare what changed.
          </p>
        </div>
      </div>

      {picks.length ? (
        <div className="card compare-bar" style={{ marginTop: 16 }}>
          <div>
            <strong>
              {picks.length === 1 ? "1 snapshot selected" : "Comparing 2 snapshots"}
            </strong>
            <p className="hint" style={{ margin: "4px 0 0" }}>
              {picks.length === 1
                ? "Tick one more run. Failed results are chosen first for plan runs."
                : picks.map((pick) => pick.label).join("  →  ")}
            </p>
          </div>
          <button type="button" className="btn" onClick={clearCompare}>Clear</button>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="fill-bar">
          <select value={planFilter} onChange={(event) => {
            clearOpenedRun();
            setPlanFilter(event.target.value);
          }}>
            <option value="">All plans</option>
            {(plans || []).map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
          <select value={outcome} onChange={(event) => {
            clearOpenedRun();
            setOutcome(event.target.value);
          }}>
            <option value="">All outcomes</option>
            <option value="failed">Failed</option>
            <option value="passed">Passed</option>
            <option value="error">Error</option>
            <option value="skipped">Skipped</option>
          </select>
          <select value={trigger} onChange={(event) => {
            clearOpenedRun();
            setTrigger(event.target.value);
          }}>
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
            onChange={(event) => {
              clearOpenedRun();
              setCaseFilter(event.target.value.trim());
            }}
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
                <th aria-label="Compare" />
                {["When", "Trigger", "Results", "Plan", ""].map((text) => <th key={text}>{text}</th>)}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.runId}
                  className={[
                    run.runId === selectedRunId ? "history-row-active" : "",
                    runIsPicked(run.runId) ? "history-row-picked" : ""
                  ].filter(Boolean).join(" ")}
                  style={{ cursor: "pointer" }}
                  onClick={() => openRun(run.runId)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={runIsPicked(run.runId)}
                      aria-label={`Compare ${triggerLabel(run.trigger)} ${formatRunTime(run.startedAt)}`}
                      onChange={() => toggleRunPick(run.runId)}
                    />
                  </td>
                  <td>{formatRunTime(run.startedAt)}</td>
                  <td>{triggerLabel(run.trigger)}</td>
                  <td>
                    <span className={`run-badge ${runTone(run) === "fail" ? "fail" : runTone(run) === "pass" ? "pass" : "skip"}`}>
                      {runCounts(run)}
                    </span>
                  </td>
                  <td>{(plans || []).find((plan) => plan.id === run.planId)?.name || run.planId || "—"}</td>
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
            <button type="button" className="btn danger" onClick={() => removeRun(detail.runId)}>Delete run</button>
          </div>
          {(detail.results || []).length > 1 ? (
            <div className="history-results">
              {detail.results.map((item) => (
                <div key={item.resultId} className={`history-result ${item.resultId === selectedResultId ? "active" : ""}`}>
                  <label className="compare-check">
                    <input
                      type="checkbox"
                      checked={resultIsPicked(item)}
                      onChange={() => toggleResultPick(item)}
                    />
                    <span className="hint">Compare</span>
                  </label>
                  <button type="button" className="history-result-main" onClick={() => openResult(item.resultId)}>
                    <strong>{item.testName || item.operationKey || item.method}</strong>
                    <span className="hint">{item.outcome}{item.actualStatus ? ` · HTTP ${item.actualStatus}` : ""}</span>
                  </button>
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
