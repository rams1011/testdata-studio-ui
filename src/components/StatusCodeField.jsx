import { useEffect, useMemo, useRef, useState } from "react";
import { statusLabel } from "../httpStatus";

export default function StatusCodeField({ value, options, onChange, invalid = false }) {
  const [query, setQuery] = useState(statusLabel(value));
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    setQuery(statusLabel(value));
  }, [value]);

  useEffect(() => {
    function onDoc(event) {
      if (!boxRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery(statusLabel(value));
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => {
      const item = typeof option === "object" ? option : { value: option, label: String(option) };
      return `${item.value} ${item.label}`.toLowerCase().includes(needle);
    });
  }, [options, query]);

  function select(item) {
    onChange(Number(item.value));
    setQuery(item.label);
    setOpen(false);
  }

  function commitTyped() {
    const match = query.trim().match(/^(\d{3})/);
    if (match) {
      onChange(Number(match[1]));
      setQuery(statusLabel(match[1]));
    } else {
      setQuery(statusLabel(value));
    }
    setOpen(false);
  }

  return (
    <div className={`field status-combo${invalid ? " field-missing" : ""}`} ref={boxRef}>
      <label>Expected status</label>
      <input
        value={query}
        placeholder="Type 404 or OK"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (filtered[0]) {
              const item = typeof filtered[0] === "object"
                ? filtered[0]
                : { value: filtered[0], label: String(filtered[0]) };
              select(item);
            } else {
              commitTyped();
            }
          }
          if (event.key === "Escape") {
            setOpen(false);
            setQuery(statusLabel(value));
          }
        }}
        onBlur={commitTyped}
      />
      {open ? (
        <ul className="status-combo-list">
          {filtered.slice(0, 40).map((option) => {
            const item = typeof option === "object" ? option : { value: option, label: String(option) };
            return (
              <li key={item.value}>
                <button
                  type="button"
                  className={String(item.value) === String(value) ? "active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(item)}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
          {!filtered.length ? <li className="hint" style={{ padding: 8 }}>No matching status</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
