import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterSpecs,
  recentSpecs,
  specSubtitle,
  touchRecentSpec
} from "../specCatalog";

const MIN_QUERY = 3;
const MAX_SUGGESTIONS = 15;

export default function SpecSwitcherModal({
  open,
  specs = [],
  currentSpecId,
  onClose,
  onSelect,
  onNewSpec
}) {
  const searchRef = useRef(null);
  const suggestRef = useRef(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const trimmed = query.trim();
  const searchActive = trimmed.length >= MIN_QUERY;
  const suggestions = useMemo(
    () => (searchActive ? filterSpecs(specs, query).slice(0, MAX_SUGGESTIONS) : []),
    [specs, query, searchActive]
  );
  const recent = useMemo(() => recentSpecs(specs, ""), [specs]);

  const selectable = searchActive ? suggestions : recent;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    searchRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setHighlight((current) => Math.min(current, Math.max(selectable.length - 1, 0)));
  }, [query, selectable.length, searchActive]);

  useEffect(() => {
    if (!open || !searchActive || !suggestRef.current) return;
    const active = suggestRef.current.querySelector(".spec-switcher-suggest-row.active");
    active?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, searchActive, suggestions.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  function choose(spec) {
    if (!spec?.specId) return;
    touchRecentSpec(spec.specId);
    onSelect(spec.specId);
    onClose();
  }

  function onInputKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (selectable.length) {
        setHighlight((current) => Math.min(current + 1, selectable.length - 1));
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (selectable.length) {
        setHighlight((current) => Math.max(current - 1, 0));
      }
      return;
    }
    if (event.key === "Enter") {
      if (selectable.length) {
        event.preventDefault();
        choose(selectable[Math.min(highlight, selectable.length - 1)]);
      }
    }
  }

  return (
    <div
      className="modal-backdrop spec-switcher-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="card modal spec-switcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spec-switcher-title"
      >
        <div className="card-head">
          <h3 id="spec-switcher-title">Open spec</h3>
          <button type="button" className="btn" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="spec-switcher-field">
          <input
            ref={searchRef}
            type="text"
            className="spec-switcher-input"
            placeholder="Type at least 3 characters to search"
            value={query}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={searchActive && suggestions.length > 0}
            aria-controls="spec-switcher-suggest"
            aria-autocomplete="list"
            aria-activedescendant={
              searchActive && suggestions[highlight]
                ? `spec-suggest-${suggestions[highlight].specId}`
                : undefined
            }
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          {searchActive ? (
            <div
              id="spec-switcher-suggest"
              className="spec-switcher-suggest"
              ref={suggestRef}
              role="listbox"
            >
              {!suggestions.length ? (
                <div className="spec-switcher-suggest-empty">
                  No specs match “{trimmed}”.
                </div>
              ) : (
                suggestions.map((spec, index) => (
                  <SuggestRow
                    key={spec.specId}
                    spec={spec}
                    index={index}
                    highlight={highlight}
                    currentSpecId={currentSpecId}
                    onHighlight={setHighlight}
                    onChoose={choose}
                  />
                ))
              )}
            </div>
          ) : null}
        </div>
        {!searchActive ? (
          <div className="spec-switcher-browse">
            <p className="hint spec-switcher-browse-hint">
              Type {MIN_QUERY} or more characters to search all specs.
            </p>
            {recent.length ? (
              <section className="spec-switcher-section">
                <div className="spec-switcher-section-title">Recent</div>
                {recent.map((spec, index) => (
                  <BrowseRow
                    key={spec.specId}
                    spec={spec}
                    index={index}
                    highlight={highlight}
                    currentSpecId={currentSpecId}
                    onHighlight={setHighlight}
                    onChoose={choose}
                  />
                ))}
              </section>
            ) : (
              <div className="empty spec-switcher-empty">No recent specs yet.</div>
            )}
          </div>
        ) : null}
        <div className="spec-switcher-foot">
          <span className="hint">↑↓ · Enter · Ctrl+K</span>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onClose();
              onNewSpec?.();
            }}
          >
            New spec…
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestRow({ spec, index, highlight, currentSpecId, onHighlight, onChoose }) {
  const title = spec.name || spec.title || spec.specId;
  const subtitle = specSubtitle(spec);
  const active = index === highlight;
  const current = spec.specId === currentSpecId;
  return (
    <button
      id={`spec-suggest-${spec.specId}`}
      type="button"
      role="option"
      aria-selected={active}
      className={`spec-switcher-suggest-row${active ? " active" : ""}${current ? " current" : ""}`}
      onMouseEnter={() => onHighlight(index)}
      onClick={() => onChoose(spec)}
    >
      <span className="spec-switcher-suggest-title">{title}</span>
      {subtitle ? <span className="spec-switcher-suggest-meta">{subtitle}</span> : null}
      {current ? <span className="spec-switcher-suggest-badge">Current</span> : null}
    </button>
  );
}

function BrowseRow({ spec, index, highlight, currentSpecId, onHighlight, onChoose }) {
  const title = spec.name || spec.title || spec.specId;
  const subtitle = specSubtitle(spec);
  const active = index === highlight;
  const current = spec.specId === currentSpecId;
  return (
    <button
      type="button"
      className={`spec-switcher-row${active ? " active" : ""}${current ? " current" : ""}`}
      onMouseEnter={() => onHighlight(index)}
      onClick={() => onChoose(spec)}
    >
      <div className="spec-switcher-row-title">{title}</div>
      {subtitle ? <div className="hint">{subtitle}</div> : null}
      {current ? <span className="spec-switcher-badge">Current</span> : null}
    </button>
  );
}
