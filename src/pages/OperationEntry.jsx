import { Navigate, useOutletContext, useParams } from "react-router-dom";
import OperationPage from "./OperationPage";
import OperationCasesPage from "./OperationCasesPage";

export default function OperationEntry() {
  const { operationKey } = useParams();
  const { cases, planId, environmentReady } = useOutletContext();

  if (!planId || !environmentReady) {
    return <div className="empty">Loading workspace…</div>;
  }

  const opCases = (cases || []).filter((item) => item.operationKey === operationKey);

  if (opCases.length === 1) {
    return <Navigate to={`case/${opCases[0].id}`} replace />;
  }
  if (opCases.length >= 2) {
    return <OperationCasesPage cases={opCases} />;
  }
  return <OperationPage />;
}
