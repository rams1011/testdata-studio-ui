import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

export default function SpecMoreMenu({ specId, onSpecSettings }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!specId) {
    return null;
  }

  return (
    <div className="spec-more" ref={rootRef}>
      <button
        type="button"
        className="spec-more-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More spec actions"
        onClick={() => setOpen((current) => !current)}
      >
        More
      </button>
      {open ? (
        <div className="spec-more-panel" role="menu">
          {onSpecSettings ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSpecSettings();
              }}
            >
              Spec settings
            </button>
          ) : null}
          <NavLink
            to={`/s/${specId}/history`}
            role="menuitem"
            className={({ isActive }) => (isActive ? "active" : undefined)}
            onClick={() => setOpen(false)}
          >
            History
          </NavLink>
          <NavLink
            to={`/s/${specId}/export`}
            role="menuitem"
            className={({ isActive }) => (isActive ? "active" : undefined)}
            onClick={() => setOpen(false)}
          >
            Export
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}
