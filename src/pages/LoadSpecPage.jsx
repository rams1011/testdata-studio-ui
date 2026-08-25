import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_DISPLAY, Api } from "../api";
import { useToast } from "../components/Toast";

export default function LoadSpecPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backend, setBackend] = useState({ status: "checking", specs: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([Api.config(), Api.listSpecs()])
      .then(([config, specs]) => {
        if (!cancelled) {
          setBackend({ status: "ok", config, specs: specs || [] });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBackend({ status: "down", error: error.message, specs: [] });
        }
      });
    return () => { cancelled = true; };
  }, []);

  async function load() {
    if (!url.trim() && !paste.trim()) {
      toast("Provide a spec URL, file path, or pasted OpenAPI content", true);
      return;
    }
    setLoading(true);
    try {
      const spec = await Api.loadSpec({
        location: url.trim() || null,
        content: paste.trim() || null,
        baseUrl: baseUrl.trim() || null
      });
      navigate(`/s/${spec.specId}`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function upload(file) {
    setLoading(true);
    try {
      const spec = await Api.uploadSpec(file, baseUrl.trim());
      navigate(`/s/${spec.specId}`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hero">
      <h1>Test Data Studio</h1>
      <p>
        Load a Swagger / OpenAPI spec. Pages and forms are generated from each operation schema
        so you can create api-automation test data without hand-editing Excel.
      </p>

      <div className={`status-banner ${backend.status}`}>
        {backend.status === "checking" && "Connecting to API…"}
        {backend.status === "ok" && (
          <>
            API connected at {API_DISPLAY} · storage={backend.config?.storageType || "unknown"}
          </>
        )}
        {backend.status === "down" && (
          <>
            Cannot reach API at {API_DISPLAY}. Start testdata-generator-api on port 8083, then reload.
            {backend.error ? <div className="hint">{backend.error}</div> : null}
          </>
        )}
      </div>

      {backend.specs.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Specs on the server</h3>
          <table className="table">
            <thead>
              <tr>
                {["Title", "Operations", "Base URL"].map((text) => <th key={text}>{text}</th>)}
              </tr>
            </thead>
            <tbody>
              {backend.specs.map((spec) => (
                <tr
                  key={spec.specId}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/s/${spec.specId}`)}
                >
                  <td>{spec.title}</td>
                  <td>{spec.operationCount}</td>
                  <td>{spec.baseUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="card">
        <h3>OpenAPI source</h3>
        <div className="field">
          <label>Spec URL or local file path</label>
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://petstore.swagger.io/v2/swagger.json" />
        </div>
        <div className="field">
          <label>Base URL override</label>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="Optional base URL override" />
        </div>
        <div className="field">
          <label>Paste spec</label>
          <textarea value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="Or paste OpenAPI JSON / YAML here" />
        </div>
        <div
          className={`drop ${dragging ? "drag" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) upload(file);
          }}
        >
          <strong>Drop a Swagger or OpenAPI file</strong>
          <div className="hint">JSON, YAML, or YML</div>
          <input type="file" accept=".json,.yaml,.yml" onChange={(event) => event.target.files[0] && upload(event.target.files[0])} />
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={load} disabled={loading || backend.status === "down"}>
            {loading ? "Loading…" : "Load spec"}
          </button>
        </div>
      </div>
    </div>
  );
}
