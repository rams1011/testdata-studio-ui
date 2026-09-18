import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  extractPlaceholderName,
  formatExtractPlaceholder,
  isExtractPlaceholder
} from "../schema";

const PlanExtractsContext = createContext([]);

export function PlanExtractsProvider({ extracts, children }) {
  return (
    <PlanExtractsContext.Provider value={extracts || []}>
      {children}
    </PlanExtractsContext.Provider>
  );
}

export function usePlanExtracts() {
  return useContext(PlanExtractsContext);
}

export default function ExtractValueField({
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  extracts,
  disabled,
  ariaLabel
}) {
  const contextExtracts = usePlanExtracts();
  const options = extracts || contextExtracts || [];
  const resolvedType = isExtractPlaceholder(value) || (type === "number" && options.length)
    ? "text"
    : type;

  return (
    <div className={`extract-value-field${options.length ? " has-extracts" : ""}`}>
      <input
        type={resolvedType}
        step={resolvedType === "number" ? step : undefined}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
      {options.length ? (
        <ExtractSearch
          options={options}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

function ExtractSearch({ options, value, disabled, onChange }) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const selected = extractPlaceholderName(value);
  const known = options.find((item) => item.name === selected);
  const filtered = useMemo(() => filterExtracts(options, query), [options, query]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        close();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(item) {
    onChange(formatExtractPlaceholder(item.name));
    close();
  }

  function clear() {
    if (isExtractPlaceholder(value)) {
      onChange("");
    }
    close();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      inputRef.current?.blur();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (filtered[highlight]) {
        pick(filtered[highlight]);
      }
    }
  }

  const activeId = open && filtered[highlight] ? `${listId}-${highlight}` : undefined;
  const display = open ? query : (known ? known.name : "");

  return (
    <div className={`extract-search${open ? " open" : ""}`} ref={rootRef}>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search extracted fields"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        disabled={disabled}
        placeholder={known ? optionLabel(known) : "Search extracted fields"}
        value={display}
        onFocus={() => {
          if (!disabled) {
            setQuery("");
            setOpen(true);
          }
        }}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <ul className="extract-search-list" id={listId} role="listbox">
          {known ? (
            <li role="presentation">
              <button type="button" className="extract-search-option clear" onMouseDown={(event) => event.preventDefault()} onClick={clear}>
                Clear extract
              </button>
            </li>
          ) : null}
          {filtered.length ? filtered.map((item, index) => (
            <li key={`${item.caseId}-${item.name}`} role="presentation">
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={item.name === selected || index === highlight}
                className={`extract-search-option${index === highlight ? " active" : ""}${item.name === selected ? " selected" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(item)}
              >
                <strong>{item.name}</strong>
                <span className="hint">{item.testName}{item.source ? ` · ${shortenSource(item.source)}` : ""}</span>
              </button>
            </li>
          )) : (
            <li className="extract-search-empty" role="presentation">No matching extracts</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

function filterExtracts(options, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) {
    return options;
  }
  return options.filter((item) => {
    const haystack = [
      item.name,
      item.testName,
      item.method,
      item.source,
      shortenSource(item.source),
      optionLabel(item)
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

function optionLabel(item) {
  const source = shortenSource(item.source);
  return source
    ? `${item.name} · ${item.testName} (${source})`
    : `${item.name} · ${item.testName}`;
}

function shortenSource(source) {
  const text = String(source || "").trim();
  if (!text) {
    return "";
  }
  if (text.startsWith("header:")) {
    return text.slice("header:".length);
  }
  if (text.startsWith("cookie:")) {
    return text.slice("cookie:".length);
  }
  return text;
}
