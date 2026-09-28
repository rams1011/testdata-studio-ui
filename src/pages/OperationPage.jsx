import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import RequestBodyEditor from "../components/RequestBodyEditor";
import JsonPathAssertionsPicker from "../components/JsonPathAssertionsPicker";
import ExtractsPicker from "../components/ExtractsPicker";
import ExtractValueField, { PlanExtractsProvider } from "../components/ExtractValueField";
import ImportCurlModal from "../components/ImportCurlModal";
import DuplicateCaseModal from "../components/DuplicateCaseModal";
import SavedCaseActions from "../components/SavedCaseActions";
import CaseAuditMeta from "../components/CaseAuditMeta";
import ExpectedResponseEditor from "../components/ExpectedResponseEditor";
import AuthSettings, { authCredentialsMissing, useSpecAuth } from "../components/AuthSettings";
import LastRunsStrip from "../components/LastRunsStrip";
import ValidationSummary from "../components/ValidationSummary";
import {
  blockerTitle,
  caseSaveIssues,
  draftRunIssues,
  missingRequiredParamKeys,
  paramAnchorId,
  jumpToValidationItem
} from "../caseValidation";
import RunResultPanel from "../components/RunResultPanel";
import Collapsible from "../components/Collapsible";
import StatusCodeField from "../components/StatusCodeField";
import { useToast } from "../components/Toast";
import {
  allowsManualRequestBody,
  collectPlanExtracts,
  manualRequestBodySchema,
  manualResponseBodySchema,
  normalizeRequestBodyTemplate,
  templateFromSchema,
  typeWatermark
} from "../schema";
import { isXmlContentType, looksLikeXml, xmlToJson } from "../xml";
import { allowedStatusCodes, statusLabel } from "../httpStatus";
import { applyCurlImport } from "../curlImport";

