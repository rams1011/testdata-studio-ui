import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import LoadSpecPage from "./pages/LoadSpecPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import StudioLayout, { FirstOperationRedirect } from "./pages/StudioLayout";
import OperationPage from "./pages/OperationPage";
import CasesPage from "./pages/CasesPage";
import ExportPage from "./pages/ExportPage";
import HistoryPage from "./pages/HistoryPage";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <LoadSpecPage /> },
      { path: "/admin", element: <AdminPage /> },
      { path: "/subscriptions", element: <SubscriptionsPage /> },
      {
        path: "/s/:specId",
        element: <StudioLayout />,
        children: [
          { index: true, element: <FirstOperationRedirect /> },
          { path: "op/:operationKey", element: <OperationPage /> },
          { path: "op/:operationKey/case/:caseId", element: <OperationPage /> },
          { path: "cases", element: <CasesPage /> },
          { path: "history", element: <HistoryPage /> },
          { path: "export", element: <ExportPage /> }
        ]
      }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
