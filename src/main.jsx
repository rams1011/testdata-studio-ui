import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import RequestSpinner from "./components/RequestSpinner";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
      <RequestSpinner />
    </ToastProvider>
  </React.StrictMode>
);
