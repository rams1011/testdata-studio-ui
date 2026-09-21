import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import RequestBodyEditor from "../components/RequestBodyEditor";
import JsonPathAssertionsPicker from "../components/JsonPathAssertionsPicker";
import ExtractsPicker from "../components/ExtractsPicker";
import ExtractValueField, { PlanExtractsProvider } from "../components/ExtractValueField";
import ImportCurlModal from "../components/ImportCurlModal";
import ExpectedResponseEditor from "../components/ExpectedResponseEditor";
import AuthSettings, { authCredentialsMissing, useSpecAuth } from "../components/AuthSettings";
import LastRunsStrip from "../components/LastRunsStrip";
import RunResultPanel from "../components/RunResultPanel";
import Collapsible from "../components/Collapsible";
import StatusCodeField from "../components/StatusCodeField";
import { useToast } from "../components/Toast";
import { collectPlanExtracts, emptyFromSchema, hasResponseBodySchema, isEffectivelyEmpty, missingRequiredSchemaFields, typeWatermark } from "../schema";
import { isXmlContentType, looksLikeXml, xmlToJson } from "../xml";
import { allowedStatusCodes, statusLabel } from "../httpStatus";
import { generateToast } from "./CasesPage";
import { lastOpKey } from "./StudioLayout";
import { applyCurlImport } from "../curlImport";

