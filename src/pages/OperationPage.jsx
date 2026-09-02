import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import RequestBodyEditor from "../components/RequestBodyEditor";
import JsonPathAssertionsPicker from "../components/JsonPathAssertionsPicker";
import ExpectedResponseEditor from "../components/ExpectedResponseEditor";
import AuthSettings, { useSpecAuth } from "../components/AuthSettings";
import RunResultPanel from "../components/RunResultPanel";
import Collapsible from "../components/Collapsible";
import StatusCodeField from "../components/StatusCodeField";
import { useToast } from "../components/Toast";
import { hasResponseBodySchema, sampleFromSchema } from "../schema";
import { allowedStatusCodes, statusLabel } from "../httpStatus";
import { generateToast } from "./CasesPage";
import { lastOpKey } from "./StudioLayout";

export default function OperationPage() {
  const { specId, operationKey, caseId } = useParams();
  const { spec, plan, planId } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [operation, setOperation] = useState(null);
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState(null);
  const [requestBody, setRequestBody] = useState({});
  const [auth, setAuth] = useSpecAuth(specId);
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(null);
  const baseline = useRef("");

  useEffect(() => {
    sessionStorage.setItem(lastOpKey(specId), operationKey);
  }, [specId, operationKey]);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    Promise.all([
      Api.getOperation(specId, operationKey),
      Api.listCases(specId, operationKey, planId)
    ]).then(([nextOperation, nextCases]) => {
      if (cancelled) return;
      const existing = caseId ? nextCases.find((item) => item.id === caseId) : null;
      if (caseId && !existing) {
        navigate(`/s/${specId}/op/${encodeURIComponent(operationKey)}`, { replace: true });
        return;
      }
      setOperation(nextOperation);
      setCases(nextCases);
      const nextForm = existing ? formFromCase(existing) : formFromOperation(nextOperation, spec);
      const nextBody = existing?.requestBody
        ?? sampleFromSchema(nextOperation.requestBody?.jsonSchema, "", { emptyArrays: true });
      setForm(nextForm);
      setRequestBody(nextBody);
      setRunResult(null);
      baseline.current = snapshot(nextForm, nextBody);
    }).catch((error) => toast(error.message, true));
    return () => { cancelled = true; };
  }, [specId, operationKey, caseId, spec, planId, toast, navigate]);

  const dirty = form ? snapshot(form, requestBody) !== baseline.current : false;
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Discard unsaved changes?")) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  useEffect(() => {
    function onLeave(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const paramGroups = useMemo(() => {
    if (!operation) return { path: [], query: [], header: [] };
    return {
      path: (operation.parameters || []).filter((item) => item.in === "path"),
      query: (operation.parameters || []).filter((item) => item.in === "query"),
      header: (operation.parameters || []).filter((item) => item.in === "header")
    };
  }, [operation]);

  const statusOptions = useMemo(() => {
    if (!operation) return [];
    return allowedStatusCodes(operation, form?.statusCode).map((code) => ({
      value: String(code),
      label: statusLabel(code)
    }));
  }, [operation, form?.statusCode]);

  async function save() {
    const payload = casePayload();
    try {
      const saved = caseId
        ? await Api.updateCase(caseId, payload)
        : await Api.createCase(payload);
      baseline.current = snapshot(form, requestBody);
      toast(caseId ? "Test case updated" : "Test case saved");
      navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}/case/${saved.id}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  function casePayload() {
    return {
      specId,
      planId,
      operationKey: operation.key,
      ...form,
      expectedResponse: form.expectedResponse || "NA",
      jsonPathAssertions: form.jsonPathAssertions || "NA",
      contentType: form.contentType || "NA",
      statusCode: Number(form.statusCode),
      maxResponseTimeMs: Number(form.maxResponseTimeMs),
      requestBody: operation.requestBody ? requestBody : null
    };
  }

  async function runCurrent() {
    setRunning("current");
    try {
      const result = await Api.runDraft({ testCase: casePayload(), auth });
      setRunResult(result);
      toast(result.passed ? "Passed" : (result.error || "Failed"), !result.passed);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setRunning(null);
    }
  }

  async function runSaved(id) {
    setRunning(id);
    try {
      const result = await Api.runCase(id, auth);
      setRunResult(result);
      toast(result.passed ? "Passed" : (result.error || "Failed"), !result.passed);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setRunning(null);
    }
  }

  async function generate() {
    try {
      const result = await Api.generateCases({
        specId,
        planId,
        operationKey: operation.key,
        includePositive: true,
        includeNegative: true
      });
      setCases(await Api.listCases(specId, operationKey, planId));
      toast(generateToast(result));
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function remove(id) {
    try {
      await Api.deleteCase(id);
      toast("Test case deleted");
      if (id === caseId) {
        navigate(`/s/${specId}/op/${encodeURIComponent(operationKey)}`);
      } else {
        setCases(await Api.listCases(specId, operationKey, planId));
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (form && operation) save();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form, operation, caseId]);

  if (!operation || !form) {
    return <div className="empty">Loading operation schema…</div>;
  }

  const authCue = runResult && !runResult.passed && runResult.actualStatus === 401 && (auth?.type || "NONE") === "NONE";

  return (
    <div className="op-page">
      <div className="topbar sticky-actions">
        <div>
          <div className="crumb">{plan?.name ? `${plan.name} · ` : ""}{operation.tag} · {operation.key}</div>
          <h2>{operation.summary || operation.key}</h2>
          <div className="crumb">
            <span className={`method ${operation.method}`}>{operation.method}</span>
            {"  "}
            {operation.path}
            {dirty ? " · unsaved" : ""}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={generate}>
            Generate for this operation
          </button>
          <button type="button" className="btn" onClick={() => navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}`)}>
            New case
          </button>
          <button type="button" className="btn" onClick={runCurrent} disabled={!!running}>
            {running === "current" ? "Running…" : "Run"}
          </button>
          <button type="button" className="btn primary" onClick={save}>
            {caseId ? "Update" : "Save"}
          </button>
        </div>
      </div>
      {operation.description ? <p className="crumb">{operation.description}</p> : null}
      {authCue ? (
        <div className="status-banner down">API returned 401. Add run authentication if this endpoint needs login.</div>
      ) : null}

      <div className="grid">
        <div>
          <AuthSettings auth={auth} onChange={setAuth} />

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Test case</h3>
            <Field label="Test name" value={form.testName} onChange={(testName) => setForm({ ...form, testName })} />
            <div className="row-2">
              <Field label="Test group" value={form.testGroup} onChange={(testGroup) => setForm({ ...form, testGroup })} />
              <SelectField label="Enabled" value={form.enabled} options={["Y", "N"]} onChange={(enabled) => setForm({ ...form, enabled })} />
            </div>
            <Field label="Base URL" value={form.baseUrl} onChange={(baseUrl) => setForm({ ...form, baseUrl })} />
            <div className="row-3">
              <StatusCodeField
                value={form.statusCode}
                options={statusOptions}
                onChange={(statusCode) => setForm({ ...form, statusCode })}
              />
              <SelectField
                label="Response type"
                value={form.responseType}
                options={["JSON", "NONE", "STRING", "FILE"]}
                onChange={(responseType) => setForm({ ...form, responseType })}
              />
              <Field label="Max response ms" type="number" value={form.maxResponseTimeMs} onChange={(maxResponseTimeMs) => setForm({ ...form, maxResponseTimeMs })} />
            </div>
            <Field
              label="Content type"
              hint="Leave blank if none"
              value={blankNa(form.contentType)}
              onChange={(contentType) => setForm({ ...form, contentType })}
            />
          </div>

          {operation.parameters?.length ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Parameters</h3>
              <ParamGroup label="Path" parameters={paramGroups.path} values={form.pathParams} onChange={(pathParams) => setForm({ ...form, pathParams })} />
              <ParamGroup label="Query" parameters={paramGroups.query} values={form.queryParams} onChange={(queryParams) => setForm({ ...form, queryParams })} />
              <ParamGroup label="Headers" parameters={paramGroups.header} values={form.headers} onChange={(headers) => setForm({ ...form, headers })} />
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Request body</h3>
            {operation.requestBody ? (
              <RequestBodyEditor
                key={`${operationKey}-${caseId || "new"}`}
                resetKey={`${operationKey}-${caseId || "new"}`}
                schema={operation.requestBody.jsonSchema}
                value={requestBody}
                onChange={setRequestBody}
              />
            ) : (
              <div className="empty">This operation has no request body.</div>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Expected response</h3>
            <ExpectedResponseEditor
              key={`${operationKey}-${caseId || "new"}-expected`}
              resetKey={`${operationKey}-${caseId || "new"}`}
              schema={hasResponseBodySchema(operation.response) ? operation.response.jsonSchema : null}
              sample={hasResponseBodySchema(operation.response) ? operation.response.sample : null}
              value={form.expectedResponse}
              onChange={(expectedResponse) => setForm((current) => ({ ...current, expectedResponse }))}
              onBuilt={() => setForm((current) => ({
                ...current,
                responseType: current.responseType === "NONE" ? "JSON" : current.responseType
              }))}
            />
          </div>

          <Collapsible title="JSONPath assertions" hint="Off until you pick paths">
            <JsonPathAssertionsPicker
              schema={hasResponseBodySchema(operation.response) ? operation.response.jsonSchema : null}
              expectedResponse={form.expectedResponse}
              value={form.jsonPathAssertions}
              onChange={(jsonPathAssertions) => setForm((current) => ({ ...current, jsonPathAssertions }))}
            />
          </Collapsible>
        </div>

        <div>
          <RunResultPanel result={runResult} />
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Saved for this operation</h3>
            {!cases.length ? (
              <div className="empty">
                No cases yet. Generate for this operation, or Save the form.
              </div>
            ) : cases.map((item) => (
              <div className="array-item" key={item.id}>
                <div className="array-toolbar">
                  <div>
                    <strong>{item.testName}</strong>
                    <div className="hint">{item.method} {item.endpoint}</div>
                  </div>
                  <div className="inline-actions">
                    <button type="button" className="btn" onClick={() => runSaved(item.id)} disabled={!!running}>
                      {running === item.id ? "Running…" : "Run"}
                    </button>
                    <button type="button" className="btn" onClick={() => navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}/case/${item.id}`)}>
                      Edit
                    </button>
                    <button type="button" className="btn danger" onClick={() => remove(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function snapshot(form, requestBody) {
  return JSON.stringify({ form, requestBody });
}

function blankNa(value) {
  if (value == null) return "";
  return String(value).trim().toUpperCase() === "NA" ? "" : value;
}

function formFromOperation(operation, spec) {
  const defaults = operation.defaults || {};
  const statusCode = operation.response ? operation.response.statusCode : 200;
  return {
    testName: `${operation.summary || operation.key} — ${statusCode}`,
    testGroup: defaults.testGroup || operation.tag || "generated",
    baseUrl: defaults.baseUrl || spec.baseUrl || "",
    enabled: defaults.enabled || "Y",
    statusCode,
    responseType: defaults.responseType && defaults.responseType !== "NA" ? defaults.responseType : "NONE",
    maxResponseTimeMs: defaults.maxResponseTimeMs || 3000,
    expectedResponse: "",
    jsonPathAssertions: "",
    contentType: blankNa(defaults.contentType),
    pathParams: mapParams(operation.parameters, "path"),
    queryParams: mapParams(operation.parameters, "query"),
    headers: mapParams(operation.parameters, "header")
  };
}

function formFromCase(testCase) {
  return {
    testName: testCase.testName || "",
    testGroup: testCase.testGroup || "",
    baseUrl: testCase.baseUrl || "",
    enabled: testCase.enabled || "Y",
    statusCode: testCase.statusCode,
    responseType: testCase.responseType && testCase.responseType !== "NA" ? testCase.responseType : "NONE",
    maxResponseTimeMs: testCase.maxResponseTimeMs || 3000,
    expectedResponse: blankNa(testCase.expectedResponse),
    jsonPathAssertions: blankNa(testCase.jsonPathAssertions),
    contentType: blankNa(testCase.contentType),
    pathParams: testCase.pathParams || {},
    queryParams: testCase.queryParams || {},
    headers: testCase.headers || {}
  };
}

function mapParams(parameters, location) {
  const result = {};
  (parameters || [])
    .filter((parameter) => parameter.in === location)
    .forEach((parameter) => {
      result[parameter.name] = parameter.sample || "";
    });
  return result;
}

function Field({ label, value, onChange, type = "text", hint }) {
  return (
    <div className="field">
      <label>
        {label}
        {hint ? <span className="hint">{hint}</span> : null}
      </label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const item = typeof option === "object" ? option : { value: option, label: option };
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </div>
  );
}

function ParamGroup({ label, parameters, values, onChange }) {
  if (!parameters.length) return null;
  return (
    <>
      <div className="tag-label" style={{ color: "#696969" }}>{label}</div>
      {parameters.map((parameter) => (
        <div className="field" key={parameter.name}>
          <label>
            {parameter.name}{parameter.required ? " *" : ""}
            {parameter.description ? <span className="hint">{parameter.description}</span> : null}
          </label>
          <input
            value={values[parameter.name] || ""}
            onChange={(event) => onChange({ ...values, [parameter.name]: event.target.value })}
          />
        </div>
      ))}
    </>
  );
}
