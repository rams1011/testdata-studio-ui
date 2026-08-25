import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import SchemaForm from "../components/SchemaForm";
import JsonPathAssertionsPicker from "../components/JsonPathAssertionsPicker";
import ExpectedResponseEditor from "../components/ExpectedResponseEditor";
import { useToast } from "../components/Toast";
import { hasResponseBodySchema, sampleFromSchema } from "../schema";
import { allowedStatusCodes, statusLabel } from "../httpStatus";

export default function OperationPage() {
  const { specId, operationKey, caseId } = useParams();
  const { spec, plan, planId } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [operation, setOperation] = useState(null);
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState(null);
  const [requestBody, setRequestBody] = useState({});

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
      setForm(existing ? formFromCase(existing) : formFromOperation(nextOperation, spec));
      setRequestBody(existing?.requestBody ?? nextOperation.requestBody?.sample ?? sampleFromSchema(nextOperation.requestBody?.jsonSchema));
    }).catch((error) => toast(error.message, true));
    return () => { cancelled = true; };
  }, [specId, operationKey, caseId, spec, planId, toast, navigate]);

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
    const payload = {
      specId,
      planId,
      operationKey: operation.key,
      ...form,
      statusCode: Number(form.statusCode),
      maxResponseTimeMs: Number(form.maxResponseTimeMs),
      requestBody: operation.requestBody ? requestBody : null
    };
    try {
      const saved = caseId
        ? await Api.updateCase(caseId, payload)
        : await Api.createCase(payload);
      toast(caseId ? "Test case updated" : "Test case saved");
      navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}/case/${saved.id}`);
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

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="crumb">{plan?.name ? `${plan.name} · ` : ""}{operation.tag} · {operation.key}</div>
          <h2>{operation.summary || operation.key}</h2>
          <div className="crumb">
            <span className={`method ${operation.method}`}>{operation.method}</span>
            {"  "}
            {operation.path}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => navigate(`/s/${specId}/op/${encodeURIComponent(operation.key)}`)}>
            New case
          </button>
          <button type="button" className="btn primary" onClick={save}>
            {caseId ? "Update test case" : "Save test case"}
          </button>
        </div>
      </div>
      {operation.description ? <p className="crumb">{operation.description}</p> : null}

      <div className="grid">
        <div>
          <div className="card">
            <h3>Test case</h3>
            <Field label="Test name" value={form.testName} onChange={(testName) => setForm({ ...form, testName })} />
            <div className="row-2">
              <Field label="Test group" value={form.testGroup} onChange={(testGroup) => setForm({ ...form, testGroup })} />
              <SelectField label="Enabled" value={form.enabled} options={["Y", "N"]} onChange={(enabled) => setForm({ ...form, enabled })} />
            </div>
            <Field label="Base URL" value={form.baseUrl} onChange={(baseUrl) => setForm({ ...form, baseUrl })} />
            <div className="row-3">
              <SelectField
                label="Expected status"
                value={String(form.statusCode)}
                options={statusOptions}
                onChange={(statusCode) => setForm({ ...form, statusCode: Number(statusCode) })}
              />
              <SelectField label="Response type" value={form.responseType} options={["JSON", "NONE", "STRING", "FILE", "NA"]} onChange={(responseType) => setForm({ ...form, responseType })} />
              <Field label="Max response ms" type="number" value={form.maxResponseTimeMs} onChange={(maxResponseTimeMs) => setForm({ ...form, maxResponseTimeMs })} />
            </div>
            <Field label="Content type" value={form.contentType} onChange={(contentType) => setForm({ ...form, contentType })} />
            <JsonPathAssertionsPicker
              schema={hasResponseBodySchema(operation.response) ? operation.response.jsonSchema : null}
              value={form.jsonPathAssertions}
              onChange={(jsonPathAssertions) => setForm({ ...form, jsonPathAssertions })}
            />
            <ExpectedResponseEditor
              schema={hasResponseBodySchema(operation.response) ? operation.response.jsonSchema : null}
              sample={hasResponseBodySchema(operation.response) ? operation.response.sample : null}
              value={form.expectedResponse}
              onChange={(expectedResponse) => setForm((current) => ({ ...current, expectedResponse }))}
              onBuilt={() => setForm((current) => ({
                ...current,
                responseType: current.responseType === "NONE" || current.responseType === "NA" ? "JSON" : current.responseType
              }))}
            />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Parameters from schema</h3>
            {!operation.parameters?.length ? (
              <div className="empty">No path, query, or header parameters.</div>
            ) : (
              <>
                <ParamGroup label="Path" parameters={paramGroups.path} values={form.pathParams} onChange={(pathParams) => setForm({ ...form, pathParams })} />
                <ParamGroup label="Query" parameters={paramGroups.query} values={form.queryParams} onChange={(queryParams) => setForm({ ...form, queryParams })} />
                <ParamGroup label="Headers" parameters={paramGroups.header} values={form.headers} onChange={(headers) => setForm({ ...form, headers })} />
              </>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Request body</h3>
            {operation.requestBody ? (
              <SchemaForm
                key={`${operationKey}-${caseId || "new"}`}
                schema={operation.requestBody.jsonSchema}
                value={requestBody}
                onChange={setRequestBody}
              />
            ) : (
              <div className="empty">This operation has no request body schema.</div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>JSON preview</h3>
          <pre className="json-preview">
            {operation.requestBody ? JSON.stringify(requestBody, null, 2) : "NA"}
          </pre>
          <div style={{ marginTop: 18 }}>
            <h3>Saved for this operation</h3>
            {!cases.length ? (
              <div className="empty">No test cases saved yet.</div>
            ) : cases.map((item) => (
              <div className="array-item" key={item.id}>
                <div className="array-toolbar">
                  <div>
                    <strong>{item.testName}</strong>
                    <div className="hint">{item.method} {item.endpoint}</div>
                  </div>
                  <div className="inline-actions">
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

function formFromOperation(operation, spec) {
  const defaults = operation.defaults || {};
  return {
    testName: defaults.testName || operation.summary || "",
    testGroup: defaults.testGroup || operation.tag || "generated",
    baseUrl: defaults.baseUrl || spec.baseUrl || "",
    enabled: defaults.enabled || "Y",
    statusCode: operation.response ? operation.response.statusCode : 200,
    responseType: defaults.responseType || "NONE",
    maxResponseTimeMs: defaults.maxResponseTimeMs || 3000,
    expectedResponse: "NA",
    jsonPathAssertions: operation.response?.jsonPathAssertions || "NA",
    contentType: defaults.contentType || "NA",
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
    responseType: testCase.responseType || "NONE",
    maxResponseTimeMs: testCase.maxResponseTimeMs || 3000,
    expectedResponse: testCase.expectedResponse || "NA",
    jsonPathAssertions: testCase.jsonPathAssertions || "NA",
    contentType: testCase.contentType || "NA",
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

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div className="field">
      <label>{label}</label>
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
      <div className="tag-label" style={{ color: "#5c6b7a" }}>{label}</div>
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