export default function OperationPage() {
  const { specId, operationKey, caseId } = useParams();
  const {
    spec,
    planId,
    operations,
    importCurlAsCase,
    deleteManualOperation,
    onSpecUpdated,
    runEnvironment,
    environmentReady,
    envEpoch,
    onEnvironmentsChanged
  } = useOutletContext();
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
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [paramSubTab, setParamSubTab] = useState("path");
  const baseline = useRef("");
  const skipUnsavedPrompt = useRef(false);
  const curlImportRef = useRef(location.state?.curlImport);
  const [, setCleanNonce] = useState(0);
  curlImportRef.current = location.state?.curlImport;

  useEffect(() => {
    setBoundCaseId(caseId);
    skipUnsavedPrompt.current = false;
  }, [caseId]);

  useEffect(() => {
    setParamSubTab("path");
  }, [operationKey]);

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
      const bodySchema = manualRequestBodySchema(nextOperation, spec?.manual);
      let nextBody = normalizeRequestBodyTemplate(
        existing
          ? decodeRequestBody(existing.requestBody, bodySchema, nextForm.contentType)
          : blank.requestBody,
        bodySchema
      );
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
    cookie: withImportedParams(paramGroups.cookie, form?.cookieParams, "cookie")
  }), [paramGroups, form]);

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
      requestBody: allowsManualRequestBody(operation, spec?.manual) ? requestBody : null,
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

  function openDuplicateModal(caseItem) {
    if (!caseItem?.id) {
      toast("Save this case before duplicating", true);
      return;
    }
    if (caseItem.id === boundCaseId && dirty) {
      toast("Save changes before duplicating this case", true);
      return;
    }
    const sourceTestName = caseItem.testName || form?.testName || "Untitled";
    setDuplicateModal({
      caseId: caseItem.id,
      sourceTestName,
      testName: defaultDuplicateName(sourceTestName),
      targetEnvironmentId: runEnvironment?.id || environments[0]?.id || "",
      openCopy: true
    });
  }

  function duplicateCurrentCase() {
    openDuplicateModal(
      cases.find((item) => item.id === boundCaseId) || (boundCaseId ? { id: boundCaseId, testName: form?.testName } : null)
    );
  }

  async function confirmDuplicate() {
    if (!duplicateModal) {
      return;
    }
    const { caseId, testName, targetEnvironmentId, openCopy } = duplicateModal;
    if (!testName.trim() || !targetEnvironmentId) {
      return;
    }
    setDuplicateSaving(true);
    try {
      let copied = await Api.duplicateCase(caseId, {
        fromEnvironmentId: runEnvironment?.id,
        toEnvironmentId: targetEnvironmentId
      });
      const desiredName = testName.trim();
      if (desiredName !== copied.testName) {
        copied = await Api.updateCase(
          copied.id,
          caseUpdateFromView(copied, { testName: desiredName }, targetEnvironmentId)
        );
      }
      const target = environments.find((item) => item.id === targetEnvironmentId);
      setDuplicateModal(null);
      if (targetEnvironmentId === runEnvironment?.id) {
        upsertCase(copied);
      } else {
        await refreshPlanCases();
      }
      if (openCopy) {
        if (targetEnvironmentId !== runEnvironment?.id) {
          sessionStorage.setItem(`testdata.env.${specId}`, targetEnvironmentId);
          await Api.applyEnvironment(specId, targetEnvironmentId);
          if (onSpecUpdated) {
            onSpecUpdated(await Api.getSpec(specId));
          }
          onEnvironmentsChanged?.();
        }
        skipUnsavedPrompt.current = true;
        navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}/case/${copied.id}`);
        toast(target?.name ? `Opened copy in ${target.name}` : "Opened copy");
      } else {
        toast(target?.name && targetEnvironmentId !== runEnvironment?.id
          ? `Created copy in ${target.name}`
          : "Created copy");
      }
    } catch (error) {
      toast(error.message, true);
    } finally {
      setDuplicateSaving(false);
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
        if (form && operation && !caseSaveIssues(form, operation, requestBody).length) {
          save();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form, operation, requestBody, caseId]);

  const tryRequestIssues = useMemo(
    () => (form && operation ? draftRunIssues(form, operation) : []),
    [form, operation]
  );
  const saveIssueGroups = useMemo(
    () => (form && operation ? caseSaveIssues(form, operation, requestBody) : []),
    [form, operation, requestBody]
  );
  function jumpToField(item) {
    const anchorId = item?.anchorId || "";
    if (anchorId.includes("op-param-path-")) {
      setParamSubTab("path");
    } else if (anchorId.includes("op-param-query-")) {
      setParamSubTab("query");
    } else if (anchorId.includes("op-param-header-")) {
      setParamSubTab("headers");
    }
    window.requestAnimationFrame(() => jumpToValidationItem(item));
  }

  const missingParamKeys = useMemo(
    () => (form && operation ? missingRequiredParamKeys(form, operation) : new Set()),
    [form, operation]
  );
  const missingSaveKeys = useMemo(() => {
    const keys = new Set();
    saveIssueGroups.forEach((group) => {
      group.items.forEach((item) => keys.add(item.key));
    });
    return keys;
  }, [saveIssueGroups]);
  const saveBlocked = !form || !operation || saveIssueGroups.length > 0;
  const tryRequestBlocked = !form || !operation || tryRequestIssues.length > 0;

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
              disabled={!!running || tryRequestBlocked}
              title={blockerTitle(tryRequestIssues, "Send the current form without saving")}
            >
              {running === "current" ? "Trying…" : "Try this request"}
            </button>
            <button type="button" className="btn" onClick={() => setImportOpen(true)}>
              Import from curl
            </button>
            <button type="button" className="btn" onClick={() => navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}`)}>
              New case
            </button>
            {boundCaseId ? (
              <button type="button" className="btn" onClick={duplicateCurrentCase}>
                Duplicate
              </button>
            ) : null}
            {spec?.manual ? (
              <button type="button" className="btn danger" onClick={removeApi}>
                Remove API
              </button>
            ) : null}
            <button
              type="button"
              className="btn primary"
              onClick={save}
              disabled={saveBlocked}
              title={blockerTitle(saveIssueGroups, boundCaseId ? "Update the saved case" : "Save the test case")}
            >
              {boundCaseId ? "Update" : "Save"}
            </button>
          </div>
          {saveIssueGroups.length ? (
            <ValidationSummary groups={saveIssueGroups} className="try-request-hint" onJump={jumpToField} />
          ) : tryRequestIssues.length ? (
            <ValidationSummary groups={tryRequestIssues} className="try-request-hint" onJump={jumpToField} />
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
        </div>
      ) : null}

      <div className="grid">
        <div>
          <AuthSettings auth={auth} onChange={setAuth} specAuth={operation.auth} environment={runEnvironment} />

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Test case</h3>
            <CaseAuditMeta testCase={cases.find((item) => item.id === boundCaseId)} />
            <Field
              id="op-field-testName"
              label="Test name"
              required
              invalid={missingSaveKeys.has("testName")}
              value={form.testName}
              onChange={(testName) => setForm({ ...form, testName })}
            />
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
            <Field
              id="op-field-baseUrl"
              label="Base URL"
              required
              invalid={missingSaveKeys.has("baseUrl")}
              value={form.baseUrl}
              onChange={(baseUrl) => setForm({ ...form, baseUrl })}
            />
            <div className="row-3" id="op-field-statusCode">
              <StatusCodeField
                value={form.statusCode}
                options={statusOptions}
                invalid={missingSaveKeys.has("statusCode")}
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

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Parameters</h3>
            <p className="hint">
              {extractOptions.length
                ? "Choose an extracted field from an earlier case, or type a literal value."
                : "No extracted fields in this plan yet. On another case, pick fields under Extract for later cases."}
            </p>
            <div
              className="body-editor-tabs param-subtabs"
              role="tablist"
              aria-label="Path, query, and headers"
            >
              <button
                type="button"
                role="tab"
                id="op-param-tab-path"
                aria-selected={paramSubTab === "path"}
                aria-controls="op-param-panel-path"
                className={paramSubTab === "path" ? "active" : ""}
                onClick={() => setParamSubTab("path")}
              >
                Path
              </button>
              <button
                type="button"
                role="tab"
                id="op-param-tab-query"
                aria-selected={paramSubTab === "query"}
                aria-controls="op-param-panel-query"
                className={paramSubTab === "query" ? "active" : ""}
                onClick={() => setParamSubTab("query")}
              >
                Query
              </button>
              <button
                type="button"
                role="tab"
                id="op-param-tab-headers"
                aria-selected={paramSubTab === "headers"}
                aria-controls="op-param-panel-headers"
                className={paramSubTab === "headers" ? "active" : ""}
                onClick={() => setParamSubTab("headers")}
              >
                Headers
              </button>
            </div>
            <div
              id="op-param-panel-path"
              role="tabpanel"
              aria-labelledby="op-param-tab-path"
              className="param-subtab-panel"
              hidden={paramSubTab !== "path"}
            >
              <ParamGroup
                label="Path"
                embedded
                parameters={visibleParamGroups.path}
                values={form.pathParams}
                missingKeys={missingParamKeys}
                onChange={(pathParams) => setForm({ ...form, pathParams })}
              />
            </div>
            <div
              id="op-param-panel-query"
              role="tabpanel"
              aria-labelledby="op-param-tab-query"
              className="param-subtab-panel"
              hidden={paramSubTab !== "query"}
            >
              <QueryParamGroup
                specParameters={paramGroups.query}
                values={form.queryParams}
                missingKeys={missingParamKeys}
                onChange={(queryParams) => setForm({ ...form, queryParams })}
              />
            </div>
            <div
              id="op-param-panel-headers"
              role="tabpanel"
              aria-labelledby="op-param-tab-headers"
              className="param-subtab-panel"
              hidden={paramSubTab !== "headers"}
            >
              <HeaderParamGroup
                specParameters={paramGroups.header}
                values={form.headers}
                onChange={(headers) => setForm({ ...form, headers })}
              />
            </div>
            <ParamGroup
              label="Cookies"
              parameters={visibleParamGroups.cookie}
              values={form.cookieParams}
              missingKeys={missingParamKeys}
              onChange={(cookieParams) => setForm({ ...form, cookieParams })}
            />
          </div>

          <div
            className={`card${saveIssueGroups.some((group) => group.id === "body") ? " card-section-missing" : ""}`}
            style={{ marginTop: 16 }}
            id="op-section-request-body"
          >
            <h3>Request body{operation.requestBody?.required ? <span className="req"> *</span> : null}</h3>
            {allowsManualRequestBody(operation, spec?.manual) ? (
              <RequestBodyEditor
                key={`${operationKey}-${caseId || "new"}`}
                resetKey={`${operationKey}-${caseId || "new"}`}
                caseId={boundCaseId}
                onEnsureCase={ensureCase}
                onFileCommitted={commitRequestBody}
                schema={manualRequestBodySchema(operation, spec?.manual)}
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
              schema={manualResponseBodySchema(operation, spec?.manual)}
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
              schema={manualResponseBodySchema(operation, spec?.manual)}
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
              schema={manualResponseBodySchema(operation, spec?.manual)}
              expectedResponse={form.expectedResponse}
              runResult={runResult}
              value={form.extracts}
              onChange={(extracts) => setForm((current) => ({ ...current, extracts }))}
            />
          </Collapsible>
        </div>

        <div>
          <RunResultPanel result={runResult} />
          <div className="card saved-case-list" style={{ marginTop: 16 }}>
            <h3>{runEnvironment?.name ? `Saved in ${runEnvironment.name}` : "Saved for this operation"}</h3>
            {!cases.length ? (
              <div className="empty">
                No cases yet. Save the form to add one.
              </div>
            ) : cases.map((item) => (
              <div className="array-item" key={item.id}>
                <div className="array-toolbar">
                  <div className="saved-case-meta">
                    <strong>{item.testName}</strong>
                    <div className="hint">{item.method} {item.endpoint}</div>
                  </div>
                  <SavedCaseActions
                    testName={item.testName}
                    running={running === item.id}
                    runDisabled={!!running}
                    onRun={() => runSaved(item.id)}
                    onEdit={() => navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}/case/${item.id}`)}
                    onDuplicate={() => openDuplicateModal(item)}
                    onDelete={() => remove(item.id)}
                  />
                </div>
              </div>
            ))}
          </div>
          <LastRunsStrip
            specId={specId}
            planId={planId}
            caseId={boundCaseId || undefined}
            environmentId={runEnvironment?.id}
            environmentReady={environmentReady}
            refreshKey={historyKey}
          />
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
    {duplicateModal ? (
      <DuplicateCaseModal
        sourceTestName={duplicateModal.sourceTestName}
        testName={duplicateModal.testName}
        onTestNameChange={(testName) => setDuplicateModal((current) => ({ ...current, testName }))}
        targetEnvironmentId={duplicateModal.targetEnvironmentId}
        onTargetEnvironmentChange={(targetEnvironmentId) => (
          setDuplicateModal((current) => ({ ...current, targetEnvironmentId }))
        )}
        environments={environments}
        currentEnvironmentId={runEnvironment?.id}
        openCopy={duplicateModal.openCopy}
        onOpenCopyChange={(openCopy) => setDuplicateModal((current) => ({ ...current, openCopy }))}
        saving={duplicateSaving}
        onConfirm={confirmDuplicate}
        onClose={() => {
          if (!duplicateSaving) {
            setDuplicateModal(null);
          }
        }}
      />
    ) : null}
    </PlanExtractsProvider>
  );
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

function defaultDuplicateName(testName) {
  const base = String(testName || "Untitled").trim() || "Untitled";
  if (/^copy of /i.test(base)) {
    return `${base} (2)`;
  }
  return `Copy of ${base}`;
}

function caseUpdateFromView(item, patch, environmentId) {
  return {
    specId: item.specId,
    planId: item.planId,
    operationKey: item.operationKey,
    testName: item.testName,
    pathParams: item.pathParams,
    queryParams: item.queryParams,
    headers: item.headers,
    cookieParams: item.cookieParams,
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

function blankOperationCase(operation, spec) {
  const form = formFromOperation(operation, spec);
  form.contentType = matchedContentType(form.contentType, operation.requestContentTypes) || form.contentType;
  const bodySchema = manualRequestBodySchema(operation, spec?.manual);
  const requestBody = decodeRequestBody(
    templateFromSchema(bodySchema) ?? {},
    bodySchema,
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

function Field({ id, label, value, onChange, type = "text", hint, required, invalid = false }) {
  return (
    <div className={`field${invalid ? " field-missing" : ""}`} id={id}>
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

const MANAGED_HEADERS = new Set([
  "content-type", "content-length", "host", "connection", "accept-encoding",
  "content-encoding", "transfer-encoding"
]);

function QueryParamGroup({ specParameters, values, onChange, missingKeys = new Set() }) {
  const specParams = withImportedParams(specParameters, values, "query");
  const specNames = new Set(specParams.map((item) => item.name));
  const extras = Object.entries(values || {}).filter(([name]) => name && !specNames.has(name));
  const [draftName, setDraftName] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [hint, setHint] = useState("");

  function setQuery(name, value) {
    onChange({ ...(values || {}), [name]: value });
  }

  function renameExtra(oldName, nextName) {
    const trimmed = String(nextName || "").trim();
    if (!trimmed || trimmed === oldName) {
      return Boolean(trimmed);
    }
    const clash = Object.keys(values || {}).some(
      (key) => key !== oldName && key.toLowerCase() === trimmed.toLowerCase()
    );
    if (clash || specNames.has(trimmed)) {
      setHint(`Query parameter ${trimmed} is already listed.`);
      return false;
    }
    const next = { ...(values || {}) };
    next[trimmed] = next[oldName] ?? "";
    delete next[oldName];
    setHint("");
    onChange(next);
    return true;
  }

  function removeExtra(name) {
    const next = { ...(values || {}) };
    delete next[name];
    onChange(next);
  }

  function addExtra() {
    const name = draftName.trim();
    if (!name) {
      setHint("Enter a query parameter name.");
      return;
    }
    const existing = Object.keys(values || {}).find((key) => key.toLowerCase() === name.toLowerCase());
    if (existing) {
      setQuery(existing, draftValue);
    } else {
      setQuery(name, draftValue);
    }
    setDraftName("");
    setDraftValue("");
    setHint("");
  }

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Parameters from the API definition are listed first. Add extra query parameters for this case anytime.
      </p>
      {specParams.map((parameter) => (
        isArrayParam(parameter) ? (
          <ArrayParamField
            key={parameter.name}
            parameter={parameter}
            values={values}
            missingKeys={missingKeys}
            onChange={onChange}
          />
        ) : (
          <div
            className={`field${missingKeys.has(`${parameter.in}:${parameter.name}`) ? " field-missing" : ""}`}
            key={parameter.name}
            id={paramAnchorId(parameter)}
          >
            <label>
              {parameter.name}{parameter.required ? " *" : ""}
              {parameter.description ? <span className="hint">{parameter.description}</span> : null}
            </label>
            <ExtractValueField
              value={values?.[parameter.name] || ""}
              placeholder={typeWatermark(parameter.schema)}
              onChange={(next) => setQuery(parameter.name, next)}
            />
          </div>
        )
      ))}
      {extras.map(([name, value]) => (
        <ExtraHeaderRow
          key={name}
          name={name}
          value={value}
          onRename={renameExtra}
          onValueChange={setQuery}
          onRemove={removeExtra}
        />
      ))}
      <div className="header-add">
        <input
          value={draftName}
          placeholder="Query name, e.g. page"
          aria-label="New query parameter name"
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addExtra();
            }
          }}
        />
        <ExtractValueField
          value={draftValue}
          placeholder="Value"
          ariaLabel="New query parameter value"
          onChange={setDraftValue}
        />
        <button type="button" className="btn" onClick={addExtra}>Add query</button>
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </>
  );
}

function HeaderParamGroup({ specParameters, values, onChange }) {
  const specParams = specParameters || [];
  const specNames = new Set(specParams.map((item) => item.name));
  const extras = Object.entries(values || {}).filter(([name]) => name && !specNames.has(name));
  const [draftName, setDraftName] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [hint, setHint] = useState("");

  function setHeader(name, value) {
    onChange({ ...(values || {}), [name]: value });
  }

  function renameExtra(oldName, nextName) {
    const trimmed = String(nextName || "").trim();
    if (!trimmed || trimmed === oldName) {
      return Boolean(trimmed);
    }
    if (MANAGED_HEADERS.has(trimmed.toLowerCase())) {
      setHint("Content-Type is the field above. Host and similar headers are not stored on the case.");
      return false;
    }
    const clash = Object.keys(values || {}).some(
      (key) => key !== oldName && key.toLowerCase() === trimmed.toLowerCase()
    );
    if (clash || specNames.has(trimmed)) {
      setHint(`Header ${trimmed} is already listed.`);
      return false;
    }
    const next = { ...(values || {}) };
    next[trimmed] = next[oldName] ?? "";
    delete next[oldName];
    setHint("");
    onChange(next);
    return true;
  }

  function removeExtra(name) {
    const next = { ...(values || {}) };
    delete next[name];
    onChange(next);
  }

  function addExtra() {
    const name = draftName.trim();
    if (!name) {
      setHint("Enter a header name.");
      return;
    }
    if (MANAGED_HEADERS.has(name.toLowerCase())) {
      setHint("Content-Type is the field above. Host and similar headers are not stored on the case.");
      return;
    }
    const existing = Object.keys(values || {}).find((key) => key.toLowerCase() === name.toLowerCase());
    if (existing) {
      setHeader(existing, draftValue);
    } else {
      setHeader(name, draftValue);
    }
    setDraftName("");
    setDraftValue("");
    setHint("");
  }

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Spec headers are listed first. Add extra headers for this case even if they are not in the spec.
        Authorization is set on the environment.
      </p>
      {specParams.map((parameter) => (
        isArrayParam(parameter) ? (
          <ArrayParamField
            key={parameter.name}
            parameter={parameter}
            values={values}
            onChange={onChange}
          />
        ) : (
          <div className="field" key={parameter.name} id={paramAnchorId(parameter)}>
            <label>
              {parameter.name}{parameter.required ? " *" : ""}
              {parameter.description ? <span className="hint">{parameter.description}</span> : null}
            </label>
            <ExtractValueField
              value={values?.[parameter.name] || ""}
              placeholder={typeWatermark(parameter.schema)}
              onChange={(next) => setHeader(parameter.name, next)}
            />
          </div>
        )
      ))}
      {extras.map(([name, value]) => (
        <ExtraHeaderRow
          key={name}
          name={name}
          value={value}
          onRename={renameExtra}
          onValueChange={setHeader}
          onRemove={removeExtra}
        />
      ))}
      <div className="header-add">
        <input
          value={draftName}
          placeholder="Header name, e.g. X-Request-Id"
          aria-label="New header name"
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addExtra();
            }
          }}
        />
        <ExtractValueField
          value={draftValue}
          placeholder="Value"
          ariaLabel="New header value"
          onChange={setDraftValue}
        />
        <button type="button" className="btn" onClick={addExtra}>Add header</button>
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </>
  );
}

function ExtraHeaderRow({ name, value, onRename, onValueChange, onRemove }) {
  const [nameDraft, setNameDraft] = useState(name);
  useEffect(() => {
    setNameDraft(name);
  }, [name]);

  return (
    <div className="header-extra-row">
      <input
        value={nameDraft}
        aria-label="Header name"
        placeholder="Header name"
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={() => {
          const trimmed = nameDraft.trim();
          if (trimmed === name) {
            return;
          }
          if (!onRename(name, trimmed)) {
            setNameDraft(name);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <ExtractValueField
        value={value || ""}
        placeholder="Value"
        ariaLabel={`${name} value`}
        onChange={(next) => onValueChange(name, next)}
      />
      <button type="button" className="btn danger" onClick={() => onRemove(name)}>Remove</button>
    </div>
  );
}

function ParamGroup({ label, parameters, values, onChange, missingKeys = new Set(), embedded = false }) {
  if (!parameters.length) {
    if (embedded) {
      return (
        <p className="hint" style={{ marginTop: 0 }}>
          No {label.toLowerCase()} parameters for this API.
        </p>
      );
    }
    return null;
  }
  return (
    <>
      {embedded ? null : (
        <div className="tag-label" style={{ color: "#696969" }}>{label}</div>
      )}
      {parameters.map((parameter) => (
        isArrayParam(parameter) ? (
          <ArrayParamField
            key={parameter.name}
            parameter={parameter}
            values={values}
            missingKeys={missingKeys}
            onChange={onChange}
          />
        ) : (
          <div
            className={`field${missingKeys.has(`${parameter.in}:${parameter.name}`) ? " field-missing" : ""}`}
            key={parameter.name}
            id={paramAnchorId(parameter)}
          >
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

function ArrayParamField({ parameter, values, onChange, missingKeys = new Set() }) {
  const items = parseListValue(values[parameter.name]);
  const missing = missingKeys.has(`${parameter.in}:${parameter.name}`);
  return (
    <div className={`field${missing ? " field-missing" : ""}`} id={paramAnchorId(parameter)}>
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
