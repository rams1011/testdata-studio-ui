import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useParams } from "react-router-dom";

export default function Sidebar({
  spec,
  operations,
  caseCounts = {},
  search,
  onSearch,
  quickAdd
}) {
  const { specId } = useParams();
  const location = useLocation();
  const navRef = useRef(null);
  const [showTags, setShowTags] = useState(readShowTags);
  const [collapsedTags, setCollapsedTags] = useState(() => new Set());

  const visibleOps = useMemo(
    () => operations.filter((operation) => matchesSearch(operation, search)),
    [operations, search]
  );
  const grouped = useMemo(() => groupOperations(visibleOps), [visibleOps]);
  const tagNames = Object.keys(grouped);

  useEffect(() => {
    setCollapsedTags(new Set());
  }, [specId]);

  useEffect(() => {
    const active = navRef.current?.querySelector(".op-item.active");
    active?.scrollIntoView({ block: "nearest" });
  }, [location.pathname, visibleOps, showTags, collapsedTags]);

  function toggleShowTags() {
    setShowTags((current) => {
      const next = !current;
      writeShowTags(next);
      return next;
    });
  }

  function toggleTag(tag) {
    setCollapsedTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  const filteredCount = visibleOps.length;

  function renderOperation(operation) {
    return (
      <NavLink
        key={operation.key}
        to={`/s/${specId}/op/${encodeURIComponent(operation.key)}`}
        title={`${operation.method} ${operation.path}`}
        className={() => {
          const base = `/s/${specId}/op/${encodeURIComponent(operation.key)}`;
          const path = location.pathname;
          const active = path === base || path.startsWith(`${base}/`);
          return `op-item ${active ? "active" : ""}`;
        }}
      >
        <span className={`method ${operation.method}`}>{operation.method}</span>
        <span className="op-copy">
          <div className="name">{operation.summary || operation.key}</div>
          <div className="path">{operation.path}</div>
        </span>
        {caseCounts[operation.key] ? (
          <span className="case-count">{caseCounts[operation.key]}</span>
        ) : null}
      </NavLink>
    );
  }

  return (
    <aside className="sidebar">
      <NavLink to="/" className="brand">
        <h1>Test Data Studio</h1>
        <p>Schema-driven test cases</p>
      </NavLink>
      <div className="nav-chrome">
        <div className="side-search">
          <input
            type="search"
            placeholder="Search operations"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          <div className="nav-toolbar">
            <label className="nav-tags-toggle">
              <input type="checkbox" checked={showTags} onChange={toggleShowTags} />
              Show tags
            </label>
            {showTags && tagNames.length > 1 ? (
              <span className="nav-tag-actions">
                <button type="button" className="linkish" onClick={() => setCollapsedTags(new Set())}>Expand</button>
                <button type="button" className="linkish" onClick={() => setCollapsedTags(new Set(tagNames))}>Collapse</button>
              </span>
            ) : null}
          </div>
        </div>
        {spec?.manual && quickAdd ? quickAdd : null}
      </div>
      <nav className="nav" ref={navRef}>
        {search && !filteredCount ? (
          <div className="empty" style={{ padding: "12px 10px", color: "#b0b0b0" }}>No operations match.</div>
        ) : null}
        {!search && !operations.length ? (
          <div className="empty" style={{ padding: "12px 10px", color: "#b0b0b0" }}>
            {spec?.manual ? "No APIs yet — use the bar above or Import from curl." : "No operations in this spec."}
          </div>
        ) : null}
        {showTags
          ? tagNames.map((tag) => {
              const ops = grouped[tag] || [];
              const open = Boolean(search) || !collapsedTags.has(tag);
              return (
                <div key={tag} className="tag-group">
                  <button
                    type="button"
                    className="tag-label"
                    aria-expanded={open}
                    aria-label={`${displayTag(tag)}, ${ops.length} APIs`}
                    onClick={() => toggleTag(tag)}
                  >
                    <span className="tag-caret">{open ? "▾" : "▸"}</span>
                    {displayTag(tag)}
                    <span className="tag-count" title={`${ops.length} APIs`}>{ops.length}</span>
                  </button>
                  {open ? ops.map(renderOperation) : null}
                </div>
              );
            })
          : visibleOps.map(renderOperation)}
      </nav>
    </aside>
  );
}

const SHOW_TAGS_KEY = "testdata.nav.showTags";

function readShowTags() {
  try {
    const raw = localStorage.getItem(SHOW_TAGS_KEY);
    if (raw == null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

function writeShowTags(value) {
  try {
    localStorage.setItem(SHOW_TAGS_KEY, String(value));
  } catch {
    /* ignore quota / private mode */
  }
}

function opTag(operation) {
  return operation.tag || "generated";
}

function groupOperations(operations) {
  return operations.reduce((groups, operation) => {
    const tag = opTag(operation);
    groups[tag] = groups[tag] || [];
    groups[tag].push(operation);
    return groups;
  }, {});
}

function displayTag(tag) {
  const trimmed = String(tag || "")
    .replace(/[-_]?controller$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!trimmed) return tag;
  return trimmed.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchesSearch(operation, search) {
  if (!search) return true;
  const haystack = `${operation.method} ${operation.path} ${operation.summary} ${operation.tag} ${operation.key}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export function reloadSpecToast(result) {
  const added = result?.addedOperations?.length ?? 0;
  const removed = result?.removedOperations?.length ?? 0;
  const orphaned = result?.orphanedCaseCount ?? 0;
  let message = `Spec updated (${result?.spec?.operationCount ?? 0} operations)`;
  if (added) {
    message += `. +${added} new`;
  }
  if (removed) {
    message += `. ${removed} removed`;
  }
  if (orphaned) {
    message += `. ${orphaned} saved cases still point at removed operations`;
  }
  return message;
}

export const RELOAD_SPEC_CONFIRM =
  "Update this spec in place?\n\nPlans and saved cases are kept. Operation forms pick up the new schema. Cases for operations that disappear stay in the plan but cannot be opened until you delete them or restore that operation.";
