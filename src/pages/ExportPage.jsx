import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "../components/Toast";

export default function ExportPage() {
  const { specId } = useParams();
  const { spec, plans, plan, planId, selectPlan } = useOutletContext();
  const { toast } = useToast();
  const [excelFileName, setExcelFileName] = useState("");

  useEffect(() => {
    if (plan?.name) {
      setExcelFileName(`${plan.name}.xlsx`);
    }
  }, [plan?.name]);

  async function exportCases() {
    try {
      const downloaded = await Api.exportCases({ specId, planId, excelFileName });
      toast(`Downloaded ${downloaded.fileName}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="crumb">{spec.name || spec.title}{plan?.name ? ` · ${plan.name}` : ""}</div>
          <h2>Export Excel</h2>
        </div>
        <button type="button" className="btn primary" onClick={exportCases}>Download Excel</button>
      </div>
      <div className="card">
        <h3>Download</h3>
        <p className="hint">
          Downloads api-automation Excel for the selected plan only. Request bodies are written into the RequestBody column.
          Multipart files are copied to api-automation <code>src/test/data/files</code> and listed in the UploadFiles column.
        </p>
        <div className="field">
          <label>Test plan</label>
          <select value={planId} onChange={(event) => selectPlan(event.target.value)}>
            {plans.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Excel file name</label>
          <input value={excelFileName} onChange={(event) => setExcelFileName(event.target.value)} />
        </div>
      </div>
    </div>
  );
}
