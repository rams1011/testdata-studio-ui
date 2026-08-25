import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "../components/Toast";

export default function CasesPage() {
  const { specId } = useParams();
  const { spec, plan, planId } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cases, setCases] = useState([]);

  useEffect(() => {
    if (!planId) return;
    Api.listCases(specId, undefined, planId).then(setCases).catch((error) => toast(error.message, true));
  }, [specId, planId, toast]);

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="crumb">{spec.title}{plan?.name ? ` · ${plan.name}` : ""}</div>
          <h2>Saved test cases</h2>
        </div>
      </div>
      {!cases.length ? (
        <div className="card">
          <div className="empty">Save cases from any generated operation page into this plan.</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                {["Name", "Method", "Endpoint", "Group", "Status"].map((text) => <th key={text}>{text}</th>)}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
