import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LoadSpecPage from "./pages/LoadSpecPage";
import StudioLayout, { FirstOperationRedirect } from "./pages/StudioLayout";
import OperationPage from "./pages/OperationPage";
import CasesPage from "./pages/CasesPage";
import ExportPage from "./pages/ExportPage";

const router = createBrowserRouter([
  { path: "/", element: <LoadSpecPage /> },
  {
    path: "/s/:specId",
    element: <StudioLayout />,
    children: [
      { index: true, element: <FirstOperationRedirect /> },
      { path: "op/:operationKey", element: <OperationPage /> },
      { path: "op/:operationKey/case/:caseId", element: <OperationPage /> },
      { path: "cases", element: <CasesPage /> },
      { path: "export", element: <ExportPage /> }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
