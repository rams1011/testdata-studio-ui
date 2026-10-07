import { useEffect, useState } from "react";
import { Api } from "../api";
import { formatInstant } from "../formatInstant";

export default function CaseChangeHistoryModal({ caseId, caseName, onClose }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!caseId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    Api.listCaseAudit(caseId)
      .then((next) => {
        if (!cancelled) {
          setEvents(next || []);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setEvents([]);
          setError(caught.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="case-change-history-title">
        <div className="card-head">
          <h3 id="case-change-history-title">Change history — {caseName || "test case"}</h3>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
        {loading ? <p className="hint">Loading history…</p> : null}
        {error ? <p className="run-error">{error}</p> : null}
        {!loading && !error && !events.length ? (
          <p className="hint">No recorded changes for this case yet.</p>
        ) : null}
        {!loading && !error && events.length ? (
          <ul className="audit-list">
            {events.map((event) => (
              <li key={event.eventId}>
                <strong>{event.action}</strong>
                {" · "}
                {formatInstant(event.occurredAt)}
                {event.actorLabel ? ` · ${event.actorLabel}` : ""}
                {event.detail ? <div className="hint">{event.detail}</div> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
