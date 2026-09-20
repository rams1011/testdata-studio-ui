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
  const { plan, planId, operations, spec, reloadPlans, reloadCases, onAddApi, importCurlAsCase, runEnvironment } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cases, setCases] = useState([]);
  const [includePositive, setIncludePositive] = useState(true);
  const [includeNegative, setIncludeNegative] = useState(true);
  const [includeNegativePlan, setIncludeNegativePlan] = useState(true);
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
    if (!planId) return;
    Api.listCases(specId, undefined, planId, runEnvironment?.id).then(setCases).catch((error) => toast(error.message, true));
    setRunById({});
    setSelectedResult(null);
    setPlanSummary(null);
    setSelected({});
  }, [specId, planId, toast, runEnvironment?.id]);

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

  async function generate() {
    if (!includePositive && !includeNegative) {
      toast("Select positive or negative cases to generate", true);
      return;
    }
    const planName = plan?.name || "this plan";
    const envName = runEnvironment?.name || "the current environment";
    const confirmed = window.confirm(
      `Generate ${includePositive ? "positive" : ""}${includePositive && includeNegative ? " and " : ""}${includeNegative ? "negative" : ""} cases for all operations into ${planName} (${envName})? Existing case names in this environment will be skipped.`
    );
    if (!confirmed) return;
    try {
      const result = await Api.generateCases({
        specId,
        planId,
        includePositive,
        includeNegative,
        environmentId: runEnvironment?.id
      });
      await refresh();
      toast(generateToast(result));
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function generatePlans() {
    try {
      const result = await Api.generatePlans({
        specId,
        includeNegative: includeNegativePlan,
        environmentId: runEnvironment?.id
      });
      await reloadPlans(result.smokePlan.id);
      setCases(await Api.listCases(specId, undefined, result.smokePlan.id, runEnvironment?.id));
      toast(generatePlansToast(result));
    } catch (error) {
      toast(error.message, true);
    }
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
        return item ? Api.updateCase(id, caseUpdate(item, { enabled })) : null;
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
      await Promise.all(selectedIds.map((id) => Api.deleteCase(id)));
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
            {cases.length
              ? `${cases.length} case${cases.length === 1 ? "" : "s"} in ${runEnvironment?.name || "this plan"}. Click a row to add, update, or delete.`
              : spec?.manual
                ? "Add a REST API, or paste curl. Then save a test case."
                : "Create starter cases, or open an operation on the left and save one by hand."}
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
      {!cases.length ? (
        <div className="card start-card" style={{ marginTop: 16 }}>
          <h3>Get started</h3>
          <p className="empty" style={{ paddingTop: 0 }}>
            {spec?.manual && !operations.length
              ? "Add a REST API by method and path, then save a test case. Curl also creates the API if it is missing."
              : "Create one happy-path case per operation. Existing case names are skipped."}
          </p>
          {spec?.manual && !operations.length ? null : (
          <label className="check">
            <input
              type="checkbox"
              checked={includeNegativePlan}
              onChange={(event) => setIncludeNegativePlan(event.target.checked)}
            />
            Also create a Negative plan
          </label>
          )}
          <div className="actions" style={{ marginTop: 14 }}>
            {onAddApi ? (
              <button type="button" className="btn primary" onClick={onAddApi}>
                Add API
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => setImportOpen(true)}>
              Import from curl
            </button>
            {operations.length ? (
              <button type="button" className={onAddApi ? "btn" : "btn primary"} onClick={generatePlans}>
                Create starter cases
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="fill-bar">
            <span className="hint">Generate more cases for every operation in this environment (duplicates skipped)</span>
            <label className="check">
              <input type="checkbox" checked={includePositive} onChange={(event) => setIncludePositive(event.target.checked)} />
              Positive
            </label>
            <label className="check">
              <input type="checkbox" checked={includeNegative} onChange={(event) => setIncludeNegative(event.target.checked)} />
              Negative
            </label>
            <button type="button" className="btn" onClick={generate}>Generate</button>
          </div>
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

function caseUpdate(item, patch) {
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
    environments: item.environments,
    ...patch
  };
}

export function generateToast(result) {
  const created = result?.created ?? 0;
  const skipped = result?.skipped ?? 0;
  if (created === 0 && skipped === 0) {
    return "No cases were generated from this schema";
  }
  if (created === 0) {
    return `No new cases (${skipped} already exist)`;
  }
  return skipped
    ? `Created ${created} cases (${skipped} skipped as duplicates)`
    : `Created ${created} cases`;
}

export function generatePlansToast(result) {
  const smokeName = result?.smokePlan?.name || "Smoke";
  const smokeCreated = result?.smoke?.created ?? 0;
  const smokeSkipped = result?.smoke?.skipped ?? 0;
  let message = `${smokeName}: ${smokeCreated} happy-path cases`;
  if (smokeSkipped) {
    message += ` (${smokeSkipped} skipped)`;
  }
  if (result?.negativePlan) {
    const negativeCreated = result?.negative?.created ?? 0;
    const negativeSkipped = result?.negative?.skipped ?? 0;
    message += `. ${result.negativePlan.name}: ${negativeCreated} negative cases`;
    if (negativeSkipped) {
      message += ` (${negativeSkipped} skipped)`;
    }
  }
  return message;
}
