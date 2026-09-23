import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function AccountMenu({ account, canManage, canManageSubscriptions, onSignOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const email = account?.email || "";
  const hasMenu = Boolean(canManage || canManageSubscriptions || onSignOut);

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

  if (!hasMenu) {
    return null;
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-menu-avatar" aria-hidden="true">{initials(account)}</span>
        <span className="account-menu-label">{email || "Account"}</span>
      </button>
      {open ? (
        <div className="account-menu-panel" role="menu">
          {canManageSubscriptions ? (
            <Link to="/subscriptions" role="menuitem" onClick={() => setOpen(false)}>Plan</Link>
          ) : null}
          {canManage ? (
            <Link to="/admin" role="menuitem" onClick={() => setOpen(false)}>Admin</Link>
          ) : null}
          {onSignOut ? (
            <button type="button" role="menuitem" onClick={onSignOut}>Sign out</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function initials(account) {
  const name = String(account?.name || account?.email || "A").trim();
  const fromName = name.split(/\s+/).filter(Boolean);
  if (fromName.length >= 2 && !name.includes("@")) {
    return (fromName[0][0] + fromName[1][0]).toUpperCase();
  }
  const local = name.includes("@") ? name.slice(0, name.indexOf("@")) : name;
  return local.slice(0, 2).toUpperCase() || "A";
}
