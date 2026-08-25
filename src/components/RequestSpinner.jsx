import { useEffect, useState } from "react";
import { subscribeInflight } from "../api";

export default function RequestSpinner() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let showTimer = 0;
    const unsubscribe = subscribeInflight((count) => {
      if (count > 0) {
        if (!showTimer) {
          showTimer = window.setTimeout(() => setBusy(true), 120);
        }
        return;
      }
      window.clearTimeout(showTimer);
      showTimer = 0;
      setBusy(false);
    });
    return () => {
      window.clearTimeout(showTimer);
      unsubscribe();
    };
  }, []);

  if (!busy) {
    return null;
  }

  return (
    <div className="request-spinner" role="status" aria-live="polite" aria-busy="true">
      <div className="request-spinner-card">
        <span className="spinner" aria-hidden="true" />
        <span>Working…</span>
      </div>
    </div>
  );
}
