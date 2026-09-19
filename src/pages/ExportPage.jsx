import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "../components/Toast";

export default function ExportPage() {
  const { specId } = useParams();
  const navigate = useNavigate();
  const { plan, planId, reloadPlans, onSpecUpdated, onEnvironmentsChanged } = useOutletContext();
  const { toast } = useToast();
  const [excelFileName, setExcelFileName] = useState("");
  const [environmentName, setEnvironmentName] = useState("local");
  const [environmentAuth, setEnvironmentAuth] = useState("BEARER");
  const importRef = useRef(null);
  const envImportRef = useRef(null);

  useEffect(() => {
    if (plan?.name) {
      setExcelFileName(`${plan.name}.xlsx`);
    }
  }, [plan?.name]);

  async function exportCollection() {
    try {
      const downloaded = await Api.exportCollection({ specId, planId });
      toast(`Downloaded ${downloaded.fileName}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function importCollection(file) {
    if (!file) return;
    try {
      const imported = await Api.importCollection(file, specId);
      sessionStorage.setItem(`testdata.plan.${imported.specId}`, imported.planId);
      await reloadPlans(imported.planId);
      toast(importCollectionToast(imported));
      navigate(`/s/${imported.specId}/cases`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function exportCases() {
    try {
      const downloaded = await Api.exportCases({ specId, planId, excelFileName });
      toast(`Downloaded ${downloaded.fileName}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function exportEnvironment() {
    try {
      const downloaded = await Api.exportEnvironment({
        specId,
        name: environmentName.trim() || "local",
        authType: environmentAuth
      });
      onEnvironmentsChanged?.();
      toast(`Downloaded ${downloaded.fileName}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function importEnvironment(file) {
    if (!file) return;
    try {
      const imported = await Api.importEnvironment(file, specId, true);
      sessionStorage.setItem(`testdata.env.${imported.specId}`, imported.environmentId);
      if (onSpecUpdated) {
        onSpecUpdated(await Api.getSpec(imported.specId));
      }
      onEnvironmentsChanged?.();
      toast(imported.applied
        ? `Imported environment ${imported.name} and set base URL`
        : `Imported environment ${imported.name}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h2>Export</h2>
          <p className="hint" style={{ marginTop: 6 }}>
            Collection JSON is the file TestNG should parse. Swap an environment file to point the
            same collection at local vs int. Excel remains an interchange dump.
          </p>
        </div>
      </div>
      <div className="export-grid">
        <div className="card">
          <h3>Collection JSON</h3>
          <p className="hint">
            Downloads <code>testdata.studio.collection/v1</code> for {plan?.name || "the selected plan"}.
            Cases are ordered so extract producers run first. If the plan has uploads, you get a zip with
            the JSON plus <code>files/&lt;caseId&gt;/</code>. Import upserts by case id and creates a missing plan.
          </p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={exportCollection}>
              Download collection
            </button>
            <button type="button" className="btn" onClick={() => importRef.current?.click()}>
              Import collection
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              importCollection(file);
            }}
          />
        </div>
        <div className="card">
          <h3>Environment</h3>
          <p className="hint">
            Downloads <code>testdata.studio.environment/v1</code> with <code>{"{{baseUrl}}"}</code> values
            and <code>{"${ENV_VAR}"}</code> auth placeholders — never session tokens. Import applies
            <code>values.baseUrl</code> to this spec. Try auth stays on the case page.
          </p>
          <div className="field">
            <label>Environment name</label>
            <input value={environmentName} onChange={(event) => setEnvironmentName(event.target.value)} />
          </div>
          <div className="field">
            <label>Auth placeholders</label>
            <select value={environmentAuth} onChange={(event) => setEnvironmentAuth(event.target.value)}>
              <option value="NONE">None</option>
              <option value="BEARER">{`Bearer (\${AUTOMATION_BEARER_TOKEN})`}</option>
              <option value="BASIC">Basic</option>
              <option value="API_KEY">API key</option>
              <option value="OAUTH2">OAuth2</option>
            </select>
          </div>
          <div className="actions">
            <button type="button" className="btn primary" onClick={exportEnvironment}>
              Download environment
            </button>
            <button type="button" className="btn" onClick={() => envImportRef.current?.click()}>
              Import environment
            </button>
          </div>
          <input
            ref={envImportRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              importEnvironment(file);
            }}
          />
        </div>
        <div className="card">
          <h3>Excel</h3>
          <p className="hint">
            Downloads api-automation Excel for {plan?.name || "the selected plan"} only. Request bodies are
            written into the RequestBody column. Multipart files are copied to api-automation{" "}
            <code>src/test/data/files</code> and listed in the UploadFiles column.
          </p>
          <div className="field">
            <label>Excel file name</label>
            <input value={excelFileName} onChange={(event) => setExcelFileName(event.target.value)} />
          </div>
          <button type="button" className="btn" onClick={exportCases}>Download Excel</button>
        </div>
      </div>
    </div>
  );
}

export function importCollectionToast(result) {
  const bits = [];
  if (result.planCreated) bits.push(`plan ${result.planName} created`);
  if (result.createdCases) {
    bits.push(`${result.createdCases} case${result.createdCases === 1 ? "" : "s"} created`);
  }
  if (result.updatedCases) {
    bits.push(`${result.updatedCases} updated`);
  }
  if (result.importedFiles) {
    bits.push(`${result.importedFiles} file${result.importedFiles === 1 ? "" : "s"}`);
  }
  return bits.length ? `Imported ${result.planName}: ${bits.join(", ")}` : `Imported ${result.planName}`;
}
