import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "../components/Toast";

const COLLECTION_TYPES = {
  json: {
    label: "JSON",
    downloadLabel: "Download collection",
    hint: (planName) => (
      <>
        Downloads <code>testdata.studio.collection/v1</code> for {planName} in the selected
        environment. Cases are ordered so extract producers run first. If the plan has uploads, you get a zip with
        the JSON plus <code>files/&lt;caseId&gt;/</code>. Import upserts by case id into this environment.
      </>
    )
  },
  excel: {
    label: "Excel",
    downloadLabel: "Download Excel",
    hint: (planName) => (
      <>
        Downloads api-automation Excel for {planName} in the selected environment. Request bodies are
        written into the RequestBody column. If the plan has uploads, you get a zip with the workbook
        plus <code>files/&lt;caseId&gt;/</code> — the same packaging as collection JSON. Point TestNG at that zip
        (<code>automation.source.data-file</code>).
      </>
    )
  }
};

export default function ExportPage() {
  const { specId } = useParams();
  const navigate = useNavigate();
  const { plan, planId, reloadPlans, onSpecUpdated, onEnvironmentsChanged, runEnvironment } = useOutletContext();
  const { toast } = useToast();
  const [collectionType, setCollectionType] = useState("json");
  const [excelFileName, setExcelFileName] = useState("");
  const importRef = useRef(null);
  const envImportRef = useRef(null);
  const selectedType = COLLECTION_TYPES[collectionType] || COLLECTION_TYPES.json;
  const planName = plan?.name || "the selected plan";

  useEffect(() => {
    if (plan?.name) {
      setExcelFileName(`${plan.name}.xlsx`);
    }
  }, [plan?.name]);

  async function downloadCollection() {
    try {
      const downloaded = collectionType === "excel"
        ? await Api.exportCases({ specId, planId, excelFileName, environmentId: runEnvironment?.id })
        : await Api.exportCollection({ specId, planId, environmentId: runEnvironment?.id });
      toast(`Downloaded ${downloaded.fileName}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function importCollection(file) {
    if (!file) return;
    try {
      const imported = await Api.importCollection(file, specId, runEnvironment?.id);
      sessionStorage.setItem(`testdata.plan.${imported.specId}`, imported.planId);
      await reloadPlans(imported.planId);
      toast(importCollectionToast(imported));
      navigate(`/s/${imported.specId}/cases`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function exportEnvironment() {
    if (!runEnvironment?.id) {
      toast("Select an environment in the workspace bar first", true);
      return;
    }
    try {
      const downloaded = await Api.exportEnvironment({
        specId,
        environmentId: runEnvironment.id
      });
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
            Download this plan for the selected environment as JSON or Excel. Use a
            matching environment file in TestNG so only that environment’s cases run.
          </p>
        </div>
      </div>
      <div className="export-grid">
        <div className="card">
          <h3>Collection</h3>
          <div className="field">
            <label htmlFor="collection-type">Collection type</label>
            <select
              id="collection-type"
              value={collectionType}
              onChange={(event) => setCollectionType(event.target.value)}
            >
              <option value="json">{COLLECTION_TYPES.json.label}</option>
              <option value="excel">{COLLECTION_TYPES.excel.label}</option>
            </select>
          </div>
          <p className="hint">{selectedType.hint(planName)}</p>
          {collectionType === "excel" ? (
            <div className="field">
              <label htmlFor="excel-file-name">Excel file name</label>
              <input
                id="excel-file-name"
                value={excelFileName}
                onChange={(event) => setExcelFileName(event.target.value)}
              />
            </div>
          ) : null}
          <div className="actions">
            <button type="button" className="btn primary" onClick={downloadCollection}>
              {selectedType.downloadLabel}
            </button>
            {collectionType === "json" ? (
              <button type="button" className="btn" onClick={() => importRef.current?.click()}>
                Import collection
              </button>
            ) : null}
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
          <h3>Environment file (CI)</h3>
          <p className="hint">
            Downloads <strong>{runEnvironment?.name || "the selected environment"}</strong> from the
            workspace bar for git or TestNG (<code>automation.environment-file</code>). Name, base URL,
            and auth type come from Edit environment. Auth is stored as <code>{"${ENV_VAR}"}</code>
            placeholders — never session tokens. Import is only for a file from another machine.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              onClick={exportEnvironment}
              disabled={!runEnvironment?.id}
            >
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