export default function OperationPage() {
  const { specId, operationKey, caseId } = useParams();
  const { spec, planId, operations, importCurlAsCase, deleteManualOperation, onSpecUpdated, runEnvironment, envEpoch, onEnvironmentsChanged } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [operation, setOperation] = useState(null);
  const [cases, setCases] = useState([]);
  const [planCases, setPlanCases] = useState([]);
  const [form, setForm] = useState(null);
  const [requestBody, setRequestBody] = useState({});
  const [boundCaseId, setBoundCaseId] = useState(caseId);
  const [auth, setAuth] = useSpecAuth(specId);
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [duplicateTarget, setDuplicateTarget] = useState("");
  const baseline = useRef("");
  const skipUnsavedPrompt = useRef(false);
  const curlImportRef = useRef(location.state?.curlImport);
  const [, setCleanNonce] = useState(0);
  curlImportRef.current = location.state?.curlImport;

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
    const pendingImport = curlImportRef.current;
    Promise.all([
      Api.getOperation(specId, operationKey),
      Api.listCases(specId, null, planId, runEnvironment?.id)
    ]).then(([nextOperation, allCases]) => {
      if (cancelled) return;
      const nextCases = (allCases || []).filter((item) => item.operationKey === operationKey);
      const existing = caseId ? (allCases || []).find((item) => item.id === caseId) : null;
      if (caseId && !existing) {
        navigate(`/s/${specId}/op/${encodeURIComponent(operationKey)}`, { replace: true });
        return;
      }
      setOperation(nextOperation);
      setPlanCases(allCases || []);
      setCases(nextCases);
      const curlImport = !existing ? pendingImport : null;
      const blank = blankOperationCase(nextOperation, spec);
      let nextForm = existing ? formFromCase(existing) : blank.form;
      nextForm.contentType = matchedContentType(nextForm.contentType, nextOperation.requestContentTypes)
        || nextForm.contentType;
      let nextBody = existing
        ? decodeRequestBody(existing.requestBody, nextOperation.requestBody?.jsonSchema, nextForm.contentType)
        : blank.requestBody;
      if (curlImport) {
        const applied = applyCurlImport({
          form: blank.form,
          requestBody: blank.requestBody,
          operation: nextOperation,
          spec,
          parsed: curlImport
        });
        nextForm = applied.form;
        nextBody = applied.requestBody;
        if (applied.auth) {
          setAuth((current) => ({ ...current, ...applied.auth }));
        }
        toast("Imported curl into a new unsaved case");
      }
      setForm(nextForm);
      setRequestBody(nextBody);
      setRunResult(null);
      baseline.current = snapshot(curlImport ? blank.form : nextForm, curlImport ? blank.requestBody : nextBody);
      if (curlImport) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }).catch((error) => toast(error.message, true));
    return () => { cancelled = true; };
  }, [specId, operationKey, caseId, spec, planId, toast, navigate, location.pathname, runEnvironment?.id]);

  useEffect(() => {
    if (!specId) return;
    let cancelled = false;
    Api.listEnvironments(specId)
      .then((list) => {
        if (!cancelled) setEnvironments(list || []);
      })
      .catch(() => {
        if (!cancelled) setEnvironments([]);
      });
    return () => { cancelled = true; };
  }, [specId, envEpoch]);

  const otherEnvironments = useMemo(
    () => environments.filter((item) => item.id && item.id !== runEnvironment?.id),
    [environments, runEnvironment?.id]
  );

  useEffect(() => {
    setDuplicateTarget(otherEnvironments[0]?.id || "");
  }, [otherEnvironments]);

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
    setAuth((current) => ({
      ...current,
      apiKeyName: current?.apiKeyName || suggested.apiKeyName || "X-API-Key",
      apiKeyIn: current?.apiKeyIn || suggested.apiKeyIn || "header",
      tokenUrl: current?.tokenUrl || suggested.tokenUrl || "",
      grantType: current?.grantType || suggested.grantType || "client_credentials"
    }));
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

  const visibleParamGroups = useMemo(() => ({
    path: withImportedParams(paramGroups.path, form?.pathParams, "path"),
    query: withImportedParams(paramGroups.query, form?.queryParams, "query"),
    header: withImportedParams(paramGroups.header, form?.headers, "header"),
    cookie: withImportedParams(paramGroups.cookie, form?.cookieParams, "cookie")
  }), [paramGroups, form]);

  const showParameters = Object.values(visibleParamGroups).some((items) => items.length);

  const extractOptions = useMemo(
    () => collectPlanExtracts(planCases, boundCaseId),
    [planCases, boundCaseId]
  );

  const statusOptions = useMemo(() => {
    if (!operation) return [];
    return allowedStatusCodes(operation, form?.statusCode).map((code) => ({
      value: String(code),
      label: statusLabel(code)
    }));
  }, [operation, form?.statusCode]);

  function upsertCase(saved) {
    if (!saved?.id) {
      return;
    }
    setPlanCases((current) => mergeCase(current, saved));
    if (saved.operationKey === operationKey) {
      setCases((current) => mergeCase(current, saved));
    }
  }

  async function refreshPlanCases() {
    const all = await Api.listCases(specId, null, planId, runEnvironment?.id);
    setPlanCases(all || []);
    setCases((all || []).filter((item) => item.operationKey === operationKey));
  }

  function markClean(nextForm, nextBody) {
    baseline.current = snapshot(nextForm, nextBody);
    setCleanNonce((value) => value + 1);
  }

  function applyImportedCurl(parsed, op) {
    const blank = blankOperationCase(op, spec);
    const applied = applyCurlImport({
      form: blank.form,
      requestBody: blank.requestBody,
      operation: op,
      spec,
      parsed
    });
    setBoundCaseId(undefined);
    setForm(applied.form);
    setRequestBody(applied.requestBody);
    if (applied.auth) {
      setAuth((current) => ({ ...current, ...applied.auth }));
    }
    setRunResult(null);
    baseline.current = snapshot(blank.form, blank.requestBody);
    setCleanNonce((value) => value + 1);
    toast("Imported curl into a new unsaved case");
  }

  async function handleCurlImport(parsed, match) {
    skipUnsavedPrompt.current = true;
    try {
      if (match?.operation && location.pathname === `/s/${specId}/op/${encodeURIComponent(match.operation.key)}` && operation && !caseId) {
        setImportOpen(false);
        applyImportedCurl(parsed, operation);
        return;
      }
      await importCurlAsCase(parsed, match);
      setImportOpen(false);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function removeApi() {
    if (!operation) return;
    if (!window.confirm(`Remove ${operation.method} ${operation.path} from this catalog?\n\nSaved cases stay in the plan until you delete them.`)) {
      return;
    }
    try {
      skipUnsavedPrompt.current = true;
      await deleteManualOperation(operation.key);
      toast("API removed");
      navigate(`/s/${specId}/cases`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function save() {
    const payload = casePayload();
    try {
      const saved = boundCaseId
        ? await Api.updateCase(boundCaseId, payload)
        : await Api.createCase(payload);
      markClean(form, requestBody);
      setBoundCaseId(saved.id);
      upsertCase(saved);
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
    upsertCase(saved);
    return saved.id;
  }

  async function commitRequestBody(nextBody, savedCaseId) {
    setRequestBody(nextBody);
    const id = savedCaseId || boundCaseId;
    if (!id) {
      return;
    }
    try {
      const saved = await Api.updateCase(id, { ...casePayload(), requestBody: nextBody });
      upsertCase(saved);
      markClean(form, nextBody);
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
      extracts: form.extracts || "NA",
      contentType: form.contentType || "NA",
      statusCode: Number(form.statusCode),
      maxResponseTimeMs: Number(form.maxResponseTimeMs),
      requestBody: operation.requestBody ? requestBody : null,
      environmentId: runEnvironment?.id
    };
  }

  async function runCurrent() {
    setRunning("current");
    try {
      const result = await Api.runDraft({
        caseId: boundCaseId || undefined,
        testCase: casePayload(),
        auth,
        environmentId: runEnvironment?.id
      });
      setRunResult(result);
      setHistoryKey((value) => value + 1);
      toast(result.passed ? "Passed" : (result.error || "Failed"), !result.passed);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setRunning(null);
    }
  }

  async function duplicateInto() {
    if (dirty) {
      toast("Save this case before duplicating", true);
      return;
    }
    if (!boundCaseId || !duplicateTarget) {
      toast("Save the case before duplicating into another environment", true);
      return;
    }
    try {
      const copied = await Api.duplicateCase(boundCaseId, {
        fromEnvironmentId: runEnvironment?.id,
        toEnvironmentId: duplicateTarget
      });
      const target = environments.find((item) => item.id === duplicateTarget);
      sessionStorage.setItem(`testdata.env.${specId}`, duplicateTarget);
      await Api.applyEnvironment(specId, duplicateTarget);
      if (onSpecUpdated) {
        onSpecUpdated(await Api.getSpec(specId));
      }
      onEnvironmentsChanged?.();
      skipUnsavedPrompt.current = true;
      toast(`Created a copy in ${target?.name || "environment"}`);
      navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}/case/${copied.id}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function runSaved(id) {
    setRunning(id);
    try {
      const result = await Api.runCase(id, auth, runEnvironment?.id);
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
        includeNegative: true,
        environmentId: runEnvironment?.id
      });
      await refreshPlanCases();
      toast(generateToast(result));
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function remove(id) {
    if (!window.confirm(`Delete this case${runEnvironment?.name ? ` from ${runEnvironment.name}` : ""}?`)) {
      return;
    }
    try {
      await Api.deleteCase(id, runEnvironment?.id);
      toast("Test case deleted");
      if (id === caseId) {
        navigate(`/s/${specId}/op/${encodeURIComponent(operationKey)}`);
      } else {
        await refreshPlanCases();
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (form && operation && !caseSaveBlockers(form, operation, requestBody).length) {
          save();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form, operation, requestBody, caseId]);

  const tryRequestBlockers = useMemo(
    () => (form && operation ? draftRunBlockers(form, operation) : ["Form is still loading"]),
    [form, operation]
  );
  const saveBlockers = useMemo(
    () => (form && operation ? caseSaveBlockers(form, operation, requestBody) : ["Form is still loading"]),
    [form, operation, requestBody]
  );

  if (!operation || !form) {
    return <div className="empty">Loading operation schema…</div>;
  }

  const authCue = runResult && !runResult.passed && runResult.actualStatus === 401
    && authCredentialsMissing(auth, runEnvironment?.authType);

  return (
    <PlanExtractsProvider extracts={extractOptions}>
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
        <div className="topbar-actions">
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={runCurrent}
              disabled={!!running || tryRequestBlockers.length > 0}
              title={tryRequestBlockers[0] || "Send the current form without saving"}
            >
              {running === "current" ? "Trying…" : "Try this request"}
            </button>
            <button type="button" className="btn" onClick={generate}>
              Generate for this operation
            </button>
            <button type="button" className="btn" onClick={() => setImportOpen(true)}>
              Import from curl
            </button>
            <button type="button" className="btn" onClick={() => navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}`)}>
              New case
            </button>
            {spec?.manual ? (
              <button type="button" className="btn danger" onClick={removeApi}>
                Remove API
              </button>
            ) : null}
            <button
              type="button"
              className="btn primary"
              onClick={save}
              disabled={saveBlockers.length > 0}
              title={saveBlockers[0] || (boundCaseId ? "Update the saved case" : "Save the test case")}
            >
              {boundCaseId ? "Update" : "Save"}
            </button>
          </div>
          {saveBlockers.length ? (
            <p className="hint try-request-hint">{saveBlockers.join(". ")}.</p>
          ) : tryRequestBlockers.length ? (
            <p className="hint try-request-hint">{tryRequestBlockers.join(". ")}.</p>
          ) : null}
        </div>
      </div>
      {operation.description ? <p className="crumb">{operation.description}</p> : null}
      {authCue ? (
        <div className="status-banner down">API returned 401. Add run authentication if this endpoint needs login.</div>
      ) : null}
      {runEnvironment?.name ? (
        <div className="status-banner ok">
          Cases in <strong>{runEnvironment.name}</strong>. Save, update, and delete apply only here.
          {boundCaseId && otherEnvironments.length ? (
            <div className="actions" style={{ marginTop: 8 }}>
              <select value={duplicateTarget} onChange={(event) => setDuplicateTarget(event.target.value)}>
                {otherEnvironments.map((environment) => (
                  <option key={environment.id} value={environment.id}>{environment.name}</option>
                ))}
              </select>
              <button type="button" className="btn" onClick={duplicateInto}>
                Duplicate into {otherEnvironments.find((item) => item.id === duplicateTarget)?.name || "environment"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid">
        <div>
          <AuthSettings auth={auth} onChange={setAuth} specAuth={operation.auth} environment={runEnvironment} />

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Test case</h3>
            <Field label="Test name" required value={form.testName} onChange={(testName) => setForm({ ...form, testName })} />
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
            <Field label="Base URL" required value={form.baseUrl} onChange={(baseUrl) => setForm({ ...form, baseUrl })} />
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

          {showParameters ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Parameters</h3>
              <p className="hint">
                {extractOptions.length
                  ? "Choose an extracted field from an earlier case, or type a literal value."
                  : "No extracted fields in this plan yet. On another case, pick fields under Extract for later cases."}
              </p>
              <ParamGroup label="Path" parameters={visibleParamGroups.path} values={form.pathParams} onChange={(pathParams) => setForm({ ...form, pathParams })} />
              <ParamGroup label="Query" parameters={visibleParamGroups.query} values={form.queryParams} onChange={(queryParams) => setForm({ ...form, queryParams })} />
              <ParamGroup label="Headers" parameters={visibleParamGroups.header} values={form.headers} onChange={(headers) => setForm({ ...form, headers })} />
              <ParamGroup label="Cookies" parameters={visibleParamGroups.cookie} values={form.cookieParams} onChange={(cookieParams) => setForm({ ...form, cookieParams })} />
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Request body{operation.requestBody?.required ? <span className="req"> *</span> : null}</h3>
            {operation.requestBody ? (
              <RequestBodyEditor
                key={`${operationKey}-${caseId || "new"}`}
                resetKey={`${operationKey}-${caseId || "new"}`}
                caseId={boundCaseId}
                onEnsureCase={ensureCase}
                onFileCommitted={commitRequestBody}
                schema={operation.requestBody.jsonSchema}
                value={requestBody}
                onChange={setRequestBody}
                contentType={form.contentType}
                environmentId={runEnvironment?.id}
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

          <Collapsible
            title="Extract for later cases"
            hint={form.extracts ? "Picked fields become {{name}}" : "Off until you pick fields"}
            defaultOpen
          >
            <ExtractsPicker
              schema={hasResponseBodySchema(operation.response) ? operation.response.jsonSchema : null}
              expectedResponse={form.expectedResponse}
              runResult={runResult}
              value={form.extracts}
              onChange={(extracts) => setForm((current) => ({ ...current, extracts }))}
            />
          </Collapsible>
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
            <h3>{runEnvironment?.name ? `Saved in ${runEnvironment.name}` : "Saved for this operation"}</h3>
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
    {importOpen ? (
      <ImportCurlModal
        operations={operations}
        allowCreate
        onClose={() => setImportOpen(false)}
        onImport={handleCurlImport}
      />
    ) : null}
    </PlanExtractsProvider>
  );
}

function caseSaveBlockers(form, operation, requestBody) {
  const reasons = [];
  if (!String(form.testName || "").trim()) {
    reasons.push("Enter a test name");
  }
  if (!String(form.baseUrl || "").trim()) {
    reasons.push("Set a base URL");
  }
  if (!String(form.statusCode ?? "").trim()) {
    reasons.push("Set an expected status");
  }
  const missingParams = missingRequiredParams(form, operation);
  Object.entries(missingParams).forEach(([label, names]) => {
    if (names.length) {
      reasons.push(`Fill required ${label}: ${formatNameList(names)}`);
    }
  });
  if (operation.requestBody?.jsonSchema) {
    const body = decodeRequestBody(
      requestBody,
      operation.requestBody.jsonSchema,
      form.contentType
    );
    const missingBody = missingRequiredSchemaFields(operation.requestBody.jsonSchema, body);
    if (missingBody.length) {
      reasons.push(`Fill required body fields: ${formatNameList(missingBody)}`);
    } else if (operation.requestBody.required && isEffectivelyEmpty(body)) {
      reasons.push("Fill the required request body");
    }
  } else if (operation.requestBody?.required && isEffectivelyEmpty(requestBody)) {
    reasons.push("Fill the required request body");
  }
  return reasons;
}

function missingRequiredParams(form, operation) {
  const groups = {
    "path params": { values: form.pathParams, items: [] },
    "query params": { values: form.queryParams, items: [] },
    "headers": { values: form.headers, items: [] },
    "cookies": { values: form.cookieParams, items: [] }
  };
  (operation.parameters || []).forEach((parameter) => {
    const required = parameter.required || parameter.in === "path";
    if (!required) {
      return;
    }
    const key = parameter.in === "path"
      ? "path params"
      : parameter.in === "query"
        ? "query params"
        : parameter.in === "header"
          ? "headers"
          : parameter.in === "cookie"
            ? "cookies"
            : null;
    if (!key) {
      return;
    }
    if (!String(groups[key].values?.[parameter.name] || "").trim()) {
      groups[key].items.push(parameter.name);
    }
  });
  return Object.fromEntries(Object.entries(groups).map(([label, group]) => [label, group.items]));
}

function formatNameList(names) {
  const shown = names.slice(0, 8);
  const extra = names.length - shown.length;
  return extra > 0 ? `${shown.join(", ")}, and ${extra} more` : shown.join(", ");
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

function mergeCase(list, saved) {
  const current = list || [];
  const index = current.findIndex((item) => item.id === saved.id);
  if (index < 0) {
    return [...current, saved];
  }
  const next = [...current];
  next[index] = { ...current[index], ...saved };
  return next;
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

function blankOperationCase(operation, spec) {
  const form = formFromOperation(operation, spec);
  form.contentType = matchedContentType(form.contentType, operation.requestContentTypes) || form.contentType;
  const requestBody = decodeRequestBody(
    emptyFromSchema(operation.requestBody?.jsonSchema) ?? {},
    operation.requestBody?.jsonSchema,
    form.contentType
  );
  return { form, requestBody };
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
    extracts: "",
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
    extracts: blankNa(testCase.extracts),
    contentType: blankNa(testCase.contentType),
    pathParams: testCase.pathParams || {},
    queryParams: testCase.queryParams || {},
    headers: testCase.headers || {},
    cookieParams: testCase.cookieParams || {},
    environments: testCase.environments
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

function Field({ label, value, onChange, type = "text", hint, required }) {
  return (
    <div className="field">
      <label>
        {label}
        {required ? <span className="req">*</span> : null}
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

function withImportedParams(parameters, values, location) {
  const list = [...(parameters || [])];
  const known = new Set(list.map((item) => item.name));
  Object.keys(values || {}).forEach((name) => {
    if (!name || known.has(name) || !String(values[name] ?? "").trim()) {
      return;
    }
    list.push({ name, in: location, schema: { type: "string" }, description: "From curl" });
  });
  return list;
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
              {parameter.name}{parameter.required || parameter.in === "path" ? " *" : ""}
              {parameter.description ? <span className="hint">{parameter.description}</span> : null}
            </label>
            <ExtractValueField
              value={values[parameter.name] || ""}
              placeholder={typeWatermark(parameter.schema)}
              onChange={(next) => onChange({ ...values, [parameter.name]: next })}
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
        {parameter.name}{parameter.required || parameter.in === "path" ? " *" : ""}
        <span className="hint">{parameter.description || "Array — repeated query/header values"}</span>
      </label>
      {items.map((item, index) => (
        <div className="array-item" key={index} style={{ marginBottom: 6 }}>
          <ExtractValueField
            value={item}
            placeholder={typeWatermark(parameter.schema?.items || parameter.schema)}
            onChange={(nextValue) => {
              const next = [...items];
              next[index] = nextValue;
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
