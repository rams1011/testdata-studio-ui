import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import RequestBodyEditor from "../components/RequestBodyEditor";
import JsonPathAssertionsPicker from "../components/JsonPathAssertionsPicker";
import ExpectedResponseEditor from "../components/ExpectedResponseEditor";
import AuthSettings, { emptyAuth, useSpecAuth } from "../components/AuthSettings";
import LastRunsStrip from "../components/LastRunsStrip";
import RunResultPanel from "../components/RunResultPanel";
import Collapsible from "../components/Collapsible";
import StatusCodeField from "../components/StatusCodeField";
import { useToast } from "../components/Toast";
import { emptyFromSchema, hasResponseBodySchema, typeWatermark } from "../schema";
import { isXmlContentType, looksLikeXml, xmlToJson } from "../xml";
import { allowedStatusCodes, statusLabel } from "../httpStatus";
import { generateToast } from "./CasesPage";
import { lastOpKey } from "./StudioLayout";

export default function OperationPage() {
  const { specId, operationKey, caseId } = useParams();
  const { spec, planId } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [operation, setOperation] = useState(null);
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState(null);
  const [requestBody, setRequestBody] = useState({});
  const [boundCaseId, setBoundCaseId] = useState(caseId);
  const [auth, setAuth] = useSpecAuth(specId);
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const baseline = useRef("");
  const skipUnsavedPrompt = useRef(false);
  const [, setCleanNonce] = useState(0);

  useEffect(() => {
    sessionStorage.setItem(lastOpKey(specId), operationKey);
  }, [specId, operationKey]);

  useEffect(() => {
    setBoundCaseId(caseId);
    skipUnsavedPrompt.current = false;
  }, [caseId]);

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
      nextForm.contentType = matchedContentType(nextForm.contentType, nextOperation.requestContentTypes)
        || nextForm.contentType;
      const nextBody = decodeRequestBody(
        existing?.requestBody
          ?? emptyFromSchema(nextOperation.requestBody?.jsonSchema) ?? {},
        nextOperation.requestBody?.jsonSchema,
        nextForm.contentType
      );
      setForm(nextForm);
      setRequestBody(nextBody);
      setRunResult(null);
      baseline.current = snapshot(nextForm, nextBody);
    }).catch((error) => toast(error.message, true));
    return () => { cancelled = true; };
  }, [specId, operationKey, caseId, spec, planId, toast, navigate]);

  const dirty = form ? snapshot(form, requestBody) !== baseline.current : false;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skipUnsavedPrompt.current) {
      return false;
    }
    return dirty && currentLocation.pathname !== nextLocation.pathname;
  });

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

  useEffect(() => {
    const suggested = operation?.auth;
    if (!suggested || !suggested.type || suggested.type === "NONE") {
      return;
    }
    setAuth((current) => {
      if (current?.type && current.type !== "NONE") {
        return current;
      }
      return {
        ...emptyAuth(),
        ...current,
        type: suggested.type,
        apiKeyName: suggested.apiKeyName || current?.apiKeyName || "X-API-Key",
        apiKeyIn: suggested.apiKeyIn || current?.apiKeyIn || "header",
        tokenUrl: suggested.tokenUrl || current?.tokenUrl || "",
        grantType: suggested.grantType || current?.grantType || "client_credentials"
      };
    });
  }, [operation?.key]);

  const paramGroups = useMemo(() => {
    if (!operation) return { path: [], query: [], header: [], cookie: [] };
    return {
      path: (operation.parameters || []).filter((item) => item.in === "path"),
      query: (operation.parameters || []).filter((item) => item.in === "query"),
      header: (operation.parameters || []).filter((item) => item.in === "header"),
      cookie: (operation.parameters || []).filter((item) => item.in === "cookie")
    };
  }, [operation]);

  const statusOptions = useMemo(() => {
    if (!operation) return [];
    return allowedStatusCodes(operation, form?.statusCode).map((code) => ({
      value: String(code),
      label: statusLabel(code)
    }));
  }, [operation, form?.statusCode]);

  function markClean(nextForm, nextBody) {
    baseline.current = snapshot(nextForm, nextBody);
    setCleanNonce((value) => value + 1);
  }

  async function save() {
    const payload = casePayload();
    try {
      const saved = boundCaseId
        ? await Api.updateCase(boundCaseId, payload)
        : await Api.createCase(payload);
      markClean(form, requestBody);
      setBoundCaseId(saved.id);
      toast(boundCaseId ? "Test case updated" : "Test case saved");
      const nextPath = `/s/${specId}/op/${encodeURIComponent(operation.key)}/case/${saved.id}`;
      if (caseId !== saved.id) {
        skipUnsavedPrompt.current = true;
        navigate(nextPath);
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function ensureCase() {
    if (boundCaseId) {
      return boundCaseId;
    }
    const saved = await Api.createCase(casePayload());
    setBoundCaseId(saved.id);
    markClean(form, requestBody);
    return saved.id;
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
      setHistoryKey((value) => value + 1);
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
      setHistoryKey((value) => value + 1);
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

  const tryRequestBlockers = useMemo(
    () => (form && operation ? draftRunBlockers(form, operation) : ["Form is still loading"]),
    [form, operation]
  );

  if (!operation || !form) {
    return <div className="empty">Loading operation schema…</div>;
  }

  const authCue = runResult && !runResult.passed && runResult.actualStatus === 401 && (auth?.type || "NONE") === "NONE";

  return (
    <div className="op-page">
      <div className="topbar sticky-actions">
        <div>
          <div className="crumb">{operation.tag} · {operation.key}</div>
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
          <button type="button" className="btn primary" onClick={save}>
            {boundCaseId ? "Update" : "Save"}
          </button>
        </div>
      </div>
      {operation.description ? <p className="crumb">{operation.description}</p> : null}
      {authCue ? (
        <div className="status-banner down">API returned 401. Add run authentication if this endpoint needs login.</div>
      ) : null}

      <div className="grid">
        <div>
          <AuthSettings auth={auth} onChange={setAuth} specAuth={operation.auth} />

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Test case</h3>
            <Field label="Test name" value={form.testName} onChange={(testName) => setForm({ ...form, testName })} />
            <div className="row-2">
              <Field label="Test group" value={form.testGroup} onChange={(testGroup) => setForm({ ...form, testGroup })} />
              <SelectField label="Enabled" value={form.enabled} options={["Y", "N"]} onChange={(enabled) => setForm({ ...form, enabled })} />
            </div>
            {(operation.servers || spec.servers || []).length > 1 ? (
              <SelectField
                label="Server"
                value={form.baseUrl}
                options={(operation.servers || spec.servers).map((server) => {
                  const url = server.resolvedUrl || server.url;
                  return {
                    value: url,
                    label: server.description ? `${server.description} · ${url}` : url
                  };
                })}
                onChange={(baseUrl) => setForm({ ...form, baseUrl })}
              />
            ) : null}
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
            {(operation.requestContentTypes || []).length > 0 ? (
              <SelectField
                label="Content type"
                value={matchedContentType(form.contentType, operation.requestContentTypes)}
                options={operation.requestContentTypes.map((item) => ({
                  value: item,
                  label: item
                }))}
                onChange={(contentType) => setForm({ ...form, contentType })}
              />
            ) : (
              <Field
                label="Content type"
                hint="Leave blank if none"
                value={blankNa(form.contentType)}
                onChange={(contentType) => setForm({ ...form, contentType })}
              />
            )}
          </div>

          {operation.parameters?.length ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Parameters</h3>
              <ParamGroup label="Path" parameters={paramGroups.path} values={form.pathParams} onChange={(pathParams) => setForm({ ...form, pathParams })} />
              <ParamGroup label="Query" parameters={paramGroups.query} values={form.queryParams} onChange={(queryParams) => setForm({ ...form, queryParams })} />
              <ParamGroup label="Headers" parameters={paramGroups.header} values={form.headers} onChange={(headers) => setForm({ ...form, headers })} />
              <ParamGroup label="Cookies" parameters={paramGroups.cookie} values={form.cookieParams} onChange={(cookieParams) => setForm({ ...form, cookieParams })} />
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Request body</h3>
            {operation.requestBody ? (
              <RequestBodyEditor
                key={`${operationKey}-${caseId || "new"}`}
                resetKey={`${operationKey}-${caseId || "new"}`}
                caseId={boundCaseId}
                onEnsureCase={ensureCase}
                schema={operation.requestBody.jsonSchema}
                value={requestBody}
                onChange={setRequestBody}
                contentType={form.contentType}
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
              contentType={operation.response?.contentType || form.contentType}
              onBuilt={() => setForm((current) => ({
                ...current,
                responseType: current.responseType === "NONE"
                  ? (isXmlContentType(operation.response?.contentType) ? "STRING" : "JSON")
                  : current.responseType
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

          <div className="try-request">
            <button
              type="button"
              className="btn"
              onClick={runCurrent}
              disabled={!!running || tryRequestBlockers.length > 0}
              title={tryRequestBlockers[0] || "Send the current form without saving"}
            >
              {running === "current" ? "Trying…" : "Try this request"}
            </button>
            <p className="hint">
              {tryRequestBlockers.length
                ? tryRequestBlockers.join(". ") + "."
                : "Sends the form as-is. It does not save the case."}
            </p>
          </div>
        </div>

        <div>
          <LastRunsStrip
            specId={specId}
            planId={planId}
            caseId={boundCaseId || undefined}
            refreshKey={historyKey}
          />
          <RunResultPanel result={runResult} />
          <div className="card saved-case-list" style={{ marginTop: 16 }}>
            <h3>Saved for this operation</h3>
            {!cases.length ? (
              <div className="empty">
                No cases yet. Generate for this operation, or Save the form.
              </div>
            ) : cases.map((item) => (
              <div className="array-item" key={item.id}>
                <div className="array-toolbar">
                  <div className="saved-case-meta">
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

function draftRunBlockers(form, operation) {
  const reasons = [];
  if (!String(form.baseUrl || "").trim()) {
    reasons.push("Set a base URL before trying the request");
  }
  const missingPath = (operation.parameters || [])
    .filter((parameter) => parameter.in === "path")
    .filter((parameter) => !String(form.pathParams?.[parameter.name] || "").trim())
    .map((parameter) => parameter.name);
  if (missingPath.length) {
    reasons.push(`Fill required path params: ${missingPath.join(", ")}`);
  }
  return reasons;
}

function snapshot(form, requestBody) {
  return JSON.stringify({ form, requestBody });
}

function decodeRequestBody(body, schema, contentType) {
  if (isXmlContentType(contentType) && looksLikeXml(body)) {
    return xmlToJson(body, schema) ?? body;
  }
  return body;
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
    headers: mapParams(operation.parameters, "header"),
    cookieParams: mapParams(operation.parameters, "cookie")
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
    headers: testCase.headers || {},
    cookieParams: testCase.cookieParams || {}
  };
}

function mapParams(parameters, location) {
  const result = {};
  (parameters || [])
    .filter((parameter) => parameter.in === location)
    .forEach((parameter) => {
      result[parameter.name] = "";
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
        isArrayParam(parameter) ? (
          <ArrayParamField
            key={parameter.name}
            parameter={parameter}
            values={values}
            onChange={onChange}
          />
        ) : (
          <div className="field" key={parameter.name}>
            <label>
              {parameter.name}{parameter.required ? " *" : ""}
              {parameter.description ? <span className="hint">{parameter.description}</span> : null}
            </label>
            <input
              value={values[parameter.name] || ""}
              placeholder={typeWatermark(parameter.schema)}
              onChange={(event) => onChange({ ...values, [parameter.name]: event.target.value })}
            />
          </div>
        )
      ))}
    </>
  );
}

function ArrayParamField({ parameter, values, onChange }) {
  const items = parseListValue(values[parameter.name]);
  return (
    <div className="field">
      <label>
        {parameter.name}{parameter.required ? " *" : ""}
        <span className="hint">{parameter.description || "Array — repeated query/header values"}</span>
      </label>
      {items.map((item, index) => (
        <div className="array-item" key={index} style={{ marginBottom: 6 }}>
          <input
            value={item}
            placeholder={typeWatermark(parameter.schema?.items || parameter.schema)}
            onChange={(event) => {
              const next = [...items];
              next[index] = event.target.value;
              onChange({ ...values, [parameter.name]: serializeListValue(next) });
            }}
          />
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              const next = items.filter((_, i) => i !== index);
              onChange({ ...values, [parameter.name]: serializeListValue(next.length ? next : [""]) });
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => onChange({ ...values, [parameter.name]: serializeListValue([...items, ""]) })}
      >
        Add value
      </button>
    </div>
  );
}

function isArrayParam(parameter) {
  const type = parameter?.schema?.type;
  return type === "array" || (Array.isArray(type) && type.includes("array"));
}

function parseListValue(raw) {
  if (raw == null || raw === "") {
    return [""];
  }
  const text = String(raw).trim();
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (item == null ? "" : String(item)));
      }
    } catch {
      // scalar
    }
  }
  return [String(raw)];
}

function serializeListValue(values) {
  const cleaned = (values || []).map((item) => String(item ?? ""));
  if (cleaned.length <= 1) {
    return cleaned[0] || "";
  }
  return JSON.stringify(cleaned);
}

function mappedContentType(mediaType) {
  const value = String(mediaType || "").toLowerCase();
  if (value.includes("json")) return "JSON";
  if (value.includes("multipart")) return "MULTIPART";
  if (value.includes("urlencoded")) return "FORM";
  if (isXmlContentType(mediaType)) return "XML";
  if (value.startsWith("text/")) return "TEXT";
  return mediaType;
}

function matchedContentType(current, types) {
  const list = types || [];
  if (list.includes(current)) {
    return current;
  }
  const mapped = mappedContentType(current);
  const hit = list.find((item) => mappedContentType(item) === mapped || mappedContentType(item) === current);
  return hit || current || "";
}
