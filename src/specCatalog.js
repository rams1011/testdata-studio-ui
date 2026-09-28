import { specLabel } from "./components/LabelField";

const RECENT_KEY = "testdata.spec.recent";
const MAX_RECENT = 8;

export function readRecentSpecIds() {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [];
  } catch {
    return [];
  }
}

export function touchRecentSpec(specId) {
  if (!specId) return;
  const next = readRecentSpecIds().filter((id) => id !== specId);
  next.unshift(specId);
  sessionStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX_RECENT)));
}

export function filterSpecs(specs, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return specs || [];
  return (specs || []).filter((spec) => {
    const haystack = `${spec.name || ""} ${spec.title || ""} ${spec.label || ""} ${spec.baseUrl || ""}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export function partitionSpecs(specs) {
  const openApi = [];
  const rest = [];
  (specs || []).forEach((spec) => {
    if (spec?.manual) {
      rest.push(spec);
    } else {
      openApi.push(spec);
    }
  });
  return { openApi, rest };
}

export function groupSpecs(specs) {
  const groups = new Map();
  (specs || []).forEach((spec) => {
    const label = specLabel(spec);
    const key = label.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { title: label, items: [] });
    }
    groups.get(key).items.push(spec);
  });
  return [...groups.values()]
    .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }))
    .map((group) => [group.title, group.items]);
}

export function specSubtitle(spec) {
  const parts = [];
  if (spec.manual) {
    parts.push("REST catalog");
    if (spec.operationCount) {
      parts.push(`${spec.operationCount} API${spec.operationCount === 1 ? "" : "s"}`);
    }
  } else if (spec.operationCount != null) {
    parts.push(`${spec.operationCount} operation${spec.operationCount === 1 ? "" : "s"}`);
  }
  if (spec.baseUrl) {
    parts.push(spec.baseUrl);
  }
  return parts.join(" · ");
}

export function recentSpecs(allSpecs, query) {
  const byId = new Map((allSpecs || []).map((spec) => [spec.specId, spec]));
  const filtered = filterSpecs(allSpecs, query);
  const allowed = new Set(filtered.map((spec) => spec.specId));
  return readRecentSpecIds()
    .map((id) => byId.get(id))
    .filter((spec) => spec && allowed.has(spec.specId));
}
