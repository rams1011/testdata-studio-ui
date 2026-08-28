import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import AuthSettings, { useSpecAuth } from "../components/AuthSettings";
import RunResultPanel, { resultBadge } from "../components/RunResultPanel";
import { useToast } from "../components/Toast";

export default function CasesPage() {
  const { specId } = useParams();
  const { spec, plan, planId, reloadPlans } = useOutletContext();
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

  useEffect(() => {
    if (!planId) return;
    Api.listCases(specId, undefined, planId).then(setCases).catch((error) => toast(error.message, true));
    setRunById({});
    setSelectedResult(null);
    setPlanSummary(null);
  }, [specId, planId, toast]);

  async function generate() {
    if (!includePositive && !includeNegative) {
      toast("Select positive or negative cases to generate", true);
      return;
    }
    const planName = plan?.name || "this plan";
    const confirmed = window.confirm(
      `Generate ${includePositive ? "positive" : ""}${includePositive && includeNegative ? " and " : ""}${includeNegative ? "negative" : ""} cases for all operations into ${planName}? Existing case names will be skipped.`
    );
    if (!confirmed) return;
    try {
      const result = await Api.generateCases({
        specId,
        planId,
        includePositive,
        includeNegative
      });
      setCases(await Api.listCases(specId, undefined, planId));
      toast(generateToast(result));
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function generatePlans() {
    try {
      const result = await Api.generatePlans({
        specId,
        includeNegative: includeNegativePlan
      });
      await reloadPlans(result.smokePlan.id);
      setCases(await Api.listCases(specId, undefined, result.smokePlan.id));
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
      const result = await Api.runCase(id, auth);
      remember(result);
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
      const result = await Api.runPlan({ specId, planId, auth });
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
      toast(message, !result.allPassed);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="crumb">{spec.title}{plan?.name ? ` · ${plan.name}` : ""}</div>
          <h2>Saved test cases</h2>
        </div>
        <div className="actions">
          <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={includeNegativePlan} onChange={(event) => setIncludeNegativePlan(event.target.checked)} />
            Also Negative
          </label>
          <button type="button" className="btn primary" onClick={generatePlans}>Generate Smoke plan</button>
          <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={includePositive} onChange={(event) => setIncludePositive(event.target.checked)} />
            Positive
          </label>
          <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={includeNegative} onChange={(event) => setIncludeNegative(event.target.checked)} />
            Negative
          </label>
          <button type="button" className="btn" onClick={generate}>Fill this plan</button>
          <button type="button" className="btn" onClick={runPlan} disabled={!!running || !cases.length}>
            {running === "plan" ? "Running…" : "Run plan"}
          </button>
        </div>
      </div>
      <AuthSettings auth={auth} onChange={setAuth} />
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
        <div className="card" style={{ marginTop: 16 }}>
          <div className="empty">No saved cases in this plan yet. Generate a Smoke plan from all operations, or save a case from an operation page.</div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                {["Name", "Method", "Endpoint", "Group", "Status", "Result", ""].map((text) => <th key={text}>{text}</th>)}
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr
                  key={item.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/s/${specId}/op/${encodeURIComponent(item.operationKey)}/case/${item.id}`)}
                >
                  <td>{item.testName}</td>
                  <td>{item.method}</td>
                  <td>{item.endpoint}</td>
                  <td>{item.testGroup}</td>
                  <td>{item.statusCode}</td>
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
        </div>
      )}
    </div>
  );
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

