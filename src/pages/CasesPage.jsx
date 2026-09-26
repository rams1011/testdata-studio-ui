import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import AuthSettings, { authCredentialsMissing, useSpecAuth } from "../components/AuthSettings";
import ImportCurlModal from "../components/ImportCurlModal";
import LastRunsStrip from "../components/LastRunsStrip";
import RunResultPanel, { resultBadge } from "../components/RunResultPanel";
import { useToast } from "../components/Toast";

export default function CasesPage() {
  const { specId } = useParams();
  const { planId, operations, spec, reloadCases, onAddApi, importCurlAsCase, runEnvironment, environmentReady } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useSpecAuth(specId);
  const [running, setRunning] = useState(null);
  const [runById, setRunById] = useState({});
  const [selectedResult, setSelectedResult] = useState(null);
  const [planSummary, setPlanSummary] = useState(null);
  const [filter, setFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState({});
  const [historyKey, setHistoryKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!planId || !environmentReady) {
      setLoading(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Api.listCases(specId, undefined, planId, runEnvironment?.id)
      .then((next) => {
        if (cancelled) return;
        setCases(next || []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setCases([]);
        setLoading(false);
        toast(error.message, true);
      });
    setRunById({});
    setSelectedResult(null);
    setPlanSummary(null);
    setSelected({});
    return () => { cancelled = true; };
  }, [specId, planId, toast, runEnvironment?.id, environmentReady]);

  const methods = useMemo(
    () => [...new Set(cases.map((item) => item.method).filter(Boolean))].sort(),
    [cases]
  );
  const statuses = useMemo(
    () => [...new Set(cases.map((item) => String(item.statusCode)))].sort(),
    [cases]
  );

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return cases.filter((item) => {
      if (methodFilter && item.method !== methodFilter) return false;
      if (statusFilter && String(item.statusCode) !== statusFilter) return false;
      if (!needle) return true;
      const haystack = `${item.testName} ${item.method} ${item.endpoint} ${item.testGroup} ${item.statusCode}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [cases, filter, methodFilter, statusFilter]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  useEffect(() => {
    setSelectedResult(null);
    setPlanSummary(null);
  }, [filter, methodFilter, statusFilter]);

  async function refresh() {
    const next = await Api.listCases(specId, undefined, planId, runEnvironment?.id);
    setCases(next);
    await reloadCases?.();
    return next;
  }

  function remember(result) {
    if (result?.caseId) {
      setRunById((current) => ({ ...current, [result.caseId]: result }));
    }
    setSelectedResult(result);
  }

  async function runOne(id, event) {
    event.stopPropagation();
    setRunning(id);
    try {
      const result = await Api.runCase(id, auth, runEnvironment?.id);
      remember(result);
      setHistoryKey((value) => value + 1);
      toast(result.passed ? "Passed" : (result.error || "Failed"), !result.passed);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setRunning(null);
    }
  }

  async function runPlan() {
    setRunning("plan");
    try {
      const result = await Api.runPlan({ specId, planId, auth, environmentId: runEnvironment?.id });
      const next = {};
      (result.results || []).forEach((item) => {
        if (item.caseId) {
          next[item.caseId] = item;
        }
      });
      setRunById(next);
      setPlanSummary(result);
      const firstFail = (result.results || []).find((item) => !item.passed && !item.skipped);
      setSelectedResult(firstFail || null);
      const message = result.allPassed
        ? `All ${result.passed} passed`
        : `${result.passed} passed, ${result.failed} failed${result.skipped ? `, ${result.skipped} skipped` : ""}`;
      setHistoryKey((value) => value + 1);
      toast(message, !result.allPassed);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setRunning(null);
    }
  }

  async function bulkEnabled(enabled) {
    if (!selectedIds.length) return;
    try {
      await Promise.all(selectedIds.map((id) => {
        const item = cases.find((row) => row.id === id);
        return item ? Api.updateCase(id, caseUpdate(item, { enabled }, runEnvironment?.id)) : null;
      }));
      setSelected({});
      await refresh();
      toast(enabled === "N" ? "Disabled selected cases" : "Enabled selected cases");
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected case${selectedIds.length === 1 ? "" : "s"}?`)) {
      return;
    }
    try {
      await Promise.all(selectedIds.map((id) => Api.deleteCase(id, runEnvironment?.id)));
      setSelected({});
      await refresh();
      toast("Deleted selected cases");
    } catch (error) {
      toast(error.message, true);
    }
  }

  const authCue = selectedResult && !selectedResult.passed && selectedResult.actualStatus === 401
    && authCredentialsMissing(auth, runEnvironment?.authType);

  return (
    <div>
      <div className="topbar">
        <div>
          <h2>Cases{runEnvironment?.name ? ` · ${runEnvironment.name}` : ""}</h2>
          <p className="hint" style={{ marginTop: 6 }}>
            {loading && !cases.length
              ? "Loading cases…"
              : cases.length
              ? `${cases.length} case${cases.length === 1 ? "" : "s"} in ${runEnvironment?.name || "this plan"}. Click a row to add, update, or delete.`
              : spec?.manual
                ? "Add a REST API, or paste curl. Then save a test case."
                : "Open an operation on the left and save a case, or import from curl."}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setImportOpen(true)}>
            Import from curl
          </button>
          {cases.length ? (
            <>
              <button type="button" className="btn" onClick={() => navigate(`/s/${specId}/export`)}>
                Export
              </button>
              <button type="button" className="btn primary" onClick={runPlan} disabled={!!running}>
                {running === "plan" ? "Running…" : "Run plan"}
              </button>
            </>
          ) : null}
        </div>
      </div>
      <AuthSettings auth={auth} onChange={setAuth} environment={runEnvironment} />
      <LastRunsStrip specId={specId} planId={planId} refreshKey={historyKey} />
      {authCue ? (
        <div className="status-banner down" style={{ marginTop: 16 }}>
          API returned 401. Add run authentication if this endpoint needs login.
        </div>
      ) : null}
      {planSummary ? (
        <div className={`card run-result ${planSummary.allPassed ? "pass" : "fail"}`} style={{ marginTop: 16 }}>
          <div className="array-toolbar" style={{ marginBottom: 0 }}>
            <h3 style={{ margin: 0 }}>Plan run</h3>
            <div className="hint">
              {planSummary.passed} passed · {planSummary.failed} failed
              {planSummary.skipped ? ` · ${planSummary.skipped} skipped` : ""}
            </div>
          </div>
        </div>
      ) : null}
      <RunResultPanel result={selectedResult} />
      {loading && !cases.length ? (
        <div className="empty" style={{ marginTop: 16 }}>Loading cases…</div>
      ) : !cases.length ? (
        <div className="card start-card" style={{ marginTop: 16 }}>
          <h3>Get started</h3>
          <p className="empty" style={{ paddingTop: 0 }}>
            {spec?.manual && !operations.length
              ? "Add a REST API by method and path, then save a test case. Curl also creates the API if it is missing."
              : "Pick an operation in the sidebar, fill in request and expected response, then Save. Or import a saved collection from the home page."}
          </p>
          <div className="actions" style={{ marginTop: 14 }}>
            {onAddApi ? (
              <button type="button" className="btn primary" onClick={onAddApi}>
                Add API
              </button>
            ) : null}
            <button type="button" className={onAddApi ? "btn" : "btn primary"} onClick={() => setImportOpen(true)}>
              Import from curl
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="fill-bar">
            <input
              type="search"
              className="inline-search"
              placeholder="Filter by name or path"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
              <option value="">All methods</option>
              {methods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
            {selectedIds.length ? (
              <>
                <span className="hint">{selectedIds.length} selected</span>
                <button type="button" className="btn" onClick={() => bulkEnabled("N")}>Disable</button>
                <button type="button" className="btn" onClick={() => bulkEnabled("Y")}>Enable</button>
                <button type="button" className="btn danger" onClick={bulkDelete}>Delete</button>
              </>
            ) : null}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && visible.every((item) => selected[item.id])}
                    onChange={(event) => {
                      const next = { ...selected };
                      visible.forEach((item) => {
                        next[item.id] = event.target.checked;
                      });
                      setSelected(next);
                    }}
                  />
                </th>
                {["Name", "Method", "Endpoint", "Group", "Status", "On", "Result", ""].map((text) => <th key={text}>{text}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={item.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/s/${specId}/op/${encodeURIComponent(item.operationKey)}/case/${item.id}`)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!selected[item.id]}
                      onChange={(event) => setSelected((current) => ({ ...current, [item.id]: event.target.checked }))}
                    />
                  </td>
                  <td>
                    {item.testName}
                  </td>
                  <td>{item.method}</td>
                  <td>{item.endpoint}</td>
                  <td>{item.testGroup}</td>
                  <td>{item.statusCode}</td>
                  <td>{item.enabled === "N" ? "No" : "Yes"}</td>
                  <td onClick={(event) => {
                    event.stopPropagation();
                    if (runById[item.id]) setSelectedResult(runById[item.id]);
                  }}>
                    {resultBadge(runById[item.id])}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      disabled={!!running}
                      onClick={(event) => runOne(item.id, event)}
                    >
                      {running === item.id ? "Running…" : "Run"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? <div className="empty">No cases match this filter.</div> : null}
        </div>
      )}
      {importOpen ? (
        <ImportCurlModal
          operations={operations}
          allowCreate
          onClose={() => setImportOpen(false)}
          onImport={async (parsed, match) => {
            try {
              await importCurlAsCase(parsed, match);
              setImportOpen(false);
            } catch (error) {
              toast(error.message, true);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function caseUpdate(item, patch, environmentId) {
  return {
    specId: item.specId,
    planId: item.planId,
    operationKey: item.operationKey,
    testName: item.testName,
    pathParams: item.pathParams,
    queryParams: item.queryParams,
    headers: item.headers,
    requestBody: item.requestBody,
    statusCode: item.statusCode,
    responseType: item.responseType,
    expectedResponse: item.expectedResponse,
    enabled: item.enabled,
    testGroup: item.testGroup,
    jsonPathAssertions: item.jsonPathAssertions,
    extracts: item.extracts,
    maxResponseTimeMs: item.maxResponseTimeMs,
    contentType: item.contentType,
    baseUrl: item.baseUrl,
    environmentId,
    ...patch
  };
}
