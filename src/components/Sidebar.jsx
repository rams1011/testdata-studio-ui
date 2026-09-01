import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import { Api } from "../api";
import { useToast } from "./Toast";

export default function Sidebar({
  spec,
  operations,
  caseCounts = {},
  search,
  onSearch,
  plans,
  planId,
  onSelectPlan,
  onPlansChange,
  onReloadSpec,
  onSpecRenamed
}) {
  const { specId } = useParams();
  const location = useLocation();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const navRef = useRef(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [reloading, setReloading] = useState(false);
  const [showTags, setShowTags] = useState(readShowTags);
  const [collapsedTags, setCollapsedTags] = useState(() => new Set());
  const needsRename = spec.name && spec.title && spec.name === spec.title;
  const [renaming, setRenaming] = useState(needsRename);
  const [renameFocus, setRenameFocus] = useState(false);
  const [specName, setSpecName] = useState(spec.name || "");

  const visibleOps = useMemo(
    () => operations.filter((operation) => matchesSearch(operation, search)),
    [operations, search]
  );
  const grouped = useMemo(() => groupOperations(visibleOps), [visibleOps]);
  const tagNames = Object.keys(grouped);

  useEffect(() => {
    setSpecName(spec.name || "");
    setRenaming(Boolean(spec.name && spec.title && spec.name === spec.title));
    setRenameFocus(false);
  }, [spec.specId, spec.name, spec.title]);

  useEffect(() => {
    setCollapsedTags(new Set());
  }, [specId]);

  useEffect(() => {
    const active = navRef.current?.querySelector(".op-item.active");
    active?.scrollIntoView({ block: "nearest" });
  }, [location.pathname, visibleOps, showTags, collapsedTags]);

  async function saveSpecName() {
    const nextName = specName.trim();
    if (!nextName) {
      toast("Spec name is required", true);
      return;
    }
    try {
      const updated = await Api.renameSpec(specId, { name: nextName });
      onSpecRenamed?.(updated);
      setRenaming(false);
      toast("Name saved");
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function addPlan() {
    const name = newPlanName.trim();
    if (!name) {
      toast("Enter a plan name", true);
      return;
    }
    try {
      const created = await Api.createPlan(specId, { name });
      setNewPlanName("");
      await onPlansChange(created.id);
      toast(`Created plan ${created.name}`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function removePlan() {
    if (plans.length <= 1) {
      toast("Keep at least one plan", true);
      return;
    }
    const current = plans.find((plan) => plan.id === planId);
    if (!window.confirm(`Delete plan "${current?.name || planId}" and its test cases?`)) {
      return;
    }
    try {
      await Api.deletePlan(specId, planId);
      await onPlansChange();
      toast("Plan deleted");
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function reloadSpec(file) {
    if (!window.confirm(RELOAD_SPEC_CONFIRM)) {
      return;
    }
    setReloading(true);
    try {
      await onReloadSpec(file);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setReloading(false);
    }
  }

  function chooseReloadSource() {
    if (spec?.sourceLocation) {
      reloadSpec();
      return;
    }
    fileRef.current?.click();
  }

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
  const totalCases = Object.values(caseCounts).reduce((sum, count) => sum + count, 0);

  function renderOperation(operation) {
    return (
      <NavLink
        key={operation.key}
        to={`/s/${specId}/op/${encodeURIComponent(operation.key)}`}
        title={`${operation.method} ${operation.path}`}
        className={({ isActive }) => `op-item ${isActive ? "active" : ""}`}
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
      <div className="spec-meta">
        {renaming ? (
          <div className="plan-add">
            <input
              value={specName}
              autoFocus={renameFocus}
              placeholder="Unique spec name"
              onChange={(event) => setSpecName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveSpecName();
                if (event.key === "Escape") setRenaming(false);
              }}
            />
            <button type="button" className="btn ghost" onClick={saveSpecName}>Save</button>
          </div>
        ) : (
          <div className="spec-title-row">
            <div className="title">{spec.name || spec.title}</div>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setRenameFocus(true);
                setRenaming(true);
              }}
            >
              Rename
            </button>
          </div>
        )}
        {needsRename && renaming ? (
          <div className="sub">Give this spec a unique name so you can tell it apart from the OpenAPI title.</div>
        ) : null}
        {spec.title && spec.title !== spec.name ? <div className="sub">{spec.title}</div> : null}
        <div className="sub">
          {spec.operationCount} operations{spec.baseUrl ? ` · ${spec.baseUrl}` : ""}
        </div>
        <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={chooseReloadSource} disabled={reloading}>
          {reloading ? "Updating…" : "Update spec"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.yaml,.yml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) reloadSpec(file);
          }}
        />
      </div>
      <div className="plan-picker">
        <label htmlFor="plan-select">Test plan</label>
        <select id="plan-select" value={planId} onChange={(event) => onSelectPlan(event.target.value)}>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
        <details className="plan-manage">
          <summary>Manage plan</summary>
          <div className="plan-add">
            <input
              value={newPlanName}
              placeholder="New plan name"
              onChange={(event) => setNewPlanName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addPlan();
              }}
            />
            <button type="button" className="btn ghost" onClick={addPlan}>Add</button>
          </div>
          <button type="button" className="btn ghost" onClick={removePlan} disabled={plans.length <= 1}>
            Delete plan
          </button>
        </details>
      </div>
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
        <NavLink to={`/s/${specId}/cases`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Cases
          {totalCases ? <span className="case-count">{totalCases}</span> : null}
        </NavLink>
        <NavLink to={`/s/${specId}/export`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Export Excel
        </NavLink>
      </div>
      <nav className="nav" ref={navRef}>
        {search && !filteredCount ? (
          <div className="empty" style={{ padding: "12px 10px", color: "#b0b0b0" }}>No operations match.</div>
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
                    onClick={() => toggleTag(tag)}
                  >
                    <span className="tag-caret">{open ? "▾" : "▸"}</span>
                    {displayTag(tag)}
                    <span className="tag-count">{ops.length}</span>
                  </button>
                  {open ? ops.map(renderOperation) : null}
                </div>
              );
            })
          : visibleOps.map(renderOperation)}
      </nav>
      <div className="side-foot">
        <NavLink to="/" className="btn ghost">All specs</NavLink>
      </div>
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
