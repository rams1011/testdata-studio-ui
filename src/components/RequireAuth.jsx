import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Api } from "../api";
import { isAuthEnabled } from "../session";

export default function RequireAuth() {
  const location = useLocation();
  const [gate, setGate] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    Promise.all([Api.config(), Api.session()])
      .then(([config, session]) => {
        if (cancelled) return;
        if (isAuthEnabled(session, config) && !session?.authenticated) {
          setGate("login");
        } else {
          setGate("ok");
        }
      })
      .catch(() => {
        if (!cancelled) setGate("ok");
      });
    function onUnauthorized() {
      setGate("login");
    }
    window.addEventListener("testdata:unauthorized", onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener("testdata:unauthorized", onUnauthorized);
    };
  }, [location.pathname]);

  if (gate === "checking") {
    return (
      <div className="hero">
        <h1>Test Data Studio</h1>
        <p>Checking session…</p>
      </div>
    );
  }
  if (gate === "login") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
