import { Route, Routes } from "react-router-dom";
import LoadSpecPage from "./pages/LoadSpecPage";
import StudioLayout, { FirstOperationRedirect } from "./pages/StudioLayout";
import OperationPage from "./pages/OperationPage";
import CasesPage from "./pages/CasesPage";
import ExportPage from "./pages/ExportPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoadSpecPage />} />
      <Route path="/s/:specId" element={<StudioLayout />}>
        <Route index element={<FirstOperationRedirect />} />
        <Route path="op/:operationKey" element={<OperationPage />} />
        <Route path="op/:operationKey/case/:caseId" element={<OperationPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="export" element={<ExportPage />} />
      </Route>
    </Routes>
  );
}
